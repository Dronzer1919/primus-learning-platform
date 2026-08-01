const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const auth = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimiters');
const { objectId, validate, sessionTitleRules, todoRules, sessionNoteRules } = require('../validators');

// All session routes require authentication
router.use(auth);
router.use(writeLimiter);

// Sessions
router.get('/', sessionController.getUserSessions);
router.post('/', sessionTitleRules, sessionController.createSession);
router.get('/:id', objectId('id'), validate, sessionController.getSessionById);
router.put('/:id', objectId('id'), sessionTitleRules, sessionController.updateSession);
router.delete('/:id', objectId('id'), validate, sessionController.deleteSession);

// Todos within a session
router.post('/:id/todos', todoRules, sessionController.addTodo);
router.put('/:id/todos/:todoId', objectId('todoId'), todoRules, sessionController.updateTodo);
router.delete('/:id/todos/:todoId', objectId('id'), objectId('todoId'), validate, sessionController.deleteTodo);

// Notes within a session
router.post('/:id/notes', sessionNoteRules, sessionController.addNote);
router.put('/:id/notes/:noteId', objectId('noteId'), sessionNoteRules, sessionController.updateNote);
router.delete('/:id/notes/:noteId', objectId('id'), objectId('noteId'), validate, sessionController.deleteNote);

module.exports = router;
