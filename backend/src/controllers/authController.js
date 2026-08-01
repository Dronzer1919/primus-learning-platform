const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const UserSession = require('../models/UserSession');

const { asyncHandler, AppError } = require('../middleware/errorHandler');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Account lockout thresholds. These complement the per-IP limits in
// rateLimiters.js: those stop one address hammering the endpoint, these stop a
// botnet spread across many addresses converging on a single account.
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

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

// Derives a free username from a Google email. The probe loop is bounded: a
// popular base like "john" could otherwise spin for a very long time, and an
// attacker able to pre-register names could keep it spinning indefinitely.
async function deriveUniqueUsername(email) {
  const base = email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20) || 'user';

  if (!(await User.findOne({ username: base }))) return base;

  for (let n = 1; n <= 50; n++) {
    const candidate = `${base}${n}`;
    if (!(await User.findOne({ username: candidate }))) return candidate;
  }

  // Give up probing sequentially and take a random suffix instead. The unique
  // index on username is the real guarantee; a collision here surfaces as a 409.
  return `${base}${Math.random().toString(36).slice(2, 8)}`;
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

exports.register = asyncHandler(async (req, res) => {
  // `role` is deliberately NOT read from the request body. It used to be, which
  // let anyone register themselves as an admin. Self-service signup always
  // produces a plain user; admins are created out-of-band by seed.js.
  const { username, email, password } = req.body;

  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    throw new AppError('User already exists with this email or username', 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({ username, email, password: hashedPassword, role: 'user' });
  const sessionId = await recordLogin(user._id, 'local', req);
  const token = buildToken(user, sessionId);

  res.status(201).json({ success: true, message: 'Registered successfully', token, user: safeUser(user) });
});

// ─── local login ─────────────────────────────────────────────────────────────

exports.login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // Validators guarantee these are strings, so no $ne/$gt operator can reach
  // the query here.
  const user = await User.findOne({ username });

  // The same message for "no such user" and "wrong password" keeps the endpoint
  // from confirming which usernames exist.
  const invalid = () => new AppError('Invalid credentials', 401);

  if (!user || !user.password) throw invalid();

  if (user.lockUntil && user.lockUntil > Date.now()) {
    const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
    throw new AppError(
      `Account temporarily locked after too many failed attempts. Try again in ${minutesLeft} minute(s).`,
      423
    );
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    const update = { failedLoginAttempts: attempts };
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      update.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
      update.failedLoginAttempts = 0; // reset the counter alongside the lock
    }
    await User.findByIdAndUpdate(user._id, update);
    throw invalid();
  }

  // Clear any accumulated failures on a genuine login.
  if (user.failedLoginAttempts || user.lockUntil) {
    await User.findByIdAndUpdate(user._id, { failedLoginAttempts: 0, lockUntil: null });
  }

  const sessionId = await recordLogin(user._id, 'local', req);
  const token = buildToken(user, sessionId);
  res.json({ success: true, message: 'Login successful', token, user: safeUser(user) });
});

// ─── google login ─────────────────────────────────────────────────────────────

exports.googleLogin = asyncHandler(async (req, res) => {
  const { idToken } = req.body;

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (error) {
    // Only token verification failure means "invalid token" — anything that
    // goes wrong after this point is our problem, not the caller's, and should
    // surface as a 500 rather than a misleading 401.
    console.error('Google token verification failed:', error.message);
    throw new AppError('Invalid Google token', 401);
  }

  const { sub: googleId, email, name, picture } = payload;
  if (!email) throw new AppError('No email in Google account', 400);

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
    user = await User.create({
      username: await deriveUniqueUsername(email),
      email,
      googleId,
      displayName: name,
      avatar: picture,
      role: 'user'
    });
  }

  const sessionId = await recordLogin(user._id, 'google', req);
  const token = buildToken(user, sessionId);
  res.json({ success: true, message: 'Google login successful', token, user: safeUser(user) });
});

// ─── logout ──────────────────────────────────────────────────────────────────

exports.logout = asyncHandler(async (req, res) => {
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
});

// ─── get current user ────────────────────────────────────────────────────────

exports.getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  if (!user) throw new AppError('User not found', 404);
  // Refresh lastSeen
  await User.findByIdAndUpdate(user._id, { lastSeen: new Date() });
  res.json({ success: true, user: safeUser(user) });
});

// ─── admin: user stats ────────────────────────────────────────────────────────

exports.getStats = asyncHandler(async (req, res) => {
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
});
