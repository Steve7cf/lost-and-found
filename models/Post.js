const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  type: { type: String, required: true, enum: ['lost', 'found'] },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, required: true, maxlength: 2000 },
  category: { type: String, required: true, trim: true, maxlength: 80 },
  location: { type: String, trim: true, maxlength: 120 },
  dateOccurrence: { type: Date },
  images: [{ type: String }],
  status: { type: String, enum: ['open', 'resolved', 'closed'], default: 'open' },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contactPreference: { type: String, enum: ['phone', 'email', 'both'], default: 'both' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

postSchema.index({ type: 1, status: 1, createdAt: -1 });
postSchema.index({ title: 'text', description: 'text', category: 'text', location: 'text' });
postSchema.index({ author: 1 });

module.exports = mongoose.model('Post', postSchema);
