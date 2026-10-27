import { z } from 'zod';

/**
 * Thrown when the environment does not satisfy a config schema.
 *
 * The message names each bad variable and what is wrong with it, never its
 * value: half of these are secrets, and a boot failure is exactly the error that
 * ends up pasted into a chat.
 */
export class ConfigError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Invalid configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

/** Unset and empty are the same thing; an empty slot is never a value. */
const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** A required, non-empty string. */
export const requiredString = z.preprocess(blankToUndefined, z.string().min(1));

/** A required absolute http(s) URL with no trailing slash. */
export const originUrl = z.preprocess(
  blankToUndefined,
  z
    .url({ protocol: /^https?$/, error: 'must be an http(s) URL' })
    .transform((value) => value.replace(/\/+$/, '')),
);

/** A required postgres:// connection string. */
export const postgresUrl = z.preprocess(
  blankToUndefined,
  z
    .string()
    .refine(
      (value) => /^postgres(ql)?:\/\//.test(value),
      'must be a postgres:// connection string',
    ),
);

export const logLevel = z.preprocess(
  blankToUndefined,
  z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
);

/**
 * Parse `env` against `schema`. Fails closed: any problem throws, and the caller
 * is expected to let it crash the process rather than run half-configured.
 */
export function loadConfig<S extends z.ZodType>(
  schema: S,
  env: Record<string, string | undefined> = process.env,
): z.output<S> {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new ConfigError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  return result.data;
}
