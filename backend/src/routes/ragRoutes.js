const express = require('express');
const router = express.Router();
const ragController = require('../controllers/ragController');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { ragLimiter, writeLimiter } = require('../middleware/rateLimiters');
const { askRagRules } = require('../validators');

// Every route requires a logged-in user; asking also costs a paid API call.
router.post('/ask', auth, ragLimiter, askRagRules, ragController.ask);

// Admin-only: force a full index rebuild (e.g. after a bulk content import).
router.post('/reindex', auth, adminAuth, writeLimiter, ragController.reindex);

module.exports = router;
