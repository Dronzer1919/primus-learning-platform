const mongoose = require('mongoose');

const playgroundSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    default: 'New Playground'
  },
  mode: {
    type: String,
    enum: ['web', 'javascript', 'typescript'],
    default: 'web'
  },
  htmlCode: { type: String, default: '' },
  cssCode: { type: String, default: '' },
  jsCode: { type: String, default: '' },
  jsOnlyCode: { type: String, default: '' },
  tsCode: { type: String, default: '' },
  selectedTab: {
    type: String,
    enum: ['html', 'css', 'js'],
    default: 'html'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

playgroundSessionSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

playgroundSessionSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('PlaygroundSession', playgroundSessionSchema);
