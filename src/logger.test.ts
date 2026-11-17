import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.js';
import { createLogger } from './logger.js';

describe('createLogger', () => {
  it('uses the configured LOG_LEVEL', () => {
    expect(createLogger(loadConfig({ LOG_LEVEL: 'debug' })).level).toBe('debug');
  });
});
