const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    minlength: 6
  },
  googleId: {
    type: String,
    sparse: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },

  // Profile (from Google or self-entered) — GDPR: stored with user consent
  displayName: { type: String, trim: true },
  avatar: { type: String },          // Profile picture URL only (not the image)

  // Session analytics — operational data, no PII
  lastLogin: { type: Date, default: null },
  loginCount: { type: Number, default: 0 },
  isOnline: { type: Boolean, default: false, index: true },
  lastSeen: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);
