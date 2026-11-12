import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('applies defaults when variables are unset', () => {
    expect(loadConfig({})).toEqual({ NODE_ENV: 'development', PORT: 3000 });
  });

  it('coerces PORT from a string to a number', () => {
    expect(loadConfig({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a PORT that is not a number', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT/);
  });

  it('rejects a PORT that is not a whole number', () => {
    expect(() => loadConfig({ PORT: '3000.5' })).toThrow(/PORT/);
  });

  it('rejects a PORT below the valid range', () => {
    expect(() => loadConfig({ PORT: '-5' })).toThrow(/PORT/);
  });

  it('rejects a PORT above the valid range', () => {
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => loadConfig({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});
