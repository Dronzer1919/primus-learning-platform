const LanguageTab = require('../models/LanguageTab');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// Whitelisted so an update body cannot inject arbitrary paths.
const TAB_FIELDS = ['name', 'code', 'order', 'isActive'];

function pick(body) {
  const out = {};
  for (const field of TAB_FIELDS) {
    if (typeof body[field] !== 'undefined') out[field] = body[field];
  }
  return out;
}

// Get all language tabs
exports.getAllLanguageTabs = asyncHandler(async (req, res) => {
  const tabs = await LanguageTab.find().sort({ order: 1 });

  res.json({
    success: true,
    count: tabs.length,
    data: tabs
  });
});

// Get active language tabs
exports.getActiveLanguageTabs = asyncHandler(async (req, res) => {
  const tabs = await LanguageTab.find({ isActive: true }).sort({ order: 1 });

  res.json({
    success: true,
    count: tabs.length,
    data: tabs
  });
});

// Create language tab
exports.createLanguageTab = asyncHandler(async (req, res) => {
  const tab = await LanguageTab.create(pick(req.body));

  res.status(201).json({
    success: true,
    message: 'Language tab created successfully',
    data: tab
  });
});

// Update language tab
exports.updateLanguageTab = asyncHandler(async (req, res) => {
  const tab = await LanguageTab.findByIdAndUpdate(
    req.params.id,
    pick(req.body),
    { new: true, runValidators: true }
  );

  if (!tab) throw new AppError('Language tab not found', 404);

  res.json({
    success: true,
    message: 'Language tab updated successfully',
    data: tab
  });
});

// Delete language tab
exports.deleteLanguageTab = asyncHandler(async (req, res) => {
  const tab = await LanguageTab.findByIdAndDelete(req.params.id);

  if (!tab) throw new AppError('Language tab not found', 404);

  res.json({
    success: true,
    message: 'Language tab deleted successfully'
  });
});
