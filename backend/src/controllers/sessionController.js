const Session = require('../models/Session');

// Helper to load a session that belongs to the current user
async function findUserSession(userId, id) {
  return Session.findOne({ _id: id, userId });
}

// ---------- Session CRUD ----------

// Get all sessions for the logged-in user (most recently updated first)
exports.getUserSessions = async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user.id }).sort({ updatedAt: -1 });
    res.json({ success: true, count: sessions.length, data: sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get a single session with its todos and notes
exports.getSessionById = async (req, res) => {
  try {
    const session = await findUserSession(req.user.id, req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Create a new session. Previous sessions are kept (never auto-deleted).
exports.createSession = async (req, res) => {
  try {
    const { title } = req.body;
    const session = new Session({
      userId: req.user.id,
      title: title && title.trim() ? title.trim() : 'New Session',
      todos: [],
      notes: []
    });
    await session.save();
    res.status(201).json({ success: true, message: 'Session created', data: session });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Rename a session
exports.updateSession = async (req, res) => {
  try {
    const session = await findUserSession(req.user.id, req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    if (typeof req.body.title === 'string' && req.body.title.trim()) {
      session.title = req.body.title.trim();
    }
    await session.save();
    res.json({ success: true, message: 'Session updated', data: session });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Delete a session
exports.deleteSession = async (req, res) => {
  try {
    const session = await Session.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    res.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- To-do items ----------

exports.addTodo = async (req, res) => {
  try {
    const session = await findUserSession(req.user.id, req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Todo text is required' });
    }
    session.todos.push({ text: text.trim(), completed: false, order: session.todos.length });
    await session.save();
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    console.error('Add todo error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateTodo = async (req, res) => {
  try {
    const session = await findUserSession(req.user.id, req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    const todo = session.todos.id(req.params.todoId);
    if (!todo) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }
    if (typeof req.body.text === 'string' && req.body.text.trim()) todo.text = req.body.text.trim();
    if (typeof req.body.completed === 'boolean') todo.completed = req.body.completed;
    await session.save();
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Update todo error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteTodo = async (req, res) => {
  try {
    const session = await findUserSession(req.user.id, req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    const todo = session.todos.id(req.params.todoId);
    if (!todo) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }
    todo.deleteOne();
    await session.save();
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Delete todo error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- Notes ----------

exports.addNote = async (req, res) => {
  try {
    const session = await findUserSession(req.user.id, req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Note content is required' });
    }
    session.notes.push({ content: content.trim(), isPinned: !!req.body.isPinned });
    await session.save();
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateNote = async (req, res) => {
  try {
    const session = await findUserSession(req.user.id, req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    const note = session.notes.id(req.params.noteId);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }
    if (typeof req.body.content === 'string' && req.body.content.trim()) note.content = req.body.content.trim();
    if (typeof req.body.isPinned === 'boolean') note.isPinned = req.body.isPinned;
    note.updatedAt = Date.now();
    await session.save();
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteNote = async (req, res) => {
  try {
    const session = await findUserSession(req.user.id, req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    const note = session.notes.id(req.params.noteId);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }
    note.deleteOne();
    await session.save();
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
