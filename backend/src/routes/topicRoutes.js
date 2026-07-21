const express = require('express');
const router = express.Router();
const topicController = require('../controllers/topicController');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Public routes - Get topics
router.get('/', topicController.getAllTopics);
router.get('/:id', topicController.getTopicById);
router.get('/:topicId/subtopics/:subtopicId', topicController.getSubtopicContent);

// Admin only routes - Manage topics
router.post('/', auth, adminAuth, topicController.createTopic);
router.put('/:id', auth, adminAuth, topicController.updateTopic);
router.delete('/:id', auth, adminAuth, topicController.deleteTopic);

// Admin only routes - Manage subtopics
router.post('/:topicId/subtopics', auth, adminAuth, topicController.addSubtopic);
router.put('/:topicId/subtopics/:subtopicId', auth, adminAuth, topicController.updateSubtopic);
router.delete('/:topicId/subtopics/:subtopicId', auth, adminAuth, topicController.deleteSubtopic);

module.exports = router;
