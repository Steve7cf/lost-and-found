const { body, validationResult } = require('express-validator');

const createCommentRules = [
  body('body').trim().notEmpty().withMessage('Comment cannot be empty').isLength({ max: 1000 }).withMessage('Comment is too long'),
];

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.session.error = errors.array().map(e => e.msg).join(' ');
    return res.redirect(req.get('Referrer') || '/');
  }
  next();
}

module.exports = { createCommentRules, handleValidation };
