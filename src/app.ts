import express, { type Express } from 'express';

import { healthRouter } from './routes/health.routes.js';

/**
 * Builds the Express app without starting a server, so tests can send requests
 * to it directly (Supertest) and `server.ts` stays the only place that listens.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.use('/health', healthRouter);

  return app;
}
