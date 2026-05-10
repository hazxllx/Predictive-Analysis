/**
 * Comprehensive Error Handling Middleware
 *
 * Centralized error handling that:
 * - Catches all operational and programming errors
 * - Maps Mongoose, MongoDB, and JWT errors to clean HTTP responses
 * - Logs errors with structured context (never leaks internals to client)
 * - Distinguishes between expected operational errors and unexpected crashes
 *
 * Error classes:
 * - AppError      : predictable operational errors (bad input, not found, forbidden)
 * - ValidationError: input validation failures with field-level detail
 *
 * Supported error mappings:
 * - Mongoose ValidationError -> 400 with field details
 * - Mongoose CastError       -> 400 (invalid ObjectId)
 * - MongoDB Duplicate Key    -> 409 with field hint
 * - JsonWebTokenError        -> 401
 * - TokenExpiredError        -> 401
 * - SyntaxError (bad JSON)   -> 400
 */

/**
 * Base class for operational errors we expect and handle gracefully
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation-specific error with field-level detail
 */
class ValidationError extends AppError {
  constructor(message, fields = []) {
    super(message, 400, "VALIDATION_ERROR");
    this.fields = fields;
  }
}

/**
 * Map known Mongoose/MongoDB error types to standard HTTP responses
 */
function mapDatabaseError(err) {
  // Mongoose validation error (schema constraints)
  if (err.name === "ValidationError") {
    const fields = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
      value: e.value,
    }));
    return new ValidationError("Validation failed", fields);
  }

  // Invalid ObjectId cast
  if (err.name === "CastError") {
    return new AppError(`Invalid ${err.path}: ${err.value}`, 400, "CAST_ERROR");
  }

  // MongoDB duplicate key (unique index violation)
  if (err.code === 11000 || err.code === 11001) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return new AppError(`${field} is already in use`, 409, "DUPLICATE_KEY");
  }

  return null;
}

/**
 * Map JWT errors to standard auth responses
 */
function mapJWTError(err) {
  if (err.name === "JsonWebTokenError") {
    return new AppError("Invalid token", 401, "INVALID_TOKEN");
  }
  if (err.name === "TokenExpiredError") {
    return new AppError("Token expired", 401, "TOKEN_EXPIRED");
  }
  return null;
}

/**
 * Map JSON parsing errors to clean 400 responses
 */
function mapSyntaxError(err) {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return new AppError("Invalid JSON in request body", 400, "INVALID_JSON");
  }
  return null;
}

/**
 * Build client-safe error response
 * Never includes stack traces or internal details in production
 */
function buildErrorResponse(err, isDev) {
  const base = {
    success: false,
    status: err.status || "error",
    message: err.isOperational ? err.message : "Something went wrong",
  };

  if (err.code) base.code = err.code;

  // Include field-level validation details for operational errors
  if (err.isOperational && err.fields && err.fields.length > 0) {
    base.errors = err.fields;
  }

  // Include stack trace only in development
  if (isDev && err.stack) {
    base.stack = err.stack.split("\n");
  }

  return base;
}

/**
 * Main error handling middleware (4-argument Express handler)
 *
 * Usage:
 *   app.use(errorHandler);
 *
 * Must be registered AFTER all routes and other middleware.
 */
function errorHandler(err, req, res, _next) {
  const isDev = process.env.NODE_ENV === "development";

  // Normalize known error types first
  let error =
    mapSyntaxError(err) ||
    mapDatabaseError(err) ||
    mapJWTError(err) ||
    err;

  // Default unknown errors to 500
  if (!error.statusCode) {
    error = new AppError(error.message || "Internal server error", 500, "INTERNAL_ERROR");
  }

  // Structured server-side logging (always includes full detail)
  const logEntry = {
    timestamp: new Date().toISOString(),
    statusCode: error.statusCode,
    code: error.code,
    message: error.message,
    method: req.method,
    path: req.path,
    ip: req.clientIP || req.ip,
    userId: req.user?._id || null,
  };

  if (isDev) {
    logEntry.stack = error.stack;
  }

  // Log operational 4xxs as warnings, unexpected 5xxs as errors
  if (error.statusCode >= 500) {
    console.error("[ERROR]", logEntry);
  } else if (error.statusCode >= 400) {
    console.warn("[WARN]", logEntry);
  }

  // Send sanitized response to client
  res.status(error.statusCode).json(buildErrorResponse(error, isDev));
}

/**
 * Wrapper for async route handlers to automatically catch errors
 * and forward them to the error handling middleware.
 *
 * Usage:
 *   router.get("/", catchAsync(async (req, res) => { ... }));
 */
function catchAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Wrapper for async middleware to automatically catch errors.
 * Same as catchAsync but semantically clearer for middleware usage.
 */
function catchAsyncMiddleware(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  ValidationError,
  errorHandler,
  catchAsync,
  catchAsyncMiddleware,
};
