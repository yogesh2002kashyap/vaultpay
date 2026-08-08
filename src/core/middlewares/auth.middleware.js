import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';
import { User } from '../../modules/auth/user.model.js';
import { sendUnauthorized } from '../utils/response.js';

/**
 * requireAuth Middleware
 *
 * Verifies the JWT stored in the HttpOnly cookie and attaches the
 * authenticated user to `req.user`.
 *
 * Zero Trust Decision:
 * - We re-fetch the user from the database on every protected request.
 * - This ensures that if a user is deactivated or deleted AFTER a token
 *   is issued, their existing token is automatically invalidated.
 *   A purely stateless JWT check would miss this case.
 */
export const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.vaultpay_token;

    if (!token) {
      return sendUnauthorized(res, 'No authentication token provided. Please log in.');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendUnauthorized(res, 'Your session has expired. Please log in again.');
      }
      return sendUnauthorized(res, 'Invalid authentication token. Please log in again.');
    }

    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return sendUnauthorized(res, 'Your account is inactive or no longer exists. Please contact support.');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * requireRole Middleware Factory
 *
 * Returns an Express middleware that checks if the authenticated user
 * has one of the allowed roles. Must be used AFTER `requireAuth`.
 *
 * Usage:
 *   router.get('/admin/data', requireAuth, requireRole(['admin']), controller.fn);
 *
 * @param {string[]} roles - Array of allowed role strings
 */
export const requireRole = (roles) => (req, res, next) => {
  if (!req.user) {
    return sendUnauthorized(res);
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Forbidden. This resource requires one of the following roles: ${roles.join(', ')}.`,
    });
  }

  next();
};
