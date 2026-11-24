import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.js';

// The minimum environment loadConfig accepts. Each test adds or overrides one
// variable, so a failure is about that variable and nothing else.
const required = { DATABASE_URL: 'postgres://champions:champions@localhost:5432/champions' };

describe('loadConfig', () => {
  it('applies defaults when optional variables are unset', () => {
    expect(loadConfig(required)).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'info',
      DATABASE_URL: required.DATABASE_URL,
    });
  });

  it('coerces PORT from a string to a number', () => {
    expect(loadConfig({ ...required, PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a PORT that is not a number', () => {
    expect(() => loadConfig({ ...required, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('rejects a PORT that is not a whole number', () => {
    expect(() => loadConfig({ ...required, PORT: '3000.5' })).toThrow(/PORT/);
  });

  it('rejects a PORT below the valid range', () => {
    expect(() => loadConfig({ ...required, PORT: '-5' })).toThrow(/PORT/);
  });

  it('rejects a PORT above the valid range', () => {
    expect(() => loadConfig({ ...required, PORT: '70000' })).toThrow(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => loadConfig({ ...required, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('rejects an unknown LOG_LEVEL', () => {
    expect(() => loadConfig({ ...required, LOG_LEVEL: 'verbose' })).toThrow(/LOG_LEVEL/);
  });

  // Both spellings are standard for Postgres URLs.
  it.each(['postgres://joe@localhost:5432/champions', 'postgresql://joe@localhost:5432/champions'])(
    'accepts the database URL %s',
    (url) => {
      expect(loadConfig({ DATABASE_URL: url }).DATABASE_URL).toBe(url);
    },
  );

  it('rejects a missing DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  // Startup errors are printed and end up in the logs, so they must name the
  // bad variable without repeating its value, which may contain a password.
  it('names DATABASE_URL in the error without repeating its password', () => {
    const badUrl = 'mysql://admin:SuperSecret123@db:3306/champions';

    expect(() => loadConfig({ DATABASE_URL: badUrl })).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ DATABASE_URL: badUrl })).not.toThrow(/SuperSecret123/);
  });

  it.each([
    ['is not a URL', 'not a url'],
    ['is not a Postgres URL', 'mysql://user@localhost:3306/champions'],
    ['has no host', 'postgres://'],
  ])('rejects a DATABASE_URL that %s', (_reason, url) => {
    expect(() => loadConfig({ DATABASE_URL: url })).toThrow(/DATABASE_URL/);
  });
});
