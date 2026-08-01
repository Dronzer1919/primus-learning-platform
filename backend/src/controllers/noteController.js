const UserNote = require('../models/UserNote');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// Fields a client is allowed to set. Anything else in the body — notably
// `userId` — is ignored, so a note cannot be reassigned to another account.
const EDITABLE_FIELDS = ['content', 'isPinned', 'style'];

function pickEditable(body) {
  const update = {};
  for (const field of EDITABLE_FIELDS) {
    if (typeof body[field] !== 'undefined') update[field] = body[field];
  }
  return update;
}

// Get all notes for a user
exports.getUserNotes = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const notes = await UserNote.find({ userId }).sort({ isPinned: -1, createdAt: -1 });

  res.json({
    success: true,
    count: notes.length,
    data: notes
  });
});

// Get single note
exports.getNoteById = asyncHandler(async (req, res) => {
  const note = await UserNote.findOne({ _id: req.params.id, userId: req.user.id });

  if (!note) throw new AppError('Note not found', 404);

  res.json({
    success: true,
    data: note
  });
});

// Create note
exports.createNote = asyncHandler(async (req, res) => {
  const { content, isPinned, style } = req.body;

  const note = await UserNote.create({
    userId: req.user.id,
    content,
    isPinned: isPinned || false,
    style
  });

  res.status(201).json({
    success: true,
    message: 'Note created successfully',
    data: note
  });
});

// Update note
exports.updateNote = asyncHandler(async (req, res) => {
  const note = await UserNote.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    pickEditable(req.body),
    { new: true, runValidators: true }
  );

  if (!note) throw new AppError('Note not found', 404);

  res.json({
    success: true,
    message: 'Note updated successfully',
    data: note
  });
});

// Delete note
exports.deleteNote = asyncHandler(async (req, res) => {
  const note = await UserNote.findOneAndDelete({ _id: req.params.id, userId: req.user.id });

  if (!note) throw new AppError('Note not found', 404);

  res.json({
    success: true,
    message: 'Note deleted successfully'
  });
});
