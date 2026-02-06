const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const { requireAuth } = require('../middleware/auth');
const { postImages } = require('../middleware/upload');
const { createPostRules, searchRules, handleValidation } = require('../validators/post');
const { createCommentRules, handleValidation: handleCommentValidation } = require('../validators/comment');
const { dedupeImage } = require('../utils/dedupeImage');
const fs = require('fs').promises;

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
    const images = [];
    for (const f of req.files || []) {
      const urlPath = await dedupeImage(f.path, f.filename);
      images.push(urlPath);
    }
    const post = await Post.create({
      ...req.body,
      author: req.session.userId,
      images,
      dateOccurrence: req.body.dateOccurrence || undefined,
    });
    req.session.success = 'Post created successfully.';
    res.redirect(`/posts/${post._id}`);
  } catch (err) {
    for (const f of req.files || []) await fs.unlink(f.path).catch(() => {});
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
    const newImages = [];
    for (const f of req.files || []) {
      newImages.push(await dedupeImage(f.path, f.filename));
    }
    const images = [...(post.images || []), ...newImages].slice(0, 5);
    Object.assign(post, req.body, { images, dateOccurrence: req.body.dateOccurrence || undefined, updatedAt: new Date() });
    await post.save();
    req.session.success = 'Post updated.';
    res.redirect(`/posts/${post._id}`);
  } catch (err) {
    for (const f of req.files || []) await fs.unlink(f.path).catch(() => {});
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
    await Comment.deleteMany({ post: post._id });
    await Post.findByIdAndDelete(post._id);
    req.session.success = 'Post deleted.';
    res.redirect('/profile');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
