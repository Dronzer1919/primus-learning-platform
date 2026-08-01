const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const header = req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token, authorization denied'
    });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    // Distinguish an expired token from a malformed one so the client knows
    // whether to refresh or to send the user back to the login screen. A failed
    // verification is a routine client-side condition, not a server fault, so
    // it is not logged as an error.
    const expired = error.name === 'TokenExpiredError';
    res.status(401).json({
      success: false,
      message: expired ? 'Token expired' : 'Token is not valid',
      ...(expired && { expired: true })
    });
  }
};
