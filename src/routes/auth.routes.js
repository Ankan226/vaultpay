const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { login, me } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, try again later' },
});

router.post('/login', loginLimiter, login);
router.get('/me', protect, me);

module.exports = router;