const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Rating = require('../models/Rating');
const User = require('../models/User');

const PER_PAGE = 12;

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const type = req.query.type === 'lost' || req.query.type === 'found' ? req.query.type : null;
    const q = (req.query.q || '').trim().slice(0, 100);
    const filter = { status: 'open' };
    if (type) filter.type = type;
    if (q) {
      filter.$or = [
        { title: new RegExp(escapeRegex(q), 'i') },
        { description: new RegExp(escapeRegex(q), 'i') },
        { category: new RegExp(escapeRegex(q), 'i') },
        { location: new RegExp(escapeRegex(q), 'i') },
      ];
    }
    const topContributorsPromise = Rating.aggregate([
      { $group: { _id: '$toUser', avg: { $avg: '$value' }, count: { $sum: 1 } } },
      { $sort: { avg: -1, count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { avg: 1, count: 1, fullName: '$user.fullName', photo: '$user.photo', userId: '$_id' } },
    ]);
    const [posts, total, topContributors] = await Promise.all([
      Post.find(filter).populate('author', 'fullName photo course degreeLevel yearOfStudy').sort({ createdAt: -1 }).skip((page - 1) * PER_PAGE).limit(PER_PAGE).lean(),
      Post.countDocuments(filter),
      topContributorsPromise,
    ]);
    const totalPages = Math.ceil(total / PER_PAGE);
    res.render('home', {
      title: 'KIU Lost & Found',
      posts,
      total,
      page,
      totalPages,
      query: req.query.q || '',
      typeFilter: type,
      topContributors: topContributors || [],
    });
  } catch (err) {
    next(err);
  }
});

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = router;
