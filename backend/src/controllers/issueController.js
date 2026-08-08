const Issue = require('../models/Issue');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// Fields a client is allowed to change after creation. Anything else — notably
// `userId`, `name`, `email`, `description` — is not touched by updateIssueStatus,
// so a report can't be silently rewritten once submitted.
const STATUS_FIELDS = ['status'];

function pickEditable(body) {
  const update = {};
  for (const field of STATUS_FIELDS) {
    if (typeof body[field] !== 'undefined') update[field] = body[field];
  }
  return update;
}

// Create a report (self)
exports.createIssue = asyncHandler(async (req, res) => {
  const { name, email, description } = req.body;
  const imageUrl = req.file ? `/uploads/issues/${req.file.filename}` : null;

  const issue = await Issue.create({
    userId: req.user.id,
    name,
    email,
    description,
    imageUrl
  });

  res.status(201).json({
    success: true,
    message: 'Issue reported successfully',
    data: issue
  });
});

// List the current user's own reports
exports.getMyIssues = asyncHandler(async (req, res) => {
  const issues = await Issue.find({ userId: req.user.id }).sort({ createdAt: -1 });

  res.json({
    success: true,
    count: issues.length,
    data: issues
  });
});

// Admin: list every report
exports.getAllIssuesAdmin = asyncHandler(async (req, res) => {
  const issues = await Issue.find({}).sort({ createdAt: -1 });

  res.json({
    success: true,
    count: issues.length,
    data: issues
  });
});

// Admin: change status only
exports.updateIssueStatus = asyncHandler(async (req, res) => {
  const issue = await Issue.findByIdAndUpdate(
    req.params.id,
    pickEditable(req.body),
    { new: true, runValidators: true }
  );

  if (!issue) throw new AppError('Issue report not found', 404);

  res.json({
    success: true,
    message: 'Status updated',
    data: issue
  });
});
