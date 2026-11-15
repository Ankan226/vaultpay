const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');
const { HttpError, asyncHandler } = require('../middleware/error');

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, company: u.company, role: u.role });

exports.login = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  if (!email || !password) throw new HttpError(400, 'Email and password are required');

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) throw new HttpError(401, 'Invalid credentials');

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token, user: publicUser(user) });
});

exports.me = (req, res) => res.json({ user: publicUser(req.user) });