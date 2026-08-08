require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');
const connectDB = require('./config/database');

const { notFound, errorHandler } = require('./middleware/errorHandler');
const { blocklistGuard, globalLimiter } = require('./middleware/rateLimiters');

// Import routes
const authRoutes = require('./routes/authRoutes');
const languageTabRoutes = require('./routes/languageTabRoutes');
const topicRoutes = require('./routes/topicRoutes');
const noteRoutes = require('./routes/noteRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const playgroundSessionRoutes = require('./routes/playgroundSessionRoutes');
const flowchartSessionRoutes = require('./routes/flowchartSessionRoutes');
const issueRoutes = require('./routes/issueRoutes');

// ─── boot-time configuration checks ──────────────────────────────────────────
// Fail loudly at startup rather than signing tokens with `undefined` or
// discovering the DB URI is missing on the first request.
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`FATAL: missing required environment variable(s): ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  console.warn('WARNING: CORS_ORIGIN is unset in production — the API will accept requests from any origin.');
}

const app = express();

connectDB();

// ─── middleware ──────────────────────────────────────────────────────────────
// Order matters throughout this section.

// nginx sits in front of us in production (deployment-scripts/nginx-api.conf).
// Without this, req.ip is always 127.0.0.1 and every client shares a single
// rate-limit bucket — one attacker would lock out everyone. Must precede the
// limiters. `1` = trust exactly one proxy hop, so X-Forwarded-For cannot be
// spoofed by the client to dodge a block.
app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());

// CORS: in production, lock access to the origin(s) listed in CORS_ORIGIN
// (comma-separated). When unset (e.g. local dev), allow all origins.
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : null;
app.use(cors({ origin: corsOrigins || true, credentials: true }));

// Uploaded issue-report images. Public and unauthenticated, keyed by an
// unguessable random filename (see middleware/upload.js) — not access-controlled
// beyond that. helmet() above sets Cross-Origin-Resource-Policy: same-origin
// globally, which would silently block <img> loads from the web app's origin in
// production (a different origin from the API — primuscodex.com vs
// api.primuscodex.com). Overriding it only on this path is safe: nothing else
// served here is cross-origin-sensitive.
app.use(
  '/uploads',
  (req, res, next) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.join(__dirname, '..', 'uploads'))
);

// Explicit ceiling on request bodies. Playground sessions carry several code
// fields, so the default 100kb is too tight, but the cap must still exist —
// unbounded bodies are a trivial memory-exhaustion vector.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Strips $-prefixed keys and dots from req.body/params/query, so a payload like
// {"username": {"$ne": null}} cannot become a Mongo operator. The validators
// are the primary defence; this is the backstop for anything they don't cover.
app.use(mongoSanitize());

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Already-blocked IPs are rejected here, before routing or any DB work.
app.use(blocklistGuard);

// Health check — declared before the limiter so uptime monitors are never
// throttled, and cheap enough to serve under load.
app.get('/api/health', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    success: true,
    message: 'Learning Platform API is running',
    database: dbStates[mongoose.connection.readyState] || 'unknown',
    timestamp: new Date().toISOString()
  });
});

app.use('/api', globalLimiter);

// ─── routes ──────────────────────────────────────────────────────────────────
// The strict auth limiter is applied inside authRoutes; write limiters are
// applied inside each router, so each one owns its own policy.
app.use('/api/auth', authRoutes);
app.use('/api/language-tabs', languageTabRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/playground-sessions', playgroundSessionRoutes);
app.use('/api/flowchart-sessions', flowchartSessionRoutes);
app.use('/api/issues', issueRoutes);

// 404 first, then the error translator. The previous order (error handler
// before the 404) happened to work only because Express skips 4-arity
// middleware for non-errors — fragile and misleading.
app.use(notFound);
app.use(errorHandler);

// ─── start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// ─── process-level resilience ────────────────────────────────────────────────
// Without these, any throw outside a try/catch — including inside a timer or
// stray callback — kills the process silently. PM2 restarts it, but
// `max_restarts: 10` means a reliably reproducible trigger takes the API down
// for good. Logging the cause is what makes that debuggable.

let shuttingDown = false;

function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received — shutting down gracefully...`);

  // Stop accepting new connections; let in-flight requests finish.
  server.close(async () => {
    try {
      await mongoose.connection.close(false);
      console.log('MongoDB connection closed.');
    } catch (err) {
      console.error('Error closing MongoDB connection:', err.message);
    }
    process.exit(exitCode);
  });

  // A hung connection must not block a deploy indefinitely.
  setTimeout(() => {
    console.error('Graceful shutdown timed out — forcing exit.');
    process.exit(exitCode || 1);
  }, 10000).unref();
}

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
  shutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  // The process state is no longer trustworthy after this — exit and let PM2
  // restart cleanly rather than continuing to serve from a corrupt state.
  shutdown('uncaughtException', 1);
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
