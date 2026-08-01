const PlaygroundSession = require('../models/PlaygroundSession');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// Fields a client may set. This allow-list is the pattern the other controllers
// now follow too — the request body never reaches an update document directly.
const EDITABLE_FIELDS = ['title', 'mode', 'htmlCode', 'cssCode', 'jsCode', 'jsOnlyCode', 'tsCode', 'selectedTab'];

async function findUserSession(userId, id) {
  return PlaygroundSession.findOne({ _id: id, userId });
}

async function requireUserSession(req) {
  const session = await findUserSession(req.user.id, req.params.id);
  if (!session) throw new AppError('Playground session not found', 404);
  return session;
}

exports.getUserSessions = asyncHandler(async (req, res) => {
  const sessions = await PlaygroundSession.find({ userId: req.user.id }).sort({ updatedAt: -1 });
  res.json({ success: true, count: sessions.length, data: sessions });
});

exports.getSessionById = asyncHandler(async (req, res) => {
  const session = await requireUserSession(req);
  res.json({ success: true, data: session });
});

exports.createSession = asyncHandler(async (req, res) => {
  const { title } = req.body;
  const session = await PlaygroundSession.create({
    userId: req.user.id,
    title: title && title.trim() ? title.trim() : 'New Playground'
  });
  res.status(201).json({ success: true, message: 'Playground session created', data: session });
});

exports.updateSession = asyncHandler(async (req, res) => {
  const session = await requireUserSession(req);

  for (const field of EDITABLE_FIELDS) {
    if (typeof req.body[field] === 'undefined') continue;

    if (field === 'title') {
      // A blank title would wipe the session's name; keep the existing one.
      if (typeof req.body.title === 'string' && req.body.title.trim()) {
        session.title = req.body.title.trim();
      }
    } else {
      session[field] = req.body[field];
    }
  }

  await session.save();
  res.json({ success: true, message: 'Playground session updated', data: session });
});

exports.deleteSession = asyncHandler(async (req, res) => {
  const session = await PlaygroundSession.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (!session) throw new AppError('Playground session not found', 404);
  res.json({ success: true, message: 'Playground session deleted' });
});
