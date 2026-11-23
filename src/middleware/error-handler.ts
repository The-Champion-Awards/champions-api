import type { ErrorRequestHandler, RequestHandler } from 'express';

import { HttpError } from '../http-error.js';

/** The JSON body of every error response. */
interface ErrorBody {
  error: {
    /** Stable, machine-readable name the client can branch on, e.g. `not_found`. */
    code: string;
    /** Human-readable explanation, safe to show to the user. */
    message: string;
    /** Same value as the `X-Request-Id` header, so a bug report can point to the log line. */
    requestId: string;
  };
}

/**
 * Registered after every route, so it only runs when nothing else matched.
 * Hands a 404 to `errorHandler` so unknown routes get the same JSON as any other error.
 */
export const notFound: RequestHandler = (req) => {
  throw new HttpError(404, 'not_found', `No route for ${req.method} ${req.path}`);
};

/**
 * Turns any error thrown by a route into a JSON response. Registered last.
 *
 * - `HttpError`: sent as-is, since its message was written for the client.
 * - A client error from Express's own middleware (e.g. malformed JSON from
 *   `express.json()`): sent with its status as `invalid_request`.
 * - Anything else is a bug: the client gets a generic 500 so internal details
 *   never leak, and the real error goes in the request's log line.
 */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, next) => {
  // Part of the response is already on its way, so we can't send a new status.
  // Express's default handler closes the connection instead.
  if (res.headersSent) {
    next(err);
    return;
  }

  const { status, code, message } = toResponse(err);

  if (status >= 500) {
    // pino-http logs this with the request's single log line, stack trace included.
    res.err = err instanceof Error ? err : new Error(String(err));
  }

  // pino-http types `req.id` loosely (string, number, or object), but our
  // `requestId()` in app.ts always returns a string.
  const body: ErrorBody = { error: { code, message, requestId: req.id as string } };
  res.status(status).json(body);
};

function toResponse(err: unknown): { status: number; code: string; message: string } {
  // An HttpError with a status that isn't an error (e.g. 200 or 999) is a bug in a route.
  if (err instanceof HttpError && isErrorStatus(err.status)) {
    return { status: err.status, code: err.code, message: err.message };
  }

  if (isExposedClientError(err)) {
    return { status: err.status, code: 'invalid_request', message: err.message };
  }

  return { status: 500, code: 'internal_error', message: 'Something went wrong' };
}

function isErrorStatus(status: number): boolean {
  return Number.isInteger(status) && status >= 400 && status <= 599;
}

/**
 * Express's middleware (via the `http-errors` package) marks errors that are
 * safe to show the client with `expose: true` and a 4xx `status`.
 *
 * `err is Error & { status: number }` is a type predicate, which makes this
 * function a type guard. It still returns true or false, but it also tells
 * the compiler what `true` means: "err is an Error that has a number status".
 * So wherever this is called in an `if`, the compiler lets the code inside
 * use `err.status`:
 *
 *   if (isExposedClientError(err)) {
 *     err.status; // allowed here
 *   }
 *
 * The compiler can't work this out on its own because of the 400–499 range
 * check, so the predicate has to be written by hand.
 */
function isExposedClientError(err: unknown): err is Error & { status: number } {
  return (
    err instanceof Error &&
    'expose' in err &&
    err.expose === true &&
    'status' in err &&
    typeof err.status === 'number' &&
    err.status >= 400 &&
    err.status <= 499
  );
}
