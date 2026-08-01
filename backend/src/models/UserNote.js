const mongoose = require('mongoose');

// Per-note presentation. Every field is optional: an absent value means "use the
// app's theme default", so an unstyled note carries no style object at all.
// _id is off because this is a value object, not a document in its own right.
const noteStyleSchema = new mongoose.Schema({
  bgColor: String,
  textColor: String,
  fontFamily: String,
  fontSize: Number,
  bold: Boolean,
  italic: Boolean,
  underline: Boolean,
  strikethrough: Boolean,
  align: { type: String, enum: ['left', 'center', 'right'] }
}, { _id: false });

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
  // `default: undefined` keeps mongoose from writing an empty {} onto every note.
  style: {
    type: noteStyleSchema,
    default: undefined
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
