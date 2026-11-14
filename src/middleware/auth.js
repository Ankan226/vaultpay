const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../config/env');
const { HttpError, asyncHandler } = require('./error');


exports.protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }

  const user = await User.findById(payload.id);
  if (!user) throw new HttpError(401, 'User no longer exists');

  req.user = user; 
  next();
});


exports.restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new HttpError(403, 'Forbidden: insufficient permissions'));
  }
  next();
};