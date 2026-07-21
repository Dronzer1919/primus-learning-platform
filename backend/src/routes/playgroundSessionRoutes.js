const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/playgroundSessionController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', ctrl.getUserSessions);
router.post('/', ctrl.createSession);
router.get('/:id', ctrl.getSessionById);
router.put('/:id', ctrl.updateSession);
router.delete('/:id', ctrl.deleteSession);

module.exports = router;
