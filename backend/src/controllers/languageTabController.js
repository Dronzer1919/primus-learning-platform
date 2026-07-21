const LanguageTab = require('../models/LanguageTab');

// Get all language tabs
exports.getAllLanguageTabs = async (req, res) => {
  try {
    const tabs = await LanguageTab.find().sort({ order: 1 });
    
    res.json({
      success: true,
      count: tabs.length,
      data: tabs
    });
  } catch (error) {
    console.error('Get language tabs error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Get active language tabs
exports.getActiveLanguageTabs = async (req, res) => {
  try {
    const tabs = await LanguageTab.find({ isActive: true }).sort({ order: 1 });
    
    res.json({
      success: true,
      count: tabs.length,
      data: tabs
    });
  } catch (error) {
    console.error('Get active language tabs error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Create language tab
exports.createLanguageTab = async (req, res) => {
  try {
    const { name, code, order, isActive } = req.body;

    const tab = new LanguageTab({
      name,
      code,
      order,
      isActive
    });

    await tab.save();

    res.status(201).json({
      success: true,
      message: 'Language tab created successfully',
      data: tab
    });
  } catch (error) {
    console.error('Create language tab error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Update language tab
exports.updateLanguageTab = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const tab = await LanguageTab.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!tab) {
      return res.status(404).json({ 
        success: false, 
        message: 'Language tab not found' 
      });
    }

    res.json({
      success: true,
      message: 'Language tab updated successfully',
      data: tab
    });
  } catch (error) {
    console.error('Update language tab error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Delete language tab
exports.deleteLanguageTab = async (req, res) => {
  try {
    const { id } = req.params;

    const tab = await LanguageTab.findByIdAndDelete(id);

    if (!tab) {
      return res.status(404).json({ 
        success: false, 
        message: 'Language tab not found' 
      });
    }

    res.json({
      success: true,
      message: 'Language tab deleted successfully'
    });
  } catch (error) {
    console.error('Delete language tab error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};
