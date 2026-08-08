/**
 * Response Utility
 *
 * Centralizes all API response formatting.
 * Ensures every endpoint returns a consistent JSON structure:
 * { success, message, data }
 *
 * Architectural Decision: Using a utility function (not a class) keeps this
 * lightweight and composable — controllers call sendSuccess(res, ...) directly.
 */

/**
 * Send a 200 OK response
 */
export const sendSuccess = (res, message, data = null) => {
  return res.status(200).json({ success: true, message, data });
};

/**
 * Send a 201 Created response
 */
export const sendCreated = (res, message, data = null) => {
  return res.status(201).json({ success: true, message, data });
};

/**
 * Send a 400 Bad Request response (validation failures)
 */
export const sendBadRequest = (res, message, errors = null) => {
  return res.status(400).json({ success: false, message, errors });
};

/**
 * Send a 401 Unauthorized response
 */
export const sendUnauthorized = (res, message = 'Unauthorized. Please log in.') => {
  return res.status(401).json({ success: false, message });
};

/**
 * Send a 403 Forbidden response (authenticated but not permitted)
 */
export const sendForbidden = (res, message = 'Forbidden. You do not have permission to access this resource.') => {
  return res.status(403).json({ success: false, message });
};

/**
 * Send a 404 Not Found response
 */
export const sendNotFound = (res, message = 'Resource not found.') => {
  return res.status(404).json({ success: false, message });
};

/**
 * Send a 409 Conflict response (e.g., duplicate email)
 */
export const sendConflict = (res, message) => {
  return res.status(409).json({ success: false, message });
};

/**
 * Send a 500 Internal Server Error response
 */
export const sendServerError = (res, message = 'An unexpected server error occurred.') => {
  return res.status(500).json({ success: false, message });
};
