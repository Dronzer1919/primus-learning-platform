const FlowchartSession = require('../models/FlowchartSession');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// Fields a client may set — same allow-list pattern as the playground
// controller, so the request body never reaches an update document directly.
const EDITABLE_FIELDS = ['title', 'nodes', 'edges', 'canvasBg'];

async function findUserSession(userId, id) {
  return FlowchartSession.findOne({ _id: id, userId });
}

async function requireUserSession(req) {
  const session = await findUserSession(req.user.id, req.params.id);
  if (!session) throw new AppError('Flowchart session not found', 404);
  return session;
}

exports.getUserSessions = asyncHandler(async (req, res) => {
  const sessions = await FlowchartSession.find({ userId: req.user.id }).sort({ updatedAt: -1 });
  res.json({ success: true, count: sessions.length, data: sessions });
});

exports.getSessionById = asyncHandler(async (req, res) => {
  const session = await requireUserSession(req);
  res.json({ success: true, data: session });
});

// Unlike the playground's create — which takes a title only and leaves the
// caller to follow up with an update — this saves the diagram that is on screen
// in a single round trip.
exports.createSession = asyncHandler(async (req, res) => {
  const { title, nodes, edges, canvasBg } = req.body;
  const session = await FlowchartSession.create({
    userId: req.user.id,
    title: title && title.trim() ? title.trim() : 'New Flowchart',
    nodes: Array.isArray(nodes) ? nodes : [],
    edges: Array.isArray(edges) ? edges : [],
    ...(canvasBg ? { canvasBg } : {})
  });
  res.status(201).json({ success: true, message: 'Flowchart session created', data: session });
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
  res.json({ success: true, message: 'Flowchart session updated', data: session });
});

exports.deleteSession = asyncHandler(async (req, res) => {
  const session = await FlowchartSession.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (!session) throw new AppError('Flowchart session not found', 404);
  res.json({ success: true, message: 'Flowchart session deleted' });
});
