const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const { requireAuth } = require('../middleware/auth');
const { postImages, cloudinary } = require('../middleware/upload'); // Import cloudinary
const { createPostRules, searchRules, handleValidation } = require('../validators/post');
const { createCommentRules, handleValidation: handleCommentValidation } = require('../validators/comment');
// Remove these - no longer needed:
// const { dedupeImage } = require('../utils/dedupeImage');
// const fs = require('fs').promises;

const PER_PAGE = 12;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// List with search, filters, and smart sorting
router.get('/', searchRules, handleValidation, async (req, res, next) => {
  try {
    const page = Math.max(1, req.query.page || 1);
    const q = (req.query.q || '').trim().slice(0, 100);
    const type = req.query.type === 'lost' || req.query.type === 'found' ? req.query.type : null;
    const category = (req.query.category || '').trim().slice(0, 80);
    const status = ['open', 'resolved', 'closed'].includes(req.query.status) ? req.query.status : 'open';
    const sort = ['newest', 'oldest', 'relevance'].includes(req.query.sort) ? req.query.sort : 'newest';

    const filter = { status };
    if (type) filter.type = type;
    if (category) filter.category = new RegExp(escapeRegex(category), 'i');

    let query = Post.find(filter).populate('author', 'fullName photo course regNumber degreeLevel yearOfStudy');

    if (q) {
      const textFilter = {
        $or: [
          { title: new RegExp(escapeRegex(q), 'i') },
          { description: new RegExp(escapeRegex(q), 'i') },
          { category: new RegExp(escapeRegex(q), 'i') },
          { location: new RegExp(escapeRegex(q), 'i') },
        ],
      };
      query = query.find(textFilter);
      filter.$or = textFilter.$or;
    }

    if (sort === 'oldest') query = query.sort({ createdAt: 1 });
    else query = query.sort({ createdAt: -1 });

    const [posts, total] = await Promise.all([
      query.skip((page - 1) * PER_PAGE).limit(PER_PAGE).lean(),
      Post.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / PER_PAGE);

    const categories = await Post.distinct('category', { status: 'open' }).then(c => c.sort());

    res.render('posts/list', {
      title: 'Browse Lost & Found',
      posts,
      total,
      page,
      totalPages,
      query: q,
      typeFilter: type,
      categoryFilter: category,
      statusFilter: status,
      sort,
      categories,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/new', requireAuth, (req, res) => {
  res.render('posts/form', { title: 'New Post', post: null });
});

router.post('/', requireAuth, postImages, createPostRules, handleValidation, async (req, res, next) => {
  try {
    console.log('Creating post, files received:', req.files?.length || 0); // Debug

    // Get Cloudinary URLs from uploaded files
    const images = (req.files || []).map(f => f.path); // f.path contains Cloudinary URL

    console.log('Image URLs:', images); // Debug

    const post = await Post.create({
      ...req.body,
      author: req.session.userId,
      images,
      dateOccurrence: req.body.dateOccurrence || undefined,
    });

    console.log('Post created successfully:', post._id); // Debug

    req.session.success = 'Post created successfully.';
    res.redirect(`/posts/${post._id}`);
  } catch (err) {
    console.error('Post creation error:', err); // Debug

    // Delete uploaded images from Cloudinary on error
    for (const f of req.files || []) {
      try {
        const publicId = f.filename; // Cloudinary public_id
        await cloudinary.uploader.destroy(`lost-and-found/${publicId}`);
      } catch (deleteErr) {
        console.error('Failed to delete Cloudinary image:', deleteErr);
      }
    }

    req.session.error = 'Failed to create post.';
    res.redirect('/posts/new');
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'fullName photo course regNumber degreeLevel yearOfStudy').lean();
    if (!post) {
      res.status(404).render('404', { title: 'Post Not Found' });
      return;
    }
    const [sameType, comments] = await Promise.all([
      Post.find({ type: post.type, status: 'open', _id: { $ne: post._id } })
        .sort({ createdAt: -1 }).limit(4).populate('author', 'fullName').lean(),
      Comment.find({ post: post._id }).populate('author', 'fullName photo').sort({ createdAt: 1 }).lean(),
    ]);
    res.render('posts/detail', { title: post.title, post, similar: sameType, comments: comments || [] });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/comments', requireAuth, createCommentRules, handleCommentValidation, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      req.session.error = 'Post not found.';
      return res.redirect('/posts');
    }
    await Comment.create({
      post: post._id,
      author: req.session.userId,
      body: req.body.body.trim(),
    });
    req.session.success = 'Comment added.';
    res.redirect('/posts/' + post._id + '#comments');
  } catch (err) {
    next(err);
  }
});

router.get('/:id/edit', requireAuth, async (req, res, next) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, author: req.session.userId }).lean();
    if (!post) {
      req.session.error = 'Post not found or you cannot edit it.';
      return res.redirect('/posts');
    }
    res.render('posts/form', { title: 'Edit Post', post });
  } catch (err) {
    next(err);
  }
});

