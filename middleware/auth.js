/**
 * This is an authentication middleware for Express.js routes.
 * It acts as a security guard to protect API endpoints.
 *
 * It works by:
 * 1. Getting the JSON Web Token (JWT) from the 'x-auth-token' header of the request.
 * 2. If no token is found, it denies access (401 Unauthorized).
 * 3. If a token is found, it verifies that the token is valid and not expired.
 * 4. If the token is valid, it attaches the user's information to the request object
 * (as req.user) and allows the request to proceed to the actual route handler.
 * 5. If the token is invalid, it denies access.
 */

const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if not token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
