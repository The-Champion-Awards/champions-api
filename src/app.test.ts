import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

describe('createApp', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(createApp()).get('/does-not-exist');

    expect(res.status).toBe(404);
  });

  it('does not advertise Express in response headers', async () => {
    const res = await request(createApp()).get('/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
