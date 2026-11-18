import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from './app.js';

const silentLogger = pino({ level: 'silent' });

/**
 * A logger that saves each log line as an object in `lines` instead of printing
 * it, so a test can check what was logged.
 */
function captureLogger() {
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

describe('createApp', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(createApp(silentLogger)).get('/does-not-exist');

    expect(res.status).toBe(404);
  });

  it('does not advertise Express in response headers', async () => {
    const res = await request(createApp(silentLogger)).get('/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('logs each request with its method, URL, and status', async () => {
    const { logger, lines } = captureLogger();

    await request(createApp(logger)).get('/health');

    // The log line is written when the response finishes, which can land just
    // after Supertest hands back the response, so wait for it.
    const line = await vi.waitFor(() => {
      const found = lines.find((l) => l.msg === 'request completed');
      expect(found).toBeDefined();
      return found;
    });

    expect(line).toMatchObject({
      req: { method: 'GET', url: '/health' },
      res: { statusCode: 200 },
    });
  });
});
