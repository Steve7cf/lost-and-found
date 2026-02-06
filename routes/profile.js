const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const Rating = require('../models/Rating');
const { requireAuth } = require('../middleware/auth');
const { singlePhoto } = require('../middleware/upload');
const { updateProfileRules, rateUserRules, handleValidation } = require('../validators/profile');
const { cloudinary } = require('../middleware/upload'); // Import cloudinary
const mongoose = require('mongoose');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [user, posts] = await Promise.all([
      User.findById(req.session.userId).lean(),
      Post.find({ author: req.session.userId }).sort({ createdAt: -1 }).lean(),
    ]);
    if (!user) {
      req.session.error = 'User not found.';
      return res.redirect('/auth/login');
    }
    const [ratingStats, myRatingsGiven] = await Promise.all([
      Rating.aggregate([{ $match: { toUser: user._id } }, { $group: { _id: null, avg: { $avg: '$value' }, count: { $sum: 1 } } }]),
      Rating.find({ fromUser: req.session.userId }).select('toUser value').lean(),
    ]);
    const avgRating = ratingStats[0] ? Math.round(ratingStats[0].avg * 10) / 10 : null;
    const ratingCount = ratingStats[0] ? ratingStats[0].count : 0;
    res.render('profile/index', { title: 'My Profile', user, posts, isOwn: true, avgRating, ratingCount });
  } catch (err) {
    next(err);
  }
});

router.get('/edit', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userId).lean();
    if (!user) {
      req.session.error = 'User not found.';
      return res.redirect('/auth/login');
    }
    const degreeLevels = User.degreeLevels.map(key => ({ value: key, label: User.degreeLabel(key) }));
    res.render('profile/edit', { title: 'Edit Profile', user, degreeLevels });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, singlePhoto, updateProfileRules, handleValidation, async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.error = 'User not found.';
      return res.redirect('/profile');
    }
    const { fullName, email, phone, degreeLevel, course, yearOfStudy, about } = req.body;

    // Handle photo upload
    if (req.file) {
      // Delete old photo from Cloudinary if it exists
      if (user.photo) {
        try {
          // Extract public_id from Cloudinary URL
          const urlParts = user.photo.split('/');
          const publicIdWithExt = urlParts.slice(-2).join('/'); // e.g., "lost-and-found/uuid"
          const publicId = publicIdWithExt.split('.')[0]; // Remove extension
          await cloudinary.uploader.destroy(publicId);
        } catch (err) {
          console.error('Failed to delete old photo from Cloudinary:', err);
        }
      }

      // req.file.path now contains the full Cloudinary URL
      user.photo = req.file.path;
    }

    user.fullName = (fullName || '').trim();
    user.email = (email || '').toLowerCase();
    user.phone = (phone || '').trim();
    user.degreeLevel = (degreeLevel && ['certificate', 'diploma', 'bachelor', 'masters', 'phd'].includes(degreeLevel)) ? degreeLevel : null;
    user.course = (course || '').trim();
    user.yearOfStudy = (yearOfStudy || '').trim() || null;
    user.about = (about || '').trim() || null;

    await user.save();
    req.session.user = user.toSafeObject();
    req.session.success = 'Profile updated.';
    res.redirect('/profile');
  } catch (err) {
    // No need to delete file from local filesystem anymore - Cloudinary handles it
    req.session.error = err.code === 11000 ? 'Email already in use.' : 'Failed to update profile.';
    res.redirect('/profile/edit');
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).render('404', { title: 'Not Found', layout: false });
    }
    const profileUser = await User.findById(id).select('fullName photo course regNumber degreeLevel yearOfStudy about profileViews createdAt').lean();
    if (!profileUser) {
      return res.status(404).render('404', { title: 'Profile Not Found', layout: false });
    }
    const isOwn = req.session.userId && String(profileUser._id) === String(req.session.userId);
    if (isOwn) return res.redirect('/profile');

    await User.findByIdAndUpdate(id, { $inc: { profileViews: 1 } });
    profileUser.profileViews = (profileUser.profileViews || 0) + 1;

    const [posts, ratingStats, myRating] = await Promise.all([
      Post.find({ author: id, status: 'open' }).sort({ createdAt: -1 }).limit(20).lean(),
      Rating.aggregate([{ $match: { toUser: profileUser._id } }, { $group: { _id: null, avg: { $avg: '$value' }, count: { $sum: 1 } } }]),
      req.session.userId ? Rating.findOne({ fromUser: req.session.userId, toUser: id }).lean() : null,
    ]);
    const avgRating = ratingStats[0] ? Math.round(ratingStats[0].avg * 10) / 10 : null;
    const ratingCount = ratingStats[0] ? ratingStats[0].count : 0;
    res.render('profile/view', {
      title: profileUser.fullName + ' — Profile',
      profileUser,
      posts,
      isOwn: false,
      avgRating,
      ratingCount,
      myRating: myRating ? myRating.value : null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/rate', requireAuth, rateUserRules, handleValidation, async (req, res, next) => {
  try {
    const toUserId = req.params.id;
    const fromUserId = req.session.userId;
    if (String(toUserId) === String(fromUserId)) {
      req.session.error = 'You cannot rate yourself.';
      return res.redirect(req.get('Referrer') || '/');
    }
    const value = parseInt(req.body.value, 10);
    await Rating.findOneAndUpdate(
      { fromUser: fromUserId, toUser: toUserId },
      { $set: { value, createdAt: new Date() } },
      { upsert: true, new: true }
    );
    req.session.success = 'Rating saved.';
    res.redirect(req.get('Referrer') || '/profile/' + toUserId);
  } catch (err) {
    next(err);
  }
});

module.exports = router;