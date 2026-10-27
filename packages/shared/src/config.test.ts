import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ConfigError, loadConfig, originUrl, postgresUrl, requiredString } from './config.js';

const schema = z.object({
  DATABASE_URL: postgresUrl,
  PUBLIC_BASE_URL: originUrl,
  AUTH_SECRET: requiredString,
});

const valid = {
  DATABASE_URL: 'postgres://u:hunter2@db:5432/community',
  PUBLIC_BASE_URL: 'https://community.pocket.network/',
  AUTH_SECRET: 'x'.repeat(32),
};

describe('loadConfig', () => {
  it('parses a valid environment and normalises the origin', () => {
    const config = loadConfig(schema, valid);
    expect(config.PUBLIC_BASE_URL).toBe('https://community.pocket.network');
  });

  it('treats an empty string as unset', () => {
    expect(() => loadConfig(schema, { ...valid, AUTH_SECRET: '   ' })).toThrow(ConfigError);
  });

  it('names every bad variable at once', () => {
    try {
      loadConfig(schema, { DATABASE_URL: 'mysql://nope' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const problems = (error as ConfigError).problems.join('\n');
      expect(problems).toContain('DATABASE_URL');
      expect(problems).toContain('PUBLIC_BASE_URL');
      expect(problems).toContain('AUTH_SECRET');
    }
  });

  it('never puts a value in the error, because values are secrets', () => {
    try {
      loadConfig(schema, { ...valid, DATABASE_URL: 'mysql://u:hunter2@db/x' });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain('hunter2');
    }
  });
});
