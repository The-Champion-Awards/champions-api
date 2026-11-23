import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import express, { type Express } from 'express';
import type { Level, Logger } from 'pino';
import { pinoHttp } from 'pino-http';

import { errorHandler, notFound } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.routes.js';

// Incoming IDs come from the client, so only short, plain values are trusted.
const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Picks the ID that ties together every log line for one request. Reuses the
 * caller's `X-Request-Id` (e.g. from a load balancer) when it looks valid,
 * otherwise generates one, and sends it back so clients can report it.
 */
function requestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();

  res.setHeader('X-Request-Id', id);
  return id;
}

// Headers that carry credentials. Request log lines show them as "[Redacted]"
// so anyone who can read the logs can't reuse a user's token or session.
const REDACTED_HEADERS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

/**
 * Picks the level for each request's log line. pino-http logs every request at
 * `info` by default, even a crash, so log searches and alerts that filter by
 * level couldn't tell a bug from a healthy request.
 */
export function logLevel(_req: IncomingMessage, res: ServerResponse, err?: Error): Level {
  if (err || res.statusCode >= 500) return 'error'; // our bug
  if (res.statusCode >= 400) return 'warn'; // the client's mistake
  return 'info';
}

/**
 * Builds the Express app without starting a server, so tests can send requests
 * to it directly (Supertest) and `server.ts` stays the only place that listens.
 *
 * The logger is passed in rather than created here, so the app shares the one
 * `server.ts` builds and tests can pass a silent one.
 */
export function createApp(logger: Logger): Express {
  const app = express();

  app.disable('x-powered-by');
  // First, so it sees every request; writes one log line when each response finishes.
  app.use(
    pinoHttp({ logger, genReqId: requestId, redact: REDACTED_HEADERS, customLogLevel: logLevel }),
  );
  app.use(express.json());

  app.use('/health', healthRouter);

  // Last, so they only run when no route matched or something threw.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
