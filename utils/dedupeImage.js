const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const FileHash = require('../models/FileHash');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

/**
 * Deduplicate an uploaded file by content hash.
 * If the same content already exists, delete the new file and return the existing path.
 * @param {string} filePath - Full filesystem path of the uploaded file
 * @param {string} filename - Original filename (e.g. from multer)
 * @returns {Promise<string>} URL path to use (e.g. /uploads/xxx.jpg)
 */
async function dedupeImage(filePath, filename) {
  const buf = await fs.readFile(filePath);
  const contentHash = crypto.createHash('sha256').update(buf).digest('hex');
  const urlPath = `/uploads/${filename}`;

  const existing = await FileHash.findOne({ contentHash }).lean();
  if (existing) {
    await fs.unlink(filePath).catch(() => {});
    return existing.path;
  }

  await FileHash.create({ contentHash, path: urlPath });
  return urlPath;
}

module.exports = { dedupeImage };
