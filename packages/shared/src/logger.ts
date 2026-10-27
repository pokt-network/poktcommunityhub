import { pino, type Logger, type LoggerOptions } from 'pino';

/**
 * Keys that never reach a log line, wherever they appear in a logged object.
 * Listed by name so a new secret has to be added deliberately; the config
 * loader's errors already omit values, this covers everything else.
 */
export const REDACTED_KEYS = [
  'password',
  'secret',
  'token',
  'authorization',
  'cookie',
  'databaseUrl',
  'DATABASE_URL',
  'AUTH_SECRET',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_BOT_TOKEN',
  'SETTINGS_ENCRYPTION_KEY',
  'webhookUrl',
] as const;

export function createLogger(options: { name: string; level?: string }): Logger {
  const config: LoggerOptions = {
    name: options.name,
    level: options.level ?? 'info',
    redact: {
      paths: REDACTED_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
      censor: '[redacted]',
    },
    base: { app: options.name, commit: process.env['APP_COMMIT'] ?? 'unknown' },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  return pino(config);
}

export type { Logger };
