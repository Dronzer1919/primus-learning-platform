const mongoose = require('mongoose');

const userNoteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  isPinned: {
    type: Boolean,
    default: false
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

userNoteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

userNoteSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('UserNote', userNoteSchema);
