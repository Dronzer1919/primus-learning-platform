const PlaygroundSession = require('../models/PlaygroundSession');

async function findUserSession(userId, id) {
  return PlaygroundSession.findOne({ _id: id, userId });
}

exports.getUserSessions = async (req, res) => {
  try {
    const sessions = await PlaygroundSession.find({ userId: req.user.id }).sort({ updatedAt: -1 });
    res.json({ success: true, count: sessions.length, data: sessions });
  } catch (error) {
    console.error('Get playground sessions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getSessionById = async (req, res) => {
  try {
    const session = await findUserSession(req.user.id, req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Playground session not found' });
    }
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Get playground session error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createSession = async (req, res) => {
  try {
    const { title } = req.body;
    const session = new PlaygroundSession({
      userId: req.user.id,
      title: title && title.trim() ? title.trim() : 'New Playground',
    });
    await session.save();
    res.status(201).json({ success: true, message: 'Playground session created', data: session });
  } catch (error) {
    console.error('Create playground session error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateSession = async (req, res) => {
  try {
    const session = await findUserSession(req.user.id, req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Playground session not found' });
    }
    const allowed = ['title', 'mode', 'htmlCode', 'cssCode', 'jsCode', 'jsOnlyCode', 'tsCode', 'selectedTab'];
    for (const field of allowed) {
      if (typeof req.body[field] !== 'undefined') {
        if (field === 'title' && typeof req.body[field] === 'string' && req.body[field].trim()) {
          session[field] = req.body[field].trim();
        } else if (field !== 'title') {
          session[field] = req.body[field];
        }
      }
    }
    await session.save();
    res.json({ success: true, message: 'Playground session updated', data: session });
  } catch (error) {
    console.error('Update playground session error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteSession = async (req, res) => {
  try {
    const session = await PlaygroundSession.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Playground session not found' });
    }
    res.json({ success: true, message: 'Playground session deleted' });
  } catch (error) {
    console.error('Delete playground session error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
