/**
 * The error statuses routes may send. Listing them lets the compiler catch a
 * typo like `4040` in the editor; add a code here when a route needs a new one.
 */
export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500;

/**
 * An error a route throws on purpose to send a specific HTTP response, e.g.
 * `throw new HttpError(404, 'not_found', 'Bracket not found')`.
 *
 * The error handler in `middleware/error-handler.ts` turns it into a JSON body
 * using `code` and `message`. Any other error becomes a generic 500, so only
 * messages written for clients ever reach them.
 *
 * Routes throw this; services shouldn't, since they know nothing about HTTP.
 */
export class HttpError extends Error {
  constructor(
    /** HTTP status to send, e.g. 404. */
    readonly status: ErrorStatus,
    /** Stable, machine-readable name the client can branch on, e.g. `not_found`. */
    readonly code: string,
    /** Human-readable explanation, safe to show to the user. */
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
