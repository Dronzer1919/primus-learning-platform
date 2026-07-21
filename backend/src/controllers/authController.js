const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const UserSession = require('../models/UserSession');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── helpers ────────────────────────────────────────────────────────────────

function getDeviceType(userAgent = '') {
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad/.test(ua)) return ua.includes('ipad') ? 'tablet' : 'mobile';
  if (/tablet/.test(ua)) return 'tablet';
  if (/windows|macintosh|linux/.test(ua)) return 'desktop';
  return 'unknown';
}

async function recordLogin(userId, loginMethod, req) {
  const deviceType = getDeviceType(req.headers['user-agent']);
  const session = await UserSession.create({ userId, loginMethod, deviceType });
  await User.findByIdAndUpdate(userId, {
    $inc: { loginCount: 1 },
    $set: { lastLogin: new Date(), isOnline: true, lastSeen: new Date() }
  });
  return session._id.toString();
}

function buildToken(user, sessionId) {
  return jwt.sign(
    { id: user._id, role: user.role, sid: sessionId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
}

function safeUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    displayName: user.displayName || user.username,
    avatar: user.avatar || null,
    role: user.role,
    lastLogin: user.lastLogin,
    loginCount: user.loginCount
  };
}

// ─── register ───────────────────────────────────────────────────────────────

exports.register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email or username' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashedPassword, role: role || 'user' });
    const sessionId = await recordLogin(user._id, 'local', req);
    const token = buildToken(user, sessionId);
    res.status(201).json({ success: true, message: 'Registered successfully', token, user: safeUser(user) });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

// ─── local login ─────────────────────────────────────────────────────────────

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const sessionId = await recordLogin(user._id, 'local', req);
    const token = buildToken(user, sessionId);
    res.json({ success: true, message: 'Login successful', token, user: safeUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

// ─── google login ─────────────────────────────────────────────────────────────

exports.googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ success: false, message: 'No ID token provided' });

    const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    const { sub: googleId, email, name, picture } = ticket.getPayload();

    if (!email) return res.status(400).json({ success: false, message: 'No email in Google account' });

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    if (user) {
      // Link Google ID and update profile if needed
      const update = {};
      if (!user.googleId) update.googleId = googleId;
      if (!user.displayName && name) update.displayName = name;
      if (!user.avatar && picture) update.avatar = picture;
      if (Object.keys(update).length) await User.findByIdAndUpdate(user._id, update);
      user = await User.findById(user._id);
    } else {
      // New user via Google — derive a unique username from email
      const base = email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase();
      let username = base;
      let n = 1;
      while (await User.findOne({ username })) username = `${base}${n++}`;
      user = await User.create({ username, email, googleId, displayName: name, avatar: picture, role: 'user' });
    }

    const sessionId = await recordLogin(user._id, 'google', req);
    const token = buildToken(user, sessionId);
    res.json({ success: true, message: 'Google login successful', token, user: safeUser(user) });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(401).json({ success: false, message: 'Invalid Google token' });
  }
};

// ─── logout ──────────────────────────────────────────────────────────────────

exports.logout = async (req, res) => {
  try {
    const { sid } = req.user; // session ID from JWT
    if (sid) {
      const session = await UserSession.findById(sid);
      if (session && session.isActive) {
        const durationMinutes = Math.round((Date.now() - session.loginAt.getTime()) / 60000);
        await UserSession.findByIdAndUpdate(sid, {
          isActive: false,
          logoutAt: new Date(),
          sessionDurationMinutes: durationMinutes
        });
      }
    }
    await User.findByIdAndUpdate(req.user.id, { isOnline: false, lastSeen: new Date() });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Server error during logout' });
  }
};

// ─── get current user ────────────────────────────────────────────────────────

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    // Refresh lastSeen
    await User.findByIdAndUpdate(user._id, { lastSeen: new Date() });
    res.json({ success: true, user: safeUser(user) });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── admin: user stats ────────────────────────────────────────────────────────

exports.getStats = async (req, res) => {
  try {
    const [
      totalUsers,
      activeNow,
      totalSessions,
      googleUsers,
      todayLogins
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ isOnline: true }),
      UserSession.countDocuments(),
      User.countDocuments({ googleId: { $exists: true, $ne: null } }),
      UserSession.countDocuments({ loginAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } })
    ]);

    // Recent logins (last 10)
    const recentLogins = await UserSession.find({ isActive: false })
      .sort({ loginAt: -1 })
      .limit(10)
      .populate('userId', 'username email displayName avatar role');

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeNow,
        totalSessions,
        googleUsers,
        todayLogins,
        recentLogins: recentLogins.map(s => ({
          user: s.userId ? {
            username: s.userId.username,
            email: s.userId.email,
            displayName: s.userId.displayName,
            avatar: s.userId.avatar,
            role: s.userId.role
          } : null,
          loginMethod: s.loginMethod,
          loginAt: s.loginAt,
          logoutAt: s.logoutAt,
          durationMinutes: s.sessionDurationMinutes,
          deviceType: s.deviceType
        }))
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
