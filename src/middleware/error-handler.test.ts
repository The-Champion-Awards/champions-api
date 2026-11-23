import express, { type Request, type RequestHandler, type Response } from 'express';
import { type Logger, pino } from 'pino';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { HttpError } from '../http-error.js';
import { captureLogger } from '../test-helpers/capture-logger.js';
import { errorHandler, notFound } from './error-handler.js';

const silentLogger = pino({ level: 'silent' });

/**
 * A small app set up like the real one (pino-http first, the error handlers
 * last). A test can pass a `route` that throws whatever error it needs; it's
 * served at `/test`. Logs go nowhere unless a test passes its own `logger`.
 */
function testApp(route?: RequestHandler, logger: Logger = silentLogger) {
  const app = express();

  app.use(pinoHttp({ logger, genReqId: () => 'test-request-id' }));
  app.use(express.json());
  if (route) app.all('/test', route);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

// Integration tests: real HTTP requests (via Supertest) through Express,
// pino-http, and the error handlers working together.
describe('notFound and errorHandler, through a real request', () => {
  it('returns 404 JSON for unknown routes', async () => {
    const res = await request(testApp()).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'not_found',
        message: 'No route for GET /does-not-exist',
        requestId: 'test-request-id',
      },
    });
  });

  it("sends an HttpError's own status, code, and message", async () => {
    const app = testApp(() => {
      throw new HttpError(409, 'conflict', 'That list already exists');
    });

    const res = await request(app).get('/test');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: {
        code: 'conflict',
        message: 'That list already exists',
        requestId: 'test-request-id',
      },
    });
  });

  it('hides a crash behind a generic 500', async () => {
    const app = testApp(() => {
      throw new Error('connect ECONNREFUSED 10.0.3.7:5432');
    });

    const res = await request(app).get('/test');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: 'internal_error',
        message: 'Something went wrong',
        requestId: 'test-request-id',
      },
    });
  });

  it('sends a 400 for malformed JSON instead of a 500', async () => {
    // No route needed: express.json() rejects the body before any route runs.
    const res = await request(testApp())
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{bad');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'invalid_request',
        // The exact wording comes from Node's JSON parser and varies by version.
        message: expect.stringContaining('JSON') as string,
        requestId: 'test-request-id',
      },
    });
  });

  it('sends a 500 for an HttpError whose status is not an error', async () => {
    const app = testApp(() => {
      // @ts-expect-error 200 isn't an ErrorStatus; this simulates a bad status slipping past the types
      throw new HttpError(200, 'ok', 'Looks fine');
    });

    const res = await request(app).get('/test');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: 'internal_error',
        message: 'Something went wrong',
        requestId: 'test-request-id',
      },
    });
  });

  it("logs a crash's real error, even though the client never sees it", async () => {
    const { logger, lines } = captureLogger();
    const app = testApp(() => {
      throw new Error('connect ECONNREFUSED 10.0.3.7:5432');
    }, logger);

    await request(app).get('/test');

    // The log line is written when the response finishes, which can land just
    // after Supertest hands back the response, so wait for it.
    const line = await vi.waitFor(() => {
      const found = lines.find((l) => l.msg === 'request errored');
      expect(found).toBeDefined();
      return found;
    });

    expect(line).toMatchObject({
      res: { statusCode: 500 },
      err: {
        message: 'connect ECONNREFUSED 10.0.3.7:5432',
        stack: expect.stringContaining('connect ECONNREFUSED') as string,
      },
    });
  });

  it('still sends a 500 and logs a real error when a route throws a non-Error', async () => {
    const { logger, lines } = captureLogger();
    const app = testApp(() => {
      // JavaScript lets code throw any value; some libraries throw plain strings.
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- on purpose
      throw 'oops';
    }, logger);

    const res = await request(app).get('/test');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: 'internal_error',
        message: 'Something went wrong',
        requestId: 'test-request-id',
      },
    });

    const line = await vi.waitFor(() => {
      const found = lines.find((l) => l.msg === 'request errored');
      expect(found).toBeDefined();
      return found;
    });

    // errorHandler wrapped the string in an Error, so the log has a real error.
    expect(line).toMatchObject({ err: { type: 'Error', message: 'oops' } });
  });
});

// Unit test: calls errorHandler directly with stand-in (fake) request and
// response objects, because a real response that's already half-sent looks
// the same to the client whether or not this check exists.
describe('errorHandler, called directly', () => {
  it('hands the error to Express when the response has already started', () => {
    const err = new Error('database died');
    const status = vi.fn(); // records whether errorHandler tried to send a response
    const res = { headersSent: true, status } as unknown as Response;
    const next = vi.fn(); // records what errorHandler passed on

    errorHandler(err, {} as unknown as Request, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(status).not.toHaveBeenCalled();
  });
});
