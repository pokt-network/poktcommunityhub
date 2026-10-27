import 'server-only';

import { createLogger, type Logger } from '@community/shared';

let cached: Logger | undefined;

export function log(): Logger {
  // LOG_LEVEL read directly: logging must work even when the rest of the config does not.
  cached ??= createLogger({ name: 'community-web', level: process.env['LOG_LEVEL'] || 'info' });
  return cached;
}
