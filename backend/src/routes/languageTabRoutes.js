const express = require('express');
const router = express.Router();
const languageTabController = require('../controllers/languageTabController');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Public routes - Get tabs
router.get('/', languageTabController.getAllLanguageTabs);
router.get('/active', languageTabController.getActiveLanguageTabs);

// Admin only routes
router.post('/', auth, adminAuth, languageTabController.createLanguageTab);
router.put('/:id', auth, adminAuth, languageTabController.updateLanguageTab);
router.delete('/:id', auth, adminAuth, languageTabController.deleteLanguageTab);

module.exports = router;
