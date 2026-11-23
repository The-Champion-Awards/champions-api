import { pino } from 'pino';

/**
 * A logger that saves each log line as an object in `lines` instead of printing
 * it, so a test can check what was logged.
 */
export function captureLogger() {
  const lines: Record<string, unknown>[] = [];
  const logger = pino(
    {},
    {
      write: (line: string) => {
        lines.push(JSON.parse(line) as Record<string, unknown>);
      },
    },
  );

  return { logger, lines };
}
