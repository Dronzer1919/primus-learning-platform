const Session = require('../models/Session');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// Helper to load a session that belongs to the current user. Scoping every
// lookup by userId is what keeps one user's :id from reaching another's data.
async function findUserSession(userId, id) {
  return Session.findOne({ _id: id, userId });
}

// Loads the session or fails with a 404 — the same response an unrelated id
// gets, so this never confirms that someone else's session exists.
async function requireUserSession(req) {
  const session = await findUserSession(req.user.id, req.params.id);
  if (!session) throw new AppError('Session not found', 404);
  return session;
}

// ---------- Session CRUD ----------

// Get all sessions for the logged-in user (most recently updated first)
exports.getUserSessions = asyncHandler(async (req, res) => {
  const sessions = await Session.find({ userId: req.user.id }).sort({ updatedAt: -1 });
  res.json({ success: true, count: sessions.length, data: sessions });
});

// Get a single session with its todos and notes
exports.getSessionById = asyncHandler(async (req, res) => {
  const session = await requireUserSession(req);
  res.json({ success: true, data: session });
});

// Create a new session. Previous sessions are kept (never auto-deleted).
exports.createSession = asyncHandler(async (req, res) => {
  const { title } = req.body;
  const session = await Session.create({
    userId: req.user.id,
    title: title && title.trim() ? title.trim() : 'New Session',
    todos: [],
    notes: []
  });
  res.status(201).json({ success: true, message: 'Session created', data: session });
});

// Rename a session
exports.updateSession = asyncHandler(async (req, res) => {
  const session = await requireUserSession(req);
  if (typeof req.body.title === 'string' && req.body.title.trim()) {
    session.title = req.body.title.trim();
  }
  await session.save();
  res.json({ success: true, message: 'Session updated', data: session });
});

// Delete a session
exports.deleteSession = asyncHandler(async (req, res) => {
  const session = await Session.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (!session) throw new AppError('Session not found', 404);
  res.json({ success: true, message: 'Session deleted' });
});

// ---------- To-do items ----------

exports.addTodo = asyncHandler(async (req, res) => {
  const session = await requireUserSession(req);

  const { text } = req.body;
  if (!text || !text.trim()) throw new AppError('Todo text is required', 400);

  session.todos.push({ text: text.trim(), completed: false, order: session.todos.length });
  await session.save();
  res.status(201).json({ success: true, data: session });
});

exports.updateTodo = asyncHandler(async (req, res) => {
  const session = await requireUserSession(req);

  const todo = session.todos.id(req.params.todoId);
  if (!todo) throw new AppError('Todo not found', 404);

  if (typeof req.body.text === 'string' && req.body.text.trim()) todo.text = req.body.text.trim();
  if (typeof req.body.completed === 'boolean') todo.completed = req.body.completed;
  await session.save();
  res.json({ success: true, data: session });
});

exports.deleteTodo = asyncHandler(async (req, res) => {
  const session = await requireUserSession(req);

  const todo = session.todos.id(req.params.todoId);
  if (!todo) throw new AppError('Todo not found', 404);

  todo.deleteOne();
  await session.save();
  res.json({ success: true, data: session });
});

// ---------- Notes ----------

exports.addNote = asyncHandler(async (req, res) => {
  const session = await requireUserSession(req);

  const { content } = req.body;
  if (!content || !content.trim()) throw new AppError('Note content is required', 400);

  session.notes.push({ content: content.trim(), isPinned: !!req.body.isPinned });
  await session.save();
  res.status(201).json({ success: true, data: session });
});

exports.updateNote = asyncHandler(async (req, res) => {
  const session = await requireUserSession(req);

  const note = session.notes.id(req.params.noteId);
  if (!note) throw new AppError('Note not found', 404);

  if (typeof req.body.content === 'string' && req.body.content.trim()) note.content = req.body.content.trim();
  if (typeof req.body.isPinned === 'boolean') note.isPinned = req.body.isPinned;
  note.updatedAt = Date.now();
  await session.save();
  res.json({ success: true, data: session });
});

exports.deleteNote = asyncHandler(async (req, res) => {
  const session = await requireUserSession(req);

  const note = session.notes.id(req.params.noteId);
  if (!note) throw new AppError('Note not found', 404);

  note.deleteOne();
  await session.save();
  res.json({ success: true, data: session });
});
