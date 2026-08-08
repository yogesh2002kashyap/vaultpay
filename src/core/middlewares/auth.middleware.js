import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';
import { User } from '../../modules/auth/user.model.js';
import { sendUnauthorized } from '../utils/response.js';


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

export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.vaultpay_token;

    if (!token) {
      return next();
    }

    let decoded;

    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next();
      }

      return next();
    }

    const user = await User.findById(decoded.id);

    if (user && user.isActive) {
      req.user = user;
    }

    next();
  } catch (err) {
    next(err);
  }
};
