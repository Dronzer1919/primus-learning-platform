// The RAG assistant's search index. One document per subtopic (and per
// subSubtopic) in the Topic library, flattened to plain text so MongoDB's
// $text index can find it. Rebuilt by services/ragIndexService.js — never
// edited directly, so every field here is derived, not user-authored.
const mongoose = require('mongoose');

const ragChunkSchema = new mongoose.Schema({
  topic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    required: true,
    index: true
  },
  topicTitle: { type: String, required: true },
  subtopicId: { type: mongoose.Schema.Types.ObjectId, required: true },
  subtopicTitle: { type: String, required: true },
  // Set only for a chunk sourced from a subSubtopic rather than the
  // subtopic's own content blocks.
  subSubtopicId: { type: mongoose.Schema.Types.ObjectId },
  subSubtopicTitle: { type: String },
  languagePlatform: { type: String, required: true, index: true },
  difficultyLevel: { type: String, required: true },
  // Flattened, human-readable text extracted from the content blocks —
  // what actually gets searched and fed to the assistant as context.
  text: { type: String, required: true }
}, { timestamps: true });

// MongoDB allows only one text index per collection; combining the three
// fields into one lets a query match on title words or body words alike,
// weighted so a title hit ranks above a body hit of the same term.
ragChunkSchema.index(
  { text: 'text', topicTitle: 'text', subtopicTitle: 'text' },
  { weights: { topicTitle: 5, subtopicTitle: 3, text: 1 }, name: 'rag_text_search' }
);

module.exports = mongoose.model('RagChunk', ragChunkSchema);
