import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { BUILT_SERVICES } from './images.mjs';

/** Top-level services in docker-compose.yml that have a `build:` key. */
function servicesWithBuild(yaml) {
  const lines = yaml.split('\n');
  const start = lines.findIndex((line) => line === 'services:');
  const built = [];
  let current;
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break; // next top-level key
    const service = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (service) current = service[1];
    else if (current && /^ {4}build:/.test(line)) built.push(current);
  }
  return built.sort();
}

test('images.mjs names exactly the services docker-compose.yml builds', () => {
  const yaml = readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8');
  assert.deepEqual([...BUILT_SERVICES].sort(), servicesWithBuild(yaml));
});
