const Topic = require('../models/Topic');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// Whitelisted so a client cannot inject arbitrary paths (including `_id`) into
// an update document.
const TOPIC_FIELDS = ['title', 'description', 'difficultyLevel', 'languagePlatform', 'order', 'subtopics'];
const SUBTOPIC_FIELDS = ['title', 'order', 'content', 'subSubtopics'];

function pick(body, fields) {
  const out = {};
  for (const field of fields) {
    if (typeof body[field] !== 'undefined') out[field] = body[field];
  }
  return out;
}

// Get all topics
exports.getAllTopics = asyncHandler(async (req, res) => {
  const { difficultyLevel, languagePlatform } = req.query;

  // Validators coerce these to strings, so ?difficultyLevel[$ne]=x cannot turn
  // into a query operator. String() is belt-and-braces for direct callers.
  const query = {};
  if (difficultyLevel) query.difficultyLevel = String(difficultyLevel);
  if (languagePlatform) query.languagePlatform = String(languagePlatform);

  // Pagination is opt-in. The frontend's content service loads the whole topic
  // tree once and serves the admin editor from that cache — the editor reads
  // subtopic.content back out of it when saving, so truncating the list or
  // trimming nested fields by default would make an admin overwrite real
  // lesson content with an empty array. Topic count is admin-controlled and
  // small, so the unpaged default is not an abuse vector; ?page/?limit exist
  // for when it grows.
  const paginated = typeof req.query.page !== 'undefined' || typeof req.query.limit !== 'undefined';

  let cursor = Topic.find(query).sort({ order: 1 });
  let page = 1;
  let limit = null;

  if (paginated) {
    page = req.query.page || 1;
    limit = Math.min(req.query.limit || 20, 100);
    cursor = cursor.skip((page - 1) * limit).limit(limit);
  }

  const [topics, total] = await Promise.all([cursor, Topic.countDocuments(query)]);

  res.json({
    success: true,
    count: topics.length,
    total,
    ...(paginated && { page, totalPages: Math.ceil(total / limit) || 1 }),
    data: topics
  });
});

// Get single topic by ID
exports.getTopicById = asyncHandler(async (req, res) => {
  const topic = await Topic.findById(req.params.id);

  if (!topic) throw new AppError('Topic not found', 404);

  res.json({
    success: true,
    data: topic
  });
});

// Get subtopic content
exports.getSubtopicContent = asyncHandler(async (req, res) => {
  const { topicId, subtopicId } = req.params;

  const topic = await Topic.findById(topicId);
  if (!topic) throw new AppError('Topic not found', 404);

  const subtopic = topic.subtopics.id(subtopicId);
  if (!subtopic) throw new AppError('Subtopic not found', 404);

  res.json({
    success: true,
    data: {
      topic: {
        id: topic._id,
        title: topic.title,
        description: topic.description
      },
      subtopic: subtopic
    }
  });
});

// Create topic
exports.createTopic = asyncHandler(async (req, res) => {
  const topic = await Topic.create({
    ...pick(req.body, TOPIC_FIELDS),
    subtopics: req.body.subtopics || []
  });

  res.status(201).json({
    success: true,
    message: 'Topic created successfully',
    data: topic
  });
});

// Update topic
exports.updateTopic = asyncHandler(async (req, res) => {
  const topic = await Topic.findByIdAndUpdate(
    req.params.id,
    pick(req.body, TOPIC_FIELDS),
    { new: true, runValidators: true }
  );

  if (!topic) throw new AppError('Topic not found', 404);

  res.json({
    success: true,
    message: 'Topic updated successfully',
    data: topic
  });
});

// Delete topic
exports.deleteTopic = asyncHandler(async (req, res) => {
  const topic = await Topic.findByIdAndDelete(req.params.id);

  if (!topic) throw new AppError('Topic not found', 404);

  res.json({
    success: true,
    message: 'Topic deleted successfully'
  });
});

// Add subtopic to topic
exports.addSubtopic = asyncHandler(async (req, res) => {
  const topic = await Topic.findById(req.params.topicId);
  if (!topic) throw new AppError('Topic not found', 404);

  const { title, order, content, subSubtopics } = req.body;
  topic.subtopics.push({
    title,
    order,
    content: content || [],
    subSubtopics: subSubtopics || []
  });

  await topic.save();

  res.status(201).json({
    success: true,
    message: 'Subtopic added successfully',
    data: topic
  });
});

// Update subtopic
exports.updateSubtopic = asyncHandler(async (req, res) => {
  const { topicId, subtopicId } = req.params;

  const topic = await Topic.findById(topicId);
  if (!topic) throw new AppError('Topic not found', 404);

  const subtopic = topic.subtopics.id(subtopicId);
  if (!subtopic) throw new AppError('Subtopic not found', 404);

  Object.assign(subtopic, pick(req.body, SUBTOPIC_FIELDS));
  await topic.save();

  res.json({
    success: true,
    message: 'Subtopic updated successfully',
    data: topic
  });
});

// Delete subtopic
exports.deleteSubtopic = asyncHandler(async (req, res) => {
  const { topicId, subtopicId } = req.params;

  const topic = await Topic.findById(topicId);
  if (!topic) throw new AppError('Topic not found', 404);

  const subtopic = topic.subtopics.id(subtopicId);
  if (!subtopic) throw new AppError('Subtopic not found', 404);

  topic.subtopics.pull(subtopicId);
  await topic.save();

  res.json({
    success: true,
    message: 'Subtopic deleted successfully',
    data: topic
  });
});
