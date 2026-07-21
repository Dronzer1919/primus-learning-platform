const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const auth = require('../middleware/auth');

// All session routes require authentication
router.use(auth);

// Sessions
router.get('/', sessionController.getUserSessions);
router.post('/', sessionController.createSession);
router.get('/:id', sessionController.getSessionById);
router.put('/:id', sessionController.updateSession);
router.delete('/:id', sessionController.deleteSession);

// Todos within a session
router.post('/:id/todos', sessionController.addTodo);
router.put('/:id/todos/:todoId', sessionController.updateTodo);
router.delete('/:id/todos/:todoId', sessionController.deleteTodo);

// Notes within a session
router.post('/:id/notes', sessionController.addNote);
router.put('/:id/notes/:noteId', sessionController.updateNote);
router.delete('/:id/notes/:noteId', sessionController.deleteNote);

module.exports = router;
