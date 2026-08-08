import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { NotFoundError } from '../errors/ApiError.js';
import { ZodError } from 'zod';

export const notFoundHandler = (req, res, next) => {
  next(new NotFoundError(`Route '${req.originalUrl}' not found.`));
};

export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation failed';
    const errors = err.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
    return res.status(statusCode).json({ success: false, message, errors });
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for field '${err.path}'. Expected a valid ID.`;
  }

  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {}).join(', ');
    message = `An account with this ${field} already exists.`;
  }

  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(statusCode).json({ success: false, message: 'Validation failed.', errors });
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your session has expired. Please log in again.';
  }

  if (statusCode >= 500) {
    logger.error(`[${req.method}] ${req.originalUrl} - ${statusCode} - ${err.stack}`);
  } else {
    logger.warn(`[${req.method}] ${req.originalUrl} - ${statusCode} - ${message}`);
  }

  const response = {
    success: false,
    message,
    ...(config.app.env === 'development' && statusCode >= 500 && { stack: err.stack }),
  };

  return res.status(statusCode).json(response);
};
