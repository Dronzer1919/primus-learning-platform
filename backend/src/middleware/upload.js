// Multer config for issue-report screenshot uploads. Disk storage under
// backend/uploads/issues, served back out by server.js's express.static mount.

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { AppError } = require('./errorHandler');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'issues');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Never trust the client's filename — a random name sidesteps path traversal
    // and collisions; the extension is re-validated (not just copied) below.
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXT.has(ext) ? ext : '';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`);
  }
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!file.mimetype.startsWith('image/') || !ALLOWED_EXT.has(ext)) {
    return cb(new AppError('Only image files (jpg, png, gif, webp) are allowed', 400));
  }
  cb(null, true);
}

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }
});
