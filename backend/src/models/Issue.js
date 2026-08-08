const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  description: {
    type: String,
    required: true
  },
  // Relative path under /uploads (e.g. "/uploads/issues/<file>"), not an absolute
  // URL — the API's own origin varies between dev and prod, so the frontend
  // resolves it against environment.apiUrl.
  imageUrl: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'resolved', 'rejected'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

issueSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

issueSchema.index({ userId: 1, createdAt: -1 });
issueSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Issue', issueSchema);
