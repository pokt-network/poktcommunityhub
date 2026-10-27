import { Writable } from 'node:stream';

import { pino } from 'pino';
import { describe, expect, it } from 'vitest';

import { REDACTED_KEYS } from './logger.js';

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk));
      done();
    },
  });
  // Same redact config createLogger uses, pointed at a stream we can read.
  const logger = pino(
    {
      redact: {
        paths: REDACTED_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
        censor: '[redacted]',
      },
    },
    stream,
  );
  return { logger, lines };
}

describe('logger redaction', () => {
  it('censors secret keys at the top level and when nested', () => {
    const { logger, lines } = capture();
    logger.info({
      token: 'tok-1',
      req: { cookie: 'c-1', headers: { authorization: 'Bearer b-1' } },
    });
    const out = lines.join('');
    for (const secret of ['tok-1', 'c-1', 'Bearer b-1']) expect(out).not.toContain(secret);
    expect(out).toContain('[redacted]');
  });
});
