const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/flowchartSessionController');
const auth = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimiters');
const { objectId, validate, flowchartRules } = require('../validators');

router.use(auth);
router.use(writeLimiter);

router.get('/', ctrl.getUserSessions);
router.post('/', flowchartRules, ctrl.createSession);
router.get('/:id', objectId('id'), validate, ctrl.getSessionById);
router.put('/:id', objectId('id'), flowchartRules, ctrl.updateSession);
router.delete('/:id', objectId('id'), validate, ctrl.deleteSession);

module.exports = router;
