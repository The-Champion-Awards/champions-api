import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import express, { type Express } from 'express';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';

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
  app.use(pinoHttp({ logger, genReqId: requestId }));
  app.use(express.json());

  app.use('/health', healthRouter);

  return app;
}
