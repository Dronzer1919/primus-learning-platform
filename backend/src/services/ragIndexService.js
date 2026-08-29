// Builds the RagChunk search index from the Topic library.
//
// Kept separate from topicController so the write path for topics never
// depends on indexing succeeding: a chunk-rebuild failure is logged and
// swallowed, never surfaced as a failed topic save.
const Topic = require('../models/Topic');
const RagChunk = require('../models/RagChunk');

// Codex blocks can be long; capping keeps any one chunk from dominating the
// context window handed to the assistant at answer time.
const MAX_CHUNK_CHARS = 6000;

function truncate(text) {
  return text.length > MAX_CHUNK_CHARS ? `${text.slice(0, MAX_CHUNK_CHARS)}…` : text;
}

/** Flattens one content block ('description' | 'code' | 'image' | 'youtube') to plain text. */
function blockToText(block) {
  const data = block && block.data;
  if (!data || typeof data !== 'object') return '';

  switch (block.type) {
    case 'description':
      return typeof data.text === 'string' ? data.text : '';
    case 'code': {
      if (typeof data.code !== 'string' || !data.code.trim()) return '';
      const title = data.title ? `${data.title}\n` : '';
      const lang = typeof data.language === 'string' ? data.language : '';
      return `${title}\`\`\`${lang}\n${data.code}\n\`\`\``;
    }
    case 'image':
      return [data.alt, data.caption].filter((s) => typeof s === 'string' && s.trim()).join(' — ');
    case 'youtube':
      return typeof data.title === 'string' ? data.title : '';
    default:
      return '';
  }
}

function blocksToText(blocks) {
  return (blocks || [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(blockToText)
    .filter(Boolean)
    .join('\n\n');
}

/** Builds (not persists) the chunk documents for one Topic document. */
function buildChunksForTopic(topic) {
  const chunks = [];

  for (const subtopic of topic.subtopics || []) {
    const ownText = blocksToText(subtopic.content);
    if (ownText.trim()) {
      chunks.push({
        topic: topic._id,
        topicTitle: topic.title,
        subtopicId: subtopic._id,
        subtopicTitle: subtopic.title,
        languagePlatform: topic.languagePlatform,
        difficultyLevel: topic.difficultyLevel,
        text: truncate(`${topic.title} > ${subtopic.title}\n\n${ownText}`)
      });
    }

    for (const subSubtopic of subtopic.subSubtopics || []) {
      const nestedText = blocksToText(subSubtopic.content);
      if (!nestedText.trim()) continue;
      chunks.push({
        topic: topic._id,
        topicTitle: topic.title,
        subtopicId: subtopic._id,
        subtopicTitle: subtopic.title,
        subSubtopicId: subSubtopic._id,
        subSubtopicTitle: subSubtopic.title,
        languagePlatform: topic.languagePlatform,
        difficultyLevel: topic.difficultyLevel,
        text: truncate(`${topic.title} > ${subtopic.title} > ${subSubtopic.title}\n\n${nestedText}`)
      });
    }
  }

  return chunks;
}

/** Rebuilds every chunk belonging to one topic. Safe to call after any topic/subtopic write. */
async function reindexTopic(topicId) {
  const topic = await Topic.findById(topicId);
  await RagChunk.deleteMany({ topic: topicId });
  if (!topic) return; // deleted mid-flight — deleteMany above already cleaned up

  const chunks = buildChunksForTopic(topic);
  if (chunks.length) await RagChunk.insertMany(chunks);
}

/** Drops every chunk for a topic that no longer exists. */
async function removeTopic(topicId) {
  await RagChunk.deleteMany({ topic: topicId });
}

/** Full rebuild across every topic. Used at boot and by the admin reindex endpoint. */
async function reindexAll() {
  const topics = await Topic.find({});
  const chunks = topics.flatMap(buildChunksForTopic);

  await RagChunk.deleteMany({});
  if (chunks.length) await RagChunk.insertMany(chunks);
  return { topics: topics.length, chunks: chunks.length };
}

/** Runs reindexAll only if the index looks empty — cheap boot-time safety net. */
async function reindexAllIfEmpty() {
  const count = await RagChunk.estimatedDocumentCount();
  if (count > 0) return { skipped: true, chunks: count };
  const result = await reindexAll();
  return { skipped: false, ...result };
}

/** Fire-and-forget wrapper for use inside request handlers — never rejects. */
function reindexTopicInBackground(topicId) {
  reindexTopic(topicId).catch((err) => {
    console.error(`[ragIndexService] failed to reindex topic ${topicId}:`, err.message);
  });
}

function removeTopicInBackground(topicId) {
  removeTopic(topicId).catch((err) => {
    console.error(`[ragIndexService] failed to remove chunks for topic ${topicId}:`, err.message);
  });
}

module.exports = {
  buildChunksForTopic,
  reindexTopic,
  removeTopic,
  reindexAll,
  reindexAllIfEmpty,
  reindexTopicInBackground,
  removeTopicInBackground
};
