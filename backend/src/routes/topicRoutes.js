const express = require('express');
const router = express.Router();
const topicController = require('../controllers/topicController');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { writeLimiter } = require('../middleware/rateLimiters');
const { objectId, validate, listTopicsRules, createTopicRules } = require('../validators');

// Public routes - Get topics
router.get('/', listTopicsRules, topicController.getAllTopics);
router.get('/:id', objectId('id'), validate, topicController.getTopicById);
router.get(
  '/:topicId/subtopics/:subtopicId',
  objectId('topicId'),
  objectId('subtopicId'),
  validate,
  topicController.getSubtopicContent
);

// Admin only routes - Manage topics
router.post('/', auth, adminAuth, writeLimiter, createTopicRules, topicController.createTopic);
router.put('/:id', auth, adminAuth, writeLimiter, objectId('id'), validate, topicController.updateTopic);
router.delete('/:id', auth, adminAuth, writeLimiter, objectId('id'), validate, topicController.deleteTopic);

// Admin only routes - Manage subtopics
router.post(
  '/:topicId/subtopics',
  auth, adminAuth, writeLimiter,
  objectId('topicId'), validate,
  topicController.addSubtopic
);
router.put(
  '/:topicId/subtopics/:subtopicId',
  auth, adminAuth, writeLimiter,
  objectId('topicId'), objectId('subtopicId'), validate,
  topicController.updateSubtopic
);
router.delete(
  '/:topicId/subtopics/:subtopicId',
  auth, adminAuth, writeLimiter,
  objectId('topicId'), objectId('subtopicId'), validate,
  topicController.deleteSubtopic
);

module.exports = router;
