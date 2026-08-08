import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';
import { User } from './user.model.js';
import { sendCreated, sendSuccess, sendUnauthorized, sendConflict, sendForbidden, sendBadRequest } from '../../core/utils/response.js';

const getCookieOptions = () => ({
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  maxAge: 60 * 60 * 1000
});

const signAndSetToken = (res, user) => {
  const token = jwt.sign(
    { id: user._id, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiry }
  );

  res.cookie('vaultpay_token', token, getCookieOptions());

  return token;
};

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  isActive: user.isActive,
  createdAt: user.createdAt,
});

export const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendConflict(res, 'An account with this email address already exists.');
    }

    const hasAdminUser = await User.exists({ role: 'admin', isDeleted: { $ne: true } });

    if (!hasAdminUser) {
      if (role !== 'admin') {
        return sendBadRequest(res, 'The initial bootstrap account must be created with role "admin".');
      }

      const user = await User.create({ name, email, password, role: 'admin' });
      signAndSetToken(res, user);
      return sendCreated(res, 'Initial admin account created successfully.', sanitizeUser(user));
    }

    if (!req.user) {
      return sendUnauthorized(res, 'Authentication required to create an account.');
    }

    if (req.user.role !== 'admin') {
      return sendForbidden(res, 'Only administrators may create accounts.');
    }

    const user = await User.create({ name, email, password, role: 'client' });
    return sendCreated(res, 'Client account created successfully.', sanitizeUser(user));
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return sendUnauthorized(res, 'Invalid email or password.');
    }

    if (!user.isActive) {
      return sendUnauthorized(res, 'Your account has been deactivated. Please contact support.');
    }

    signAndSetToken(res, user);
    return sendSuccess(res, 'Logged in successfully.', sanitizeUser(user));
  } catch (err) {
    next(err);
  }
};

export const logout = (req, res) => {
  res.clearCookie('vaultpay_token', getCookieOptions());
  return sendSuccess(res, 'Logged out successfully.');
};

export const getProfile = (req, res) => {
  return sendSuccess(res, 'Profile retrieved successfully.', sanitizeUser(req.user));
};
