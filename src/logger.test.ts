import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.js';
import { createLogger } from './logger.js';

describe('createLogger', () => {
  it('uses the configured LOG_LEVEL', () => {
    const config = loadConfig({
      LOG_LEVEL: 'debug',
      DATABASE_URL: 'postgres://champions:champions@localhost:5432/champions',
    });

    expect(createLogger(config).level).toBe('debug');
  });
});
