// Tiered rate limiting + a temporary IP blocklist.
//
// Three tiers, loosest to strictest:
//   globalLimiter — a wide net that only catches genuine floods
//   writeLimiter  — mutating requests, which cost far more than reads
//   authLimiter   — login/register/google, where brute force actually pays off.
//                   Breaching this one also blocks the IP outright for a while.
//
// The counters live in this process's memory. That is correct while
// ecosystem.config.js runs `instances: 1, exec_mode: 'fork'` — there is one
// process, so there is nothing to share. If that ever becomes `cluster` (or a
// second container is added), every worker would keep its own counters and the
// effective limit would multiply by the worker count; switch to a shared store
// (rate-limit-redis) at that point.
//
// All of this keys off req.ip, which is only the real client IP because
// server.js sets `trust proxy` — nginx is in front of us in production.

const rateLimit = require('express-rate-limit');

const MINUTE = 60 * 1000;
const BLOCK_DURATION_MS = 15 * MINUTE;

// Cap the blocklist so it cannot itself be turned into a memory-exhaustion
// vector: an attacker rotating through spoofed-looking IPs would otherwise grow
// this map without bound. At the cap we stop adding rather than evicting, so an
// existing block is never cut short by a flood of new ones.
const MAX_BLOCKED_IPS = 10000;

/** @type {Map<string, number>} ip -> epoch ms when the block expires */
const blockedIps = new Map();

function blockIp(ip, durationMs = BLOCK_DURATION_MS) {
  if (!ip) return;
  // Refreshing an existing block is always allowed; only *new* entries are capped.
  if (!blockedIps.has(ip) && blockedIps.size >= MAX_BLOCKED_IPS) return;
  blockedIps.set(ip, Date.now() + durationMs);
}

function isBlocked(ip) {
  const expiresAt = blockedIps.get(ip);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    blockedIps.delete(ip);
    return false;
  }
  return true;
}

// Sweep expired entries so the map does not grow with stale blocks.
// .unref() keeps this timer from holding the event loop open at shutdown.
const sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, expiresAt] of blockedIps) {
    if (expiresAt <= now) blockedIps.delete(ip);
  }
}, 5 * MINUTE);
sweepTimer.unref();

/**
 * Rejects blocked IPs before any routing, parsing or DB work happens.
 * Mount this first, ahead of the limiters themselves.
 */
function blocklistGuard(req, res, next) {
  const expiresAt = blockedIps.get(req.ip);
  if (!isBlocked(req.ip)) return next();

  const retryAfterSec = Math.ceil((expiresAt - Date.now()) / 1000);
  res.set('Retry-After', String(retryAfterSec));
  return res.status(429).json({
    success: false,
    message: 'Too many requests from this IP. Access temporarily blocked.',
    retryAfterSeconds: retryAfterSec
  });
}

const limiterDefaults = {
  standardHeaders: true, // RateLimit-* headers, so clients can back off politely
  legacyHeaders: false
};

// Wide net: normal browsing never comes close. A single page load is a handful
// of calls and the admin dashboard polls once every 30s.
const globalLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: MINUTE,
  limit: 300,
  // Uptime monitors hit /api/health constantly; never throttle them.
  skip: (req) => req.path === '/health' || req.path === '/api/health',
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please slow down and try again shortly.'
    })
});

// Mutating requests: cheaper to abuse, more expensive to serve.
const writeLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: MINUTE,
  limit: 100,
  // Reads are already covered by globalLimiter; only meter writes here.
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      message: 'Too many write requests. Please wait a moment and try again.'
    })
});

// The strict tier. 40 attempts per minute is far above what a human logging in
// needs and far below what a password-guessing script wants. Breaching it means
// the traffic is automated, so the IP gets blocked outright.
const authLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: MINUTE,
  limit: 40,
  // Only *failed* attempts count. A successful login is evidence of a real
  // user, so a shared office or school IP with many legitimate sign-ins never
  // trips this — while a guessing script, which fails by definition, hits 40
  // almost immediately. Registration spam is separately capped by writeLimiter.
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    blockIp(req.ip);
    res.set('Retry-After', String(BLOCK_DURATION_MS / 1000));
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts. This IP is blocked for 15 minutes.',
      retryAfterSeconds: BLOCK_DURATION_MS / 1000
    });
  }
});

module.exports = {
  blocklistGuard,
  globalLimiter,
  writeLimiter,
  authLimiter,
  // exported for tests / operational tooling
  blockIp,
  isBlocked,
  blockedIps
};
