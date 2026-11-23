import { describe, expect, it } from 'vitest';

import { HttpError } from './http-error.js';

// Unit tests: the class on its own, no Express or HTTP involved.
describe('HttpError', () => {
  it('keeps the status, code, and message it was given', () => {
    const err = new HttpError(404, 'not_found', 'Bracket not found');

    expect(err.status).toBe(404);
    expect(err.code).toBe('not_found');
    expect(err.message).toBe('Bracket not found');
  });

  it('is a real Error, so it has a stack trace and works with instanceof', () => {
    const err = new HttpError(400, 'bad_request', 'Missing name');

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.name).toBe('HttpError');
    expect(err.stack).toBeDefined();
  });

  // Checked by the compiler (`npm run typecheck`), not when the test runs:
  // `@ts-expect-error` fails the typecheck if the line below it compiles.
  it('only accepts listed error statuses', () => {
    // @ts-expect-error 4040 is not an ErrorStatus
    new HttpError(4040, 'not_found', 'Typo');
  });
});
