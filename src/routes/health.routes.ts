import { Router } from 'express';

export const healthRouter = Router();

// Liveness check for load balancers, container platforms, and uptime monitors.
// Deliberately touches nothing else; a readiness check (database, Redis) comes later.
healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok' });
});
