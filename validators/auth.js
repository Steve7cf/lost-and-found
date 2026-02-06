const { body, validationResult } = require('express-validator');

const registerRules = [
  body('fullName').trim().notEmpty().withMessage('Full name is required').isLength({ max: 100 }).withMessage('Name too long'),
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email').normalizeEmail(),
  body('phone').trim().notEmpty().withMessage('Phone is required').isLength({ max: 20 }).withMessage('Phone number is too long'),
  body('degreeLevel').isIn(['certificate', 'diploma', 'bachelor', 'masters', 'phd']).withMessage('Please select a degree level'),
  body('course').trim().notEmpty().withMessage('Course is required').isLength({ max: 150 }).withMessage('Course name is too long'),
  body('yearOfStudy').trim().notEmpty().withMessage('Year of study is required').isLength({ max: 30 }).withMessage('Year of study is too long'),
  body('regNumber').trim().notEmpty().withMessage('Registration number is required').isLength({ max: 30 }).withMessage('Registration number is too long').toUpperCase(),
  body('password').notEmpty().withMessage('Password is required').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('passwordConfirm').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match'),
];

const loginRules = [
  body('regNumber').trim().notEmpty().withMessage('Registration number is required').toUpperCase(),
  body('password').notEmpty().withMessage('Password is required'),
];

function friendlyMessage(msg) {
  if (!msg || typeof msg !== 'string') return 'Please check your input.';
  const lower = msg.toLowerCase();
  if (lower.includes('invalid value') || lower.includes('invalid value(s)')) return 'Please check the highlighted fields and try again.';
  return msg;
}

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msg = errors.array().map(e => e.msg).join(' ');
    req.session.error = friendlyMessage(msg);
    if (req.method === 'POST' && req.originalUrl.includes('/auth/register')) {
      req.session.registerForm = {
        fullName: req.body.fullName,
        email: req.body.email,
        phone: req.body.phone,
        degreeLevel: req.body.degreeLevel,
        course: req.body.course,
        yearOfStudy: req.body.yearOfStudy,
        regNumber: req.body.regNumber,
      };
    }
    const back = req.get('Referrer') || '/';
    return res.redirect(back);
  }
  next();
}

module.exports = { registerRules, loginRules, handleValidation, friendlyMessage };
