const { body, validationResult } = require('express-validator');

const updateProfileRules = [
  body('fullName').trim().notEmpty().withMessage('Full name is required').isLength({ max: 100 }).withMessage('Name too long'),
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email').normalizeEmail(),
  body('phone').trim().notEmpty().withMessage('Phone is required').isLength({ max: 20 }).withMessage('Phone too long'),
  body('degreeLevel').optional().isIn(['certificate', 'diploma', 'bachelor', 'masters', 'phd']),
  body('course').trim().notEmpty().withMessage('Course is required').isLength({ max: 150 }).withMessage('Course too long'),
  body('yearOfStudy').trim().optional().isLength({ max: 30 }),
  body('about').trim().optional().isLength({ max: 500 }).withMessage('About is too long'),
];

const rateUserRules = [
  body('value').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
];

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.session.error = errors.array().map(e => e.msg).join(' ');
    return res.redirect(req.get('Referrer') || '/');
  }
  next();
}

module.exports = { updateProfileRules, rateUserRules, handleValidation };
