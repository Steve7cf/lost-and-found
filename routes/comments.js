const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');

const { requireAuth } = require('../middleware/auth');

router.post('/:id/delete', requireAuth, async (req, res, next) => {
  try {
    const comment = await Comment.findOne({ _id: req.params.id, author: req.session.userId });
    if (!comment) {
      req.session.error = 'Comment not found or you cannot delete it.';
      return res.redirect(req.get('Referrer') || '/posts');
    }
    const postId = comment.post;
    await Comment.findByIdAndDelete(comment._id);
    req.session.success = 'Comment removed.';
    res.redirect('/posts/' + postId + '#comments');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
