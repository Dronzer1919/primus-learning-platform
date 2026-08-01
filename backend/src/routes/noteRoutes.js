const express = require('express');
const router = express.Router();
const noteController = require('../controllers/noteController');
const auth = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimiters');
const { objectId, validate, createNoteRules, updateNoteRules } = require('../validators');

// All routes require authentication
router.use(auth);
// Meters writes only; reads fall under the global limiter.
router.use(writeLimiter);

router.get('/', noteController.getUserNotes);
router.get('/:id', objectId('id'), validate, noteController.getNoteById);
router.post('/', createNoteRules, noteController.createNote);
router.put('/:id', updateNoteRules, noteController.updateNote);
router.delete('/:id', objectId('id'), validate, noteController.deleteNote);

module.exports = router;
