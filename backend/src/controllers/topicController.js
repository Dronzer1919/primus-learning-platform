const Topic = require('../models/Topic');

// Get all topics
exports.getAllTopics = async (req, res) => {
  try {
    const { difficultyLevel, languagePlatform } = req.query;
    
    let query = {};
    if (difficultyLevel) query.difficultyLevel = difficultyLevel;
    if (languagePlatform) query.languagePlatform = languagePlatform;

    const topics = await Topic.find(query).sort({ order: 1 });
    
    res.json({
      success: true,
      count: topics.length,
      data: topics
    });
  } catch (error) {
    console.error('Get topics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Get single topic by ID
exports.getTopicById = async (req, res) => {
  try {
    const { id } = req.params;

    const topic = await Topic.findById(id);

    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: 'Topic not found' 
      });
    }

    res.json({
      success: true,
      data: topic
    });
  } catch (error) {
    console.error('Get topic error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Get subtopic content
exports.getSubtopicContent = async (req, res) => {
  try {
    const { topicId, subtopicId } = req.params;

    const topic = await Topic.findById(topicId);

    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: 'Topic not found' 
      });
    }

    const subtopic = topic.subtopics.id(subtopicId);

    if (!subtopic) {
      return res.status(404).json({ 
        success: false, 
        message: 'Subtopic not found' 
      });
    }

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
  } catch (error) {
    console.error('Get subtopic content error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Create topic
exports.createTopic = async (req, res) => {
  try {
    const { title, description, difficultyLevel, languagePlatform, order, subtopics } = req.body;

    const topic = new Topic({
      title,
      description,
      difficultyLevel,
      languagePlatform,
      order,
      subtopics: subtopics || []
    });

    await topic.save();

    res.status(201).json({
      success: true,
      message: 'Topic created successfully',
      data: topic
    });
  } catch (error) {
    console.error('Create topic error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Update topic
exports.updateTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const topic = await Topic.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: 'Topic not found' 
      });
    }

    res.json({
      success: true,
      message: 'Topic updated successfully',
      data: topic
    });
  } catch (error) {
    console.error('Update topic error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Delete topic
exports.deleteTopic = async (req, res) => {
  try {
    const { id } = req.params;

    const topic = await Topic.findByIdAndDelete(id);

    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: 'Topic not found' 
      });
    }

    res.json({
      success: true,
      message: 'Topic deleted successfully'
    });
  } catch (error) {
    console.error('Delete topic error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Add subtopic to topic
exports.addSubtopic = async (req, res) => {
  try {
    const { topicId } = req.params;
    const { title, order, content, subSubtopics } = req.body;

    const topic = await Topic.findById(topicId);

    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: 'Topic not found' 
      });
    }

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
  } catch (error) {
    console.error('Add subtopic error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Update subtopic
exports.updateSubtopic = async (req, res) => {
  try {
    const { topicId, subtopicId } = req.params;
    const updateData = req.body;

    const topic = await Topic.findById(topicId);

    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: 'Topic not found' 
      });
    }

    const subtopic = topic.subtopics.id(subtopicId);

    if (!subtopic) {
      return res.status(404).json({ 
        success: false, 
        message: 'Subtopic not found' 
      });
    }

    Object.assign(subtopic, updateData);
    await topic.save();

    res.json({
      success: true,
      message: 'Subtopic updated successfully',
      data: topic
    });
  } catch (error) {
    console.error('Update subtopic error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Delete subtopic
exports.deleteSubtopic = async (req, res) => {
  try {
    const { topicId, subtopicId } = req.params;

    const topic = await Topic.findById(topicId);

    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        message: 'Topic not found' 
      });
    }

    topic.subtopics.pull(subtopicId);
    await topic.save();

    res.json({
      success: true,
      message: 'Subtopic deleted successfully',
      data: topic
    });
  } catch (error) {
    console.error('Delete subtopic error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};
