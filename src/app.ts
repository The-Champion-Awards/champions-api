import express, { type Express } from 'express';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';

import { healthRouter } from './routes/health.routes.js';

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
  app.use(pinoHttp({ logger }));
  app.use(express.json());

  app.use('/health', healthRouter);

  return app;
}
