const express = require('express');
const router = express.Router();
const issueController = require('../controllers/issueController');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const upload = require('../middleware/upload');
const { writeLimiter } = require('../middleware/rateLimiters');
const { createIssueRules, updateIssueStatusRules } = require('../validators');

// All routes require a logged-in user; admin-only routes add adminAuth on top.
router.use(auth);
// Meters writes only; reads fall under the global limiter.
router.use(writeLimiter);

// User
// upload.single('image') must run before createIssueRules: multer is what
// populates req.body for a multipart request, so the validators would see an
// empty body if they ran first.
router.post('/', upload.single('image'), createIssueRules, issueController.createIssue);
router.get('/my', issueController.getMyIssues);

// Admin only
router.get('/admin', adminAuth, issueController.getAllIssuesAdmin);
router.patch('/admin/:id/status', adminAuth, updateIssueStatusRules, issueController.updateIssueStatus);

module.exports = router;
