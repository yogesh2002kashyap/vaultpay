import { Router } from 'express';
import { register, login, logout, getProfile } from './auth.controller.js';
import { registerSchema, loginSchema } from './auth.validation.js';
import { validate } from '../../core/middlewares/validate.middleware.js';
import { requireAuth, requireRole } from '../../core/middlewares/auth.middleware.js';

const router = Router();

router.post('/register', requireAuth, requireRole(['admin']), validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/logout', requireAuth, logout);
router.get('/profile', requireAuth, getProfile);

export default router;
