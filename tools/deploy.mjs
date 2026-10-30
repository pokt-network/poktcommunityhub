#!/usr/bin/env node
/**
 * Deploy the tracked tree at HEAD to a host, and refuse on anything that has
 * silently gone wrong before.
 *
 * Modelled on the Agentic Portal's tools/deploy.mjs. Each check below exists
 * because it bit that project, and says how:
 *
 *   - `git archive | tar` never deletes, so the host tree becomes the union of
 *     every deploy and a file removed weeks ago can still be built. Step 2 sweeps.
 *   - `docker compose up` builds an image that does not exist yet, with no
 *     GIT_COMMIT, and later deploys reuse it. The portal served a two-commit-old
 *     console while reporting success. Step 4 builds every image explicitly,
 *     asserts each one's revision label, and step 6 runs `up --no-build`.
 *   - A deploy run as root leaves a root-owned tree that the next non-root deploy
 *     cannot overwrite. Step 0 refuses root.
 *   - A port published on 0.0.0.0 bypasses ufw through Docker's netfilter chains.
 *     Step 3 refuses one before anything starts.
 *
 * Build, then migrate, then up: the apps must never meet a schema they were not
 * written for.
 *
 * Rollback is a retag of the previous commit's images (a service new in this
 * release is stopped instead), printed at the end. It does not undo migrations.
 *
 * Usage:
 *   pnpm deploy:host <ssh-host> [--dir /opt/pocket/services/community] [--yes] [--no-cache]
 */
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { parseDeployArgs } from './deploy-args.mjs';
import { APP_SERVICES, BUILT_SERVICES } from './images.mjs';
import { rollbackCommand } from './rollback.mjs';

const parsed = parseDeployArgs(process.argv.slice(2));
if (parsed.error !== undefined) {
  console.error(`error: ${parsed.error}`);
  console.error('usage: pnpm deploy:host <ssh-host> [--dir <path>] [--yes] [--no-cache]');
  process.exit(2);
}
const { host, dir: DIR, yes, noCache } = parsed;

/** Both compose files, always. The second joins web to the shared Caddy's network. */
const COMPOSE = 'docker compose -f docker-compose.yml -f deploy/cherry-as.compose.yml';

/** The shared Caddy, owned by the Pocket Service Manager. We add one file to it. */
const CADDY_SITES = '/opt/pocket/caddy/sites';
const SITE_FILE = 'community.caddy';
const PUBLIC_URL = 'https://community.pocket.network';

/** Host-side secret env files, written once by hand (docs/runbooks/cherry-as.md). */
const ENV_FILES = ['.env.db', '.env.web'];

/**
 * Git Bash's ssh cannot see the Windows ssh-agent, so prefer the Windows binary
 * where it exists; everywhere else `ssh` is `ssh`.
 */
const SSH = process.platform === 'win32' ? 'C:\\Windows\\System32\\OpenSSH\\ssh.exe' : 'ssh';

const die = (message) => {
  console.error(`\nDEPLOY REFUSED: ${message}\n`);
  process.exit(1);
};

const step = (n, title) =>
  console.log(`\n── ${n}. ${title} ${'─'.repeat(Math.max(0, 58 - title.length))}`);

const local = (command, args) => execFileSync(command, args, { encoding: 'utf8' });

/** Run a command ON THE HOST. A non-zero exit fails the deploy. */
const remote = (script, options = {}) =>
  execFileSync(SSH, [host, script], { encoding: 'utf8', ...options });

