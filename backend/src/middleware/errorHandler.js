// Centralised error handling.
//
// Controllers used to each carry their own try/catch that flattened every
// failure into a 500. That turned ordinary client mistakes — a malformed id in
// the URL, a duplicate email — into "Server error", which is both wrong for the
// caller and noisy for us. Wrapping handlers in asyncHandler lets them throw (or
// reject) and translates the error once, here.

/**
 * Wraps an async route handler so a rejected promise reaches Express instead of
 * becoming an unhandled rejection and hanging the request.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * An error carrying an intended HTTP status. Anything thrown without one is
 * treated as an unexpected failure and reported as a generic 500.
 */
class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

/** Mounted after all routes: nothing matched, so the route does not exist. */
function notFound(req, res) {
  res.status(404).json({ success: false, message: 'Route not found' });
}

/* eslint-disable no-unused-vars */ // Express identifies error handlers by arity
function errorHandler(err, req, res, next) {
  let status = err.status || err.statusCode || 500;
  let message = 'Internal Server Error';
  let details;

  // `instanceof`, not a duck-typed flag: an earlier version marked these with
  // `err.expected = true`, which collided with body-parser's PayloadTooLargeError
  // — that carries its own numeric `expected` property (the byte count). Any
  // error happening to have that field would have had its raw message echoed to
  // the client, which is exactly what the generic-500 path exists to prevent.
  if (err instanceof AppError) {
    // Deliberately raised by our own code — the message is safe to surface.
    message = err.message;
  } else if (err.name === 'CastError') {
    // e.g. GET /api/topics/not-an-id. A bad id from the client, not our fault.
    status = 400;
    message = `Invalid value for '${err.path}'`;
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    details = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message
    }));
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    message = `That ${field} is already taken`;
  } else if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token expired';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body too large';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON in request body';
  } else if (err.name === 'MulterError') {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Image is too large (max 5MB)'
      : 'Image upload failed — please try a different file';
  } else if (status < 500) {
    // Something upstream already classified this as a client error.
    message = err.message;
  }

  // Only genuine server faults are worth a stack trace in the logs.
  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  const body = { success: false, message };
  if (details) body.details = details;
  // Never leak internals in production — the generic message above stands.
  if (process.env.NODE_ENV !== 'production' && status >= 500) {
    body.error = err.message;
    body.stack = err.stack;
  }

  res.status(status).json(body);
}

module.exports = { asyncHandler, AppError, notFound, errorHandler };
