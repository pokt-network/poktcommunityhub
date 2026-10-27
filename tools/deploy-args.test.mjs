import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_DIR, parseDeployArgs } from './deploy-args.mjs';

test('host alone takes the default directory', () => {
  assert.deepEqual(parseDeployArgs(['cherry-as']), {
    host: 'cherry-as',
    dir: DEFAULT_DIR,
    yes: false,
    noCache: false,
  });
});

test('a flag value is never mistaken for the host', () => {
  const parsed = parseDeployArgs(['--dir', '/opt/x', 'cherry-as', '--yes']);
  assert.equal(parsed.host, 'cherry-as');
  assert.equal(parsed.dir, '/opt/x');
  assert.equal(parsed.yes, true);
});

test('refuses a host that ssh would read as an option', () => {
  assert.match(parseDeployArgs(['-oProxyCommand=evil']).error, /ssh option/);
});

test('refuses unknown flags, missing values, and extra hosts', () => {
  assert.match(parseDeployArgs(['cherry-as', '--no-cach']).error, /unknown flag/);
  assert.match(parseDeployArgs(['cherry-as', '--dir']).error, /needs a value/);
  assert.match(parseDeployArgs(['--dir', '--yes', 'cherry-as']).error, /needs a value/);
  assert.match(parseDeployArgs(['a', 'b']).error, /expected one/);
  assert.match(parseDeployArgs([]).error, /missing/);
});

test('refuses a directory that would need shell quoting', () => {
  assert.match(parseDeployArgs(['cherry-as', '--dir', '/opt/x; rm -rf /']).error, /refusing --dir/);
  assert.match(parseDeployArgs(['cherry-as', '--dir', 'relative']).error, /refusing --dir/);
});
