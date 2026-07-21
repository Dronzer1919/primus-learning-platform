const mongoose = require('mongoose');

const contentBlockSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['description', 'code', 'image', 'youtube'],
    required: true
  },
  order: {
    type: Number,
    required: true,
    default: 0
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  }
});

const subSubtopicSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    required: true,
    default: 0
  },
  content: [contentBlockSchema]
});

const subtopicSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    required: true,
    default: 0
  },
  subSubtopics: [subSubtopicSchema],
  content: [contentBlockSchema]
});

const topicSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  difficultyLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advance', 'expert'],
    required: true
  },
  languagePlatform: {
    type: String,
    enum: ['html', 'scss', 'css', 'typescript', 'javascript', 'angular', 'nodejs', 'rxjs'],
    required: true
  },
  order: {
    type: Number,
    required: true,
    default: 0
  },
  subtopics: [subtopicSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

topicSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

topicSchema.index({ difficultyLevel: 1, languagePlatform: 1, order: 1 });

module.exports = mongoose.model('Topic', topicSchema);
