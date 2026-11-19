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

  describe('request logging', () => {
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

    it('hides credential headers in the request log', async () => {
      const { logger, lines } = captureLogger();

      await request(createApp(logger))
        .get('/health')
        .set('Authorization', 'Bearer secret-token')
        .set('Cookie', 'session=secret-session')
        .set('Accept', 'application/json');

      const line = await vi.waitFor(() => {
        const found = lines.find((l) => l.msg === 'request completed');
        expect(found).toBeDefined();
        return found;
      });

      expect(line).toMatchObject({
        req: {
          headers: {
            authorization: '[Redacted]',
            cookie: '[Redacted]',
            // Ordinary headers are still logged as sent.
            accept: 'application/json',
          },
        },
      });
    });
  });

  describe('request IDs', () => {
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

    it('generates one, sends it back, and logs it', async () => {
      const { logger, lines } = captureLogger();

      const res = await request(createApp(logger)).get('/health');

      const id = res.headers['x-request-id'];
      expect(id).toMatch(UUID);
      const line = await vi.waitFor(() => {
        const found = lines.find((l) => l.msg === 'request completed');
        expect(found).toBeDefined();
        return found;
      });
      expect(line).toMatchObject({ req: { id } });
    });

    it('reuses a valid incoming X-Request-Id', async () => {
      const res = await request(createApp(silentLogger))
        .get('/health')
        .set('X-Request-Id', 'lb-trace_42');

      expect(res.headers['x-request-id']).toBe('lb-trace_42');
    });

    it('reuses an incoming X-Request-Id at the 128-character limit', async () => {
      const longest = 'a'.repeat(128);

      const res = await request(createApp(silentLogger))
        .get('/health')
        .set('X-Request-Id', longest);

      expect(res.headers['x-request-id']).toBe(longest);
    });

    it.each([
      ['is empty', ''],
      ['is too long', 'a'.repeat(129)],
      ['has disallowed characters', 'bad id; drop table'],
      // A header sent twice reaches us as one value, joined by Node with ", ".
      ['was sent twice', 'abc, xyz'],
    ])('replaces an incoming X-Request-Id that %s', async (_reason, incoming) => {
      const res = await request(createApp(silentLogger))
        .get('/health')
        .set('X-Request-Id', incoming);

      expect(res.headers['x-request-id']).toMatch(UUID);
    });
  });
});
