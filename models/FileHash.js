const mongoose = require('mongoose');

const fileHashSchema = new mongoose.Schema({
  contentHash: { type: String, required: true, unique: true },
  path: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

fileHashSchema.index({ contentHash: 1 });

module.exports = mongoose.model('FileHash', fileHashSchema);