router.post('/:id', requireAuth, postImages, createPostRules, handleValidation, async (req, res, next) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, author: req.session.userId });
    if (!post) {
      req.session.error = 'Post not found or you cannot edit it.';
      return res.redirect('/posts');
    }

    // Get new Cloudinary URLs
    const newImages = (req.files || []).map(f => f.path);

    // Combine existing and new images (max 5)
    const images = [...(post.images || []), ...newImages].slice(0, 5);

    // If we had to remove images due to limit, delete them from Cloudinary
    if ([...(post.images || []), ...newImages].length > 5) {
      const removedImages = [...(post.images || []), ...newImages].slice(5);
      for (const imageUrl of removedImages) {
        try {
          // Extract public_id from Cloudinary URL
          const urlParts = imageUrl.split('/');
          const publicIdWithExt = urlParts.slice(-2).join('/');
          const publicId = publicIdWithExt.split('.')[0];
          await cloudinary.uploader.destroy(publicId);
        } catch (err) {
          console.error('Failed to delete excess image:', err);
        }
      }
    }

    Object.assign(post, req.body, { images, dateOccurrence: req.body.dateOccurrence || undefined, updatedAt: new Date() });
    await post.save();
    req.session.success = 'Post updated.';
    res.redirect(`/posts/${post._id}`);
  } catch (err) {
    console.error('Post update error:', err); // Debug

    // Delete newly uploaded images from Cloudinary on error
    for (const f of req.files || []) {
      try {
        const publicId = f.filename;
        await cloudinary.uploader.destroy(`lost-and-found/${publicId}`);
      } catch (deleteErr) {
        console.error('Failed to delete Cloudinary image:', deleteErr);
      }
    }

    req.session.error = 'Failed to update post.';
    res.redirect(`/posts/${req.params.id}/edit`);
  }
});

router.post('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, author: req.session.userId });
    if (!post) {
      req.session.error = 'Post not found.';
      return res.redirect('/posts');
    }
    const status = ['open', 'resolved', 'closed'].includes(req.body.status) ? req.body.status : post.status;
    post.status = status;
    await post.save();
    req.session.success = 'Status updated.';
    res.redirect(`/posts/${post._id}`);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/delete', requireAuth, async (req, res, next) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, author: req.session.userId });
    if (!post) {
      req.session.error = 'Post not found or you cannot delete it.';
      return res.redirect('/profile');
    }

    // Delete all images from Cloudinary
    for (const imageUrl of post.images || []) {
      try {
        const urlParts = imageUrl.split('/');
        const publicIdWithExt = urlParts.slice(-2).join('/');
        const publicId = publicIdWithExt.split('.')[0];
        await cloudinary.uploader.destroy(publicId);
        console.log('Deleted image from Cloudinary:', publicId);
      } catch (err) {
        console.error('Failed to delete image from Cloudinary:', err);
      }
    }

    await Comment.deleteMany({ post: post._id });
    await Post.findByIdAndDelete(post._id);
    req.session.success = 'Post deleted.';
    res.redirect('/profile');
  } catch (err) {
    next(err);
  }
});

module.exports = router;