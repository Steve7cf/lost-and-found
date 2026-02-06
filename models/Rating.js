const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  value: { type: Number, required: true, min: 1, max: 5 },
  createdAt: { type: Date, default: Date.now },
});

ratingSchema.index({ fromUser: 1, toUser: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);
