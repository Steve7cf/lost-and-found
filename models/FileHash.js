const mongoose = require('mongoose');

const fileHashSchema = new mongoose.Schema({
  contentHash: { type: String, required: true, unique: true },
  path: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});


module.exports = mongoose.model('FileHash', fileHashSchema);
