import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rollbackCommand } from './rollback.mjs';

const base = {
  host: 'cherry-as',
  dir: '/opt/pocket/services/community',
  compose: 'docker compose',
  image: (service, tag) => `p-${service}:${tag}`,
  previousShort: 'abc123',
  services: ['web', 'worker'],
};

test('retags every service the previous release had', () => {
  const line = rollbackCommand({ ...base, previousServices: ['web', 'worker'] });
  assert.match(line, /docker tag p-web:abc123 p-web:latest/);
  assert.match(line, /docker tag p-worker:abc123 p-worker:latest/);
  assert.match(line, /docker compose up -d --no-build web worker &&/);
  assert.doesNotMatch(line, / rm -sf/);
});

test('stops a service that is new in this release instead of retagging it', () => {
  const line = rollbackCommand({ ...base, previousServices: ['web'] });
  assert.doesNotMatch(line, /p-worker:abc123/);
  assert.match(line, /docker compose rm -sf worker/);
  // Named, so `up` does not start the new worker again from the compose file.
  assert.match(line, /docker compose up -d --no-build web &&/);
  assert.ok(line.indexOf('rm -sf') < line.indexOf('up -d'));
});

test('ends by restoring the deployed-commit marker', () => {
  const line = rollbackCommand({ ...base, previousServices: ['web'] });
  assert.match(line, /^ssh cherry-as "cd \/opt\/pocket\/services\/community && /);
  assert.match(line, /&& cp DEPLOYED_COMMIT.prev DEPLOYED_COMMIT"$/);
});
