import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../app.js';

const silentLogger = pino({ level: 'silent' });

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(createApp(silentLogger)).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
