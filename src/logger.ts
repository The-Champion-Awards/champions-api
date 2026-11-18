import { pino, type Logger } from 'pino';

import type { Config } from './config.js';

/**
 * Builds the app's logger. Logs are JSON lines on stdout; in production the
 * platform (e.g. CloudWatch) collects them.
 */
export function createLogger(config: Config): Logger {
  return pino({ level: config.LOG_LEVEL });
}
