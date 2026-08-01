const express = require('express');
const router = express.Router();
const languageTabController = require('../controllers/languageTabController');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { writeLimiter } = require('../middleware/rateLimiters');
const { objectId, validate, languageTabRules } = require('../validators');

// Public routes - Get tabs
router.get('/', languageTabController.getAllLanguageTabs);
router.get('/active', languageTabController.getActiveLanguageTabs);

// Admin only routes
router.post('/', auth, adminAuth, writeLimiter, languageTabRules, languageTabController.createLanguageTab);
router.put('/:id', auth, adminAuth, writeLimiter, objectId('id'), validate, languageTabController.updateLanguageTab);
router.delete('/:id', auth, adminAuth, writeLimiter, objectId('id'), validate, languageTabController.deleteLanguageTab);

module.exports = router;
