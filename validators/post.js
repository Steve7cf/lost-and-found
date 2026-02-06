const { body, query, validationResult } = require('express-validator');

const createPostRules = [
  body('type').isIn(['lost', 'found']).withMessage('Please choose Lost or Found'),
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 150 }).withMessage('Title is too long'),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 2000 }).withMessage('Description is too long'),
  body('category').trim().notEmpty().withMessage('Category is required').isLength({ max: 80 }).withMessage('Category is too long'),
  body('location').trim().optional().isLength({ max: 120 }).withMessage('Location is too long'),
  body('dateOccurrence').optional().isISO8601().withMessage('Please enter a valid date'),
  body('contactPreference').optional().isIn(['phone', 'email', 'both']).withMessage('Please choose a contact option'),
];

const searchRules = [
  query('q').optional().trim().isLength({ max: 100 }).withMessage('Search query too long'),
  query('type').optional().trim(),
  query('category').optional().trim().isLength({ max: 80 }),
  query('status').optional().trim(),
  query('sort').optional().trim(),
  query('page').optional().isInt({ min: 1 }).toInt(),
];

function friendlyMessage(msg) {
  if (!msg || typeof msg !== 'string') return 'Please check your input.';
  const lower = msg.toLowerCase();
  if (lower.includes('invalid value') || lower.includes('invalid value(s)')) return 'Please check the form and try again.';
  return msg;
}

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msg = errors.array().map(e => e.msg).join(' ');
    req.session.error = friendlyMessage(msg);
    const back = req.get('Referrer') || '/';
    return res.redirect(back);
  }
  next();
}

module.exports = { createPostRules, searchRules, handleValidation, friendlyMessage };
