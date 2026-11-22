import type { IncomingMessage, ServerResponse } from 'node:http';

import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp, logLevel } from './app.js';
import { captureLogger } from './test-helpers/capture-logger.js';

const silentLogger = pino({ level: 'silent' });

describe('createApp', () => {
  it('returns 404 JSON for unknown routes, with the same request ID as the header', async () => {
    const res = await request(createApp(silentLogger)).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'not_found',
        message: 'No route for GET /does-not-exist',
        requestId: res.headers['x-request-id'],
      },
    });
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

    // The logLevel unit tests below check the levels themselves; this checks
    // that createApp actually hands logLevel to pino-http.
    it('logs client errors at warn level', async () => {
      const { logger, lines } = captureLogger();

      await request(createApp(logger)).get('/does-not-exist');

      const line = await vi.waitFor(() => {
        const found = lines.find((l) => l.msg === 'request completed');
        expect(found).toBeDefined();
        return found;
      });

      // pino writes levels as numbers: 30 = info, 40 = warn, 50 = error.
      expect(line).toMatchObject({ level: 40, res: { statusCode: 404 } });
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

// Unit tests: logLevel on its own, with fake requests and responses. (The real
// app has no route that crashes, so a 500 can't be produced through it.)
describe('logLevel', () => {
  const req = {} as unknown as IncomingMessage; // logLevel never reads the request

  /** A fake response with just the status code, the only field logLevel reads. */
  function responseWith(statusCode: number) {
    return { statusCode } as unknown as ServerResponse;
  }

  it('logs server errors (5xx) at error', () => {
    expect(logLevel(req, responseWith(500))).toBe('error');
  });

  it('logs client errors (4xx) at warn', () => {
    expect(logLevel(req, responseWith(404))).toBe('warn');
  });

  it('logs everything else at info', () => {
    expect(logLevel(req, responseWith(200))).toBe('info');
  });

  // Boundary values: the last and first status on each side of a cutoff, where
  // an off-by-one mistake (`>` instead of `>=`) would show up.
  it('switches levels exactly at 400 and 500', () => {
    expect(logLevel(req, responseWith(399))).toBe('info');
    expect(logLevel(req, responseWith(400))).toBe('warn');
    expect(logLevel(req, responseWith(499))).toBe('warn');
    expect(logLevel(req, responseWith(500))).toBe('error');
  });

  it('logs at error whenever pino-http passes an error, whatever the status', () => {
    expect(logLevel(req, responseWith(200), new Error('stream broke'))).toBe('error');
  });
});
