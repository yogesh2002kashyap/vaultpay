import { ZodError } from 'zod';
import { sendBadRequest } from '../utils/response.js';

/**
 * Validate Middleware Factory
 *
 * Accepts a Zod schema and returns an Express middleware function.
 * Validates req.body, req.query, and req.params against the schema.
 *
 * Architectural Decision:
 * Validation runs BEFORE controllers. If it fails, the request is rejected
 * immediately with a 400 and structured errors. Controllers receive only
 * pre-validated, safe data.
 *
 * Usage:
 *   router.post('/register', validate(registerSchema), authController.register);
 *
 * @param {z.ZodSchema} schema - Zod schema object with body/params/query keys
 */
export const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      params: req.params,
      query: req.query,
    });
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return sendBadRequest(res, 'Validation failed. Please check your input.', errors);
    }
    next(err);
  }
};
