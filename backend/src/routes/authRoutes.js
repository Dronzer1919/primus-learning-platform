const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { authLimiter, writeLimiter } = require('../middleware/rateLimiters');
const { registerRules, loginRules, googleRules } = require('../validators');

// Credential endpoints are the ones worth brute-forcing, so they carry the
// strict tier: 20 failed attempts a minute from one IP and the IP is blocked.
// writeLimiter additionally caps total volume, which is what stops someone
// mass-creating accounts (successful registrations don't count towards
// authLimiter by design).
router.post('/register', authLimiter, writeLimiter, registerRules, authController.register);
router.post('/login', authLimiter, loginRules, authController.login);
router.post('/google', authLimiter, googleRules, authController.googleLogin);

// Protected routes
router.get('/me', auth, authController.getCurrentUser);
router.post('/logout', auth, authController.logout);

// Admin only
router.get('/stats', auth, adminAuth, authController.getStats);

module.exports = router;
