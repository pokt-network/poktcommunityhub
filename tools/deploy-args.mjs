/**
 * The command line of tools/deploy.mjs, parsed as a pure function so it can be
 * tested without an ssh host.
 *
 * Flags that take a value are stripped WITH their value, whatever is left is the
 * host, and a host starting with `-` is refused: otherwise `--dir /opt/x host`
 * deploys to a host called /opt/x, and `-oProxyCommand=...` goes straight to ssh
 * as an option. (Both holes were found in the Agentic Portal's first version.)
 */

const VALUE_FLAGS = ['dir'];
const BOOLEAN_FLAGS = ['yes', 'no-cache'];

export const DEFAULT_DIR = '/opt/pocket/services/community';

/**
 * @param {string[]} argv everything after the script name
 * @returns {{ host: string, dir: string, yes: boolean, noCache: boolean } | { error: string }}
 */
export function parseDeployArgs(argv) {
  const values = new Map();
  const flags = new Set();
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    const name = arg.slice(2);
    if (VALUE_FLAGS.includes(name)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--'))
        return { error: `--${name} needs a value.` };
      values.set(name, value);
      index += 1;
    } else if (BOOLEAN_FLAGS.includes(name)) {
      flags.add(name);
    } else {
      // Ignoring a typo like `--no-cach` would deploy with the cache the operator
      // had just asked not to use.
      return { error: `unknown flag ${arg}.` };
    }
  }

  if (positional.length === 0) return { error: 'missing <ssh-host>.' };
  if (positional.length > 1)
    return { error: `expected one <ssh-host>, got: ${positional.join(' ')}.` };

  const host = positional[0];
  if (host.startsWith('-'))
    return { error: `refusing host '${host}': it would be read as an ssh option.` };

  const dir = values.get('dir') ?? DEFAULT_DIR;
  // The directory is interpolated into remote shell commands; keep it boring.
  if (!/^\/[A-Za-z0-9._/-]+$/.test(dir))
    return { error: `refusing --dir '${dir}': absolute, plain characters only.` };

  return { host, dir, yes: flags.has('yes'), noCache: flags.has('no-cache') };
}
