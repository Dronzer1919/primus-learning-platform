const mongoose = require('mongoose');

/**
 * UserSession tracks every login event.
 * Industry standard: store login method, time, device type, and session duration.
 * GDPR/CCPA compliant: no raw IPs stored, no sensitive data beyond what user consented to.
 */
const userSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  loginMethod: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  loginAt: {
    type: Date,
    default: Date.now
    // Indexed by the TTL declaration below — `index: true` here as well built a
    // second, redundant index on the same field and cost a write on every login.
  },
  logoutAt: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
    // Covered as the prefix of the compound index declared below.
  },
  sessionDurationMinutes: {
    type: Number,
    default: null  // filled on logout
  },
  // Device family only (not full user-agent string) — privacy safe
  deviceType: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'unknown'],
    default: 'unknown'
  }
}, {
  timestamps: false
});

// Auto-expire inactive sessions after 8 hours (TTL index)
userSessionSchema.index({ loginAt: 1 }, { expireAfterSeconds: 28800, partialFilterExpression: { isActive: true } });

// Serves the admin stats query `find({ isActive: false }).sort({ loginAt: -1 })`.
// The TTL index above cannot: it is partial and only covers active sessions.
userSessionSchema.index({ isActive: 1, loginAt: -1 });

module.exports = mongoose.model('UserSession', userSessionSchema);
