const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/playgroundSessionController');
const auth = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimiters');
const { objectId, validate, playgroundRules } = require('../validators');

router.use(auth);
router.use(writeLimiter);

router.get('/', ctrl.getUserSessions);
router.post('/', playgroundRules, ctrl.createSession);
router.get('/:id', objectId('id'), validate, ctrl.getSessionById);
router.put('/:id', objectId('id'), playgroundRules, ctrl.updateSession);
router.delete('/:id', objectId('id'), validate, ctrl.deleteSession);

module.exports = router;