/** A path as one single-quoted word for the host's shell. */
const quote = (path) => `'${path.replace(/'/g, `'\\''`)}'`;

// git archive and ls-files describe the tree under the CURRENT directory; run
// from a subdirectory this would ship a subtree and sweep everything else.
process.chdir(local('git', ['rev-parse', '--show-toplevel']).trim());

// ── 0. Preconditions ──────────────────────────────────────────────────────
step(0, 'Preconditions');

const sha = local('git', ['rev-parse', 'HEAD']).trim();
const short = sha.slice(0, 12);
const dirty = local('git', ['status', '--porcelain']).trim();

if (dirty.length > 0 && !yes) {
  die(
    'the working tree is dirty. `git archive` ships HEAD, so uncommitted changes would ' +
      'NOT be deployed and the recorded commit would describe something else.\n\n' +
      dirty
        .split('\n')
        .map((line) => `    ${line}`)
        .join('\n') +
      '\n\n  Commit them, or pass --yes if you genuinely mean to deploy HEAD.',
  );
}

console.log(`  commit   ${sha}`);
console.log(`  branch   ${local('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim()}`);
console.log(`  host     ${host}:${DIR}`);

try {
  remote('true');
} catch {
  die(`cannot reach ${host} over ssh.`);
}

if (remote('id -u').trim() === '0') {
  die(
    `${host} logs in as root. A root deploy leaves a root-owned tree that the next ` +
      'deploy cannot overwrite. Use the `deploy` user.',
  );
}

if (remote(`test -d ${DIR} && test -w ${DIR} && echo ok || echo missing`).trim() !== 'ok') {
  die(`${DIR} does not exist or is not writable by the ssh user. See docs/runbooks/cherry-as.md.`);
}

for (const file of ENV_FILES) {
  const mode = remote(`stat -c '%a' ${DIR}/${file} 2>/dev/null || echo missing`).trim();
  if (mode === 'missing') die(`${DIR}/${file} is missing. See docs/runbooks/cherry-as.md.`);
  if (mode !== '600') die(`${DIR}/${file} is mode ${mode}; it holds secrets and must be 600.`);
}
console.log(`  secrets  ${ENV_FILES.join(', ')} present, mode 600`);

const previous = remote(`cat ${DIR}/DEPLOYED_COMMIT 2>/dev/null || echo none`).trim();
console.log(`  running  ${previous}`);

const free = remote(`df -BG --output=avail ${DIR} | tail -1`).trim();
console.log(`  disk     ${free} free`);
if (Number.parseInt(free, 10) < 8) {
  die(`only ${free} free. A build needs headroom; try \`docker builder prune -af\` on the host.`);
}

// ── 1. Ship the tree ──────────────────────────────────────────────────────
step(1, 'Ship the tracked tree');

remote(`cp ${DIR}/DEPLOYED_COMMIT ${DIR}/DEPLOYED_COMMIT.prev 2>/dev/null || true`);
const archive = execSync('git archive --format=tar HEAD', {
  maxBuffer: 256 * 1024 * 1024,
  encoding: 'buffer',
});
execFileSync(SSH, [host, `tar -xf - -C ${DIR}`], { input: archive });
console.log('  extracted');

// ── 2. The tar never deletes ──────────────────────────────────────────────
step(2, 'Remove files no longer tracked');

const SWEPT = ['apps', 'packages', 'tools', 'deploy'];
const expected = new Set(
  local('git', ['ls-files'])
    .split('\n')
    .filter((path) => SWEPT.some((top) => path.startsWith(`${top}/`))),
);
const stale = remote(`cd ${DIR} && find ${SWEPT.join(' ')} -type f 2>/dev/null || true`)
  .split('\n')
  .map((line) => line.trim())
  .filter((path) => path.length > 0 && !expected.has(path));

if (stale.length === 0) {
  console.log('  none');
} else {
  for (const path of stale) console.log(`  removing ${path}`);
  remote(`cd ${DIR} && rm -f ${stale.map(quote).join(' ')}`);
}

// ── 3. The stack as the host will compose it ──────────────────────────────
step(3, 'Read the composed stack');

const composed = JSON.parse(remote(`cd ${DIR} && ${COMPOSE} config --format json`));
const project = composed.name;
if (typeof project !== 'string' || project.length === 0) die('compose reports no project name.');
const image = (service, tag) => `${project}-${service}:${tag}`;
console.log(`  project  ${project}`);

// Before anything starts: a public binding is on the internet the moment `up` returns.
const publicPorts = Object.values(composed.services ?? {})
  .flatMap((service) => service.ports ?? [])
  .filter((port) => !['127.0.0.1', '::1'].includes(port.host_ip ?? '0.0.0.0'));
if (publicPorts.length > 0) {
  die(`${publicPorts.length} port(s) published on a public interface. Nothing here may be.`);
}
console.log('  public port bindings: 0');

// ── 4. Build every image ──────────────────────────────────────────────────
step(4, 'Build every image');

remote(
  `cd ${DIR} && GIT_COMMIT=${short} ${COMPOSE} --profile tools build${noCache ? ' --no-cache' : ''} ` +
    BUILT_SERVICES.join(' '),
  { stdio: 'inherit' },
);

for (const service of BUILT_SERVICES) {
  const revision = remote(
    `docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' ` +
      image(service, 'latest'),
  ).trim();
  if (revision !== short) {
    die(`${image(service, 'latest')} is labelled '${revision}', expected '${short}'.`);
  }
  remote(`docker tag ${image(service, 'latest')} ${image(service, short)}`);
  console.log(`  ${service.padEnd(10)} ${short}`);
}

// ── 5. Migrate ────────────────────────────────────────────────────────────
step(5, 'Apply migrations');

// The image built and label-checked in step 4 (`--pull never`: that one, no
// other). It refuses if the database knows a migration it does not, and checks
// every migration it carries is applied afterwards.
remote(`cd ${DIR} && ${COMPOSE} --profile tools run --rm --pull never migrate`, {
  stdio: 'inherit',
});

// ── 6. Bring it up ────────────────────────────────────────────────────────
step(6, 'Bring the stack up');

remote(`cd ${DIR} && ${COMPOSE} up -d --no-build --wait --wait-timeout 180`, {
  stdio: 'inherit',
});
// Recorded once the stack is up, not once verified: a failed step 7 has still
// replaced what was running, and the next operator needs to know with what.
remote(`echo ${sha} > ${DIR}/DEPLOYED_COMMIT`);

// ── 7. Prove it ───────────────────────────────────────────────────────────
step(7, 'Verify inside the stack');

const running = remote(
  `cd ${DIR} && docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' ` +
    `$(${COMPOSE} ps -q web)`,
).trim();
console.log(`  web runs ${running}`);
if (running !== short) die(`the running web container is from '${running}', not ${short}.`);

let ready = '';
for (let waited = 0; waited < 60; waited += 3) {
  ready = remote(
    `cd ${DIR} && ${COMPOSE} exec -T web wget -qO- http://127.0.0.1:3000/health/ready 2>/dev/null || true`,
  ).trim();
  if (ready.includes('"ready"')) break;
  remote('sleep 3');
}
console.log(`  /health/ready -> ${ready || '(no answer)'}`);
if (!ready.includes('"ready"')) die('web is up but not ready (database unreachable?).');

// ── 8. The public site in the shared Caddy ────────────────────────────────
step(8, 'Install the Caddy site');

const site = readFileSync('deploy/caddy/community.caddy', 'utf8');
const installed = remote(`cat ${CADDY_SITES}/${SITE_FILE} 2>/dev/null || true`);

if (installed === site) {
  console.log(`  ${SITE_FILE} unchanged`);
} else {
  remote(
    `cp ${CADDY_SITES}/${SITE_FILE} ${DIR}/${SITE_FILE}.prev 2>/dev/null || true; ` +
      `cp ${DIR}/deploy/caddy/${SITE_FILE} ${CADDY_SITES}/${SITE_FILE}`,
  );
  try {
    // Validate the WHOLE config: a broken site file takes down every supplier
    // stack on this host at the next reload, not just ours.
    remote(
      'docker exec pocket-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile',
    );
  } catch {
    remote(
      `if [ -f ${DIR}/${SITE_FILE}.prev ]; then cp ${DIR}/${SITE_FILE}.prev ${CADDY_SITES}/${SITE_FILE}; ` +
        `else rm -f ${CADDY_SITES}/${SITE_FILE}; fi`,
    );
    die(`Caddy rejected ${SITE_FILE}; the previous version was restored and Caddy not reloaded.`);
  }
  remote('docker exec pocket-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile');
  console.log(`  ${SITE_FILE} installed, validated, Caddy reloaded`);
}

// ── 9. From the outside ───────────────────────────────────────────────────
step(9, 'Check the public URL');

try {
  const body = execFileSync('curl', ['-fsS', '--max-time', '20', `${PUBLIC_URL}/health/live`], {
    encoding: 'utf8',
  });
  console.log(`  ${PUBLIC_URL}/health/live -> ${body.trim()}`);
  if (!body.includes(short)) console.log(`  WARNING: the public answer does not name ${short}.`);
} catch {
  // Not a refusal: the stack is verified from inside. Until DNS points here and
  // Caddy has its certificate, the public check cannot pass.
  console.log(`  ${PUBLIC_URL} did not answer yet (DNS or certificate pending?). Recheck by hand.`);
}

console.log(`\nOK: ${host} is running ${short} (previously ${previous}).`);
if (previous !== 'none') {
  const previousShort = previous.slice(0, 12);
  const previousServices = APP_SERVICES.filter(
    (service) =>
      remote(
        `docker image inspect ${image(service, previousShort)} >/dev/null 2>&1 && echo yes || echo no`,
      ).trim() === 'yes',
  );
  const line = rollbackCommand({
    host,
    dir: DIR,
    compose: COMPOSE,
    image,
    previousShort,
    services: APP_SERVICES,
    previousServices,
  });
  console.log(
    'Rollback (retags the previous images, stops services new in this release; does NOT undo migrations):\n' +
      `  ${line}`,
  );
}
