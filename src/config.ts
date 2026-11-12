import { z } from 'zod';

// Every environment variable the app reads, with its type and default. Values
// arrive as strings, so numbers are coerced. Add new variables here and to
// `.env.example`.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export type Config = z.infer<typeof envSchema>;

/**
 * Validates the environment and returns typed config. Throws on anything missing
 * or invalid, so a bad deploy fails at startup instead of on the first request
 * that needs the value.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
}
