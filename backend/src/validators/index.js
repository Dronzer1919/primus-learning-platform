// Request validation chains, built on express-validator (already a dependency,
// previously unused).
//
// Beyond rejecting nonsense input, these close off NoSQL injection at the door:
// every field that reaches a Mongo query is asserted to be a *string*, so a body
// like {"username": {"$ne": null}} is refused before it can become a query
// operator. express-mongo-sanitize in server.js is the second line of defence.

const { body, param, query, validationResult } = require('express-validator');

/** Collects any failures from the chains ahead of it into a single 400. */
function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    details: result.array().map((e) => ({ field: e.path, message: e.msg }))
  });
}

// Mongo will throw a CastError on a malformed id anyway (now a 400, see
// errorHandler), but catching it here keeps the DB out of it entirely.
const objectId = (name) =>
  param(name).isMongoId().withMessage('Invalid id');

// Generous ceilings: large enough that no real user hits them, small enough
// that a single request cannot be used to bloat a document without bound.
const LIMITS = {
  note: 50000,
  code: 200000,
  title: 200,
  text: 2000
};

// ─── auth ────────────────────────────────────────────────────────────────────

const registerRules = [
  body('username')
    .isString().withMessage('Username must be text')
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username may only contain letters, numbers and underscores'),
  body('email')
    .isString().withMessage('Email must be text')
    .trim()
    .isEmail().withMessage('A valid email is required')
    // Lowercase only. The default normalisation also strips dots from Gmail
    // addresses, which would store a.b@gmail.com as ab@gmail.com and then fail
    // to match the raw address Google hands us at googleLogin — creating a
    // duplicate account for the same person.
    .normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),
  body('password')
    .isString().withMessage('Password must be text')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be at least 8 characters'),
  validate
];

const loginRules = [
  body('username')
    .isString().withMessage('Username must be text')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ max: 254 }),
  body('password')
    .isString().withMessage('Password must be text')
    .notEmpty().withMessage('Password is required')
    .isLength({ max: 128 }),
  validate
];

const googleRules = [
  body('idToken')
    .isString().withMessage('idToken must be text')
    .notEmpty().withMessage('idToken is required')
    .isLength({ max: 4096 }),
  validate
];

// ─── notes ───────────────────────────────────────────────────────────────────

const createNoteRules = [
  body('content')
    .isString().withMessage('Content must be text')
    .isLength({ min: 1, max: LIMITS.note }).withMessage(`Content must be 1-${LIMITS.note} characters`),
  body('isPinned').optional().isBoolean().withMessage('isPinned must be true or false'),
  validate
];

const updateNoteRules = [
  objectId('id'),
  body('content').optional().isString().isLength({ min: 1, max: LIMITS.note }),
  body('isPinned').optional().isBoolean(),
  validate
];

// ─── sessions (todos + notes live inside a session document) ─────────────────

const sessionTitleRules = [
  body('title').optional().isString().trim().isLength({ max: LIMITS.title }),
  validate
];

const todoRules = [
  objectId('id'),
  body('text').optional().isString().trim().isLength({ min: 1, max: LIMITS.text }),
  body('completed').optional().isBoolean(),
  validate
];

const sessionNoteRules = [
  objectId('id'),
  body('content').optional().isString().isLength({ min: 1, max: LIMITS.note }),
  body('isPinned').optional().isBoolean(),
  validate
];

// ─── playground ──────────────────────────────────────────────────────────────

const playgroundRules = [
  body('title').optional().isString().trim().isLength({ max: LIMITS.title }),
  body('mode').optional().isString().isLength({ max: 50 }),
  body('selectedTab').optional().isString().isLength({ max: 50 }),
  ...['htmlCode', 'cssCode', 'jsCode', 'jsOnlyCode', 'tsCode'].map((f) =>
    body(f).optional().isString().isLength({ max: LIMITS.code })
      .withMessage(`${f} exceeds the ${LIMITS.code} character limit`)
  ),
  validate
];

// ─── flowchart ───────────────────────────────────────────────────────────────

// The element count is the bound that matters here: each node/edge is cast
// against a declared sub-schema, so its shape is already fixed, and
// express.json's 1mb limit is the outer backstop.
const flowchartRules = [
  body('title').optional().isString().trim().isLength({ max: LIMITS.title }),
  body('canvasBg').optional().isString().isLength({ max: 20 }),
  body('nodes').optional().isArray({ max: 2000 })
    .withMessage('A diagram cannot hold more than 2000 shapes'),
  body('edges').optional().isArray({ max: 4000 })
    .withMessage('A diagram cannot hold more than 4000 connections'),
  validate
];

// ─── topics / language tabs (admin-authored content) ─────────────────────────

const listTopicsRules = [
  // Coerced to strings so ?difficultyLevel[$ne]=x cannot reach the query.
  query('difficultyLevel').optional().isString().trim().isLength({ max: 50 }),
  query('languagePlatform').optional().isString().trim().isLength({ max: 50 }),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate
];

const createTopicRules = [
  body('title').isString().trim().isLength({ min: 1, max: LIMITS.title }),
  body('description').optional().isString().isLength({ max: 5000 }),
  body('difficultyLevel').optional().isString().isLength({ max: 50 }),
  body('languagePlatform').optional().isString().isLength({ max: 50 }),
  body('order').optional().isInt().toInt(),
  body('subtopics').optional().isArray(),
  validate
];

const languageTabRules = [
  body('name').isString().trim().isLength({ min: 1, max: 100 }),
  body('code').isString().trim().isLength({ min: 1, max: 50 }),
  body('order').optional().isInt().toInt(),
  body('isActive').optional().isBoolean(),
  validate
];

module.exports = {
  validate,
  objectId,
  registerRules,
  loginRules,
  googleRules,
  createNoteRules,
  updateNoteRules,
  sessionTitleRules,
  todoRules,
  sessionNoteRules,
  playgroundRules,
  flowchartRules,
  listTopicsRules,
  createTopicRules,
  languageTabRules
};
