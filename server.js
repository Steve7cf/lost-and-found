require('dotenv').config();
const path = require('path');
const express = require('express');
const connectDB = require('./config/db');
const sessionMiddleware = require('./config/session');
connectDB();
const app = express();

// Trust proxy - ADD THIS LINE BEFORE RATE LIMITERS
app.set('trust proxy', 1);

// Security & body
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
}));
app.use(mongoSanitize());

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: 'Too many login/register attempts.',
});
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
const expressLayouts = require('express-ejs-layouts');
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '1mb' }));

// Static: public + uploaded images (with safe path)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(sessionMiddleware);

// Locals for templates
const User = require('./models/User');
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.success = req.session?.success;
  res.locals.error = req.session?.error;
  res.locals.degreeLabels = { certificate: 'Certificate', diploma: 'Diploma', bachelor: 'Bachelor', masters: "Master's", phd: 'PhD' };
  if (req.session) {
    delete req.session.success;
    delete req.session.error;
  }
  next();
});

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/profile', require('./routes/profile'));
app.use('/posts', require('./routes/posts'));
app.use('/comments', require('./routes/comments'));
app.use('/', require('./routes/home'));

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found', layout: false });
});

// Error handler — friendly messages, no raw "Invalid value" or stack leaks
app.use((err, req, res, next) => {
  console.error(err);
  const msg = (err && err.message) ? String(err.message) : '';
  if (err.code === 'LIMIT_FILE_SIZE') {
    req.session.error = 'File too large. Please use images under 5MB each.';
    return res.redirect(req.get('Referrer') || '/');
  }
  if (msg.includes('Invalid file type')) {
    req.session.error = 'Please upload only JPEG, PNG, WebP or GIF images.';
    return res.redirect(req.get('Referrer') || '/');
  }
  if (err.name === 'ValidationError') {
    req.session.error = 'Please check your input and try again.';
    return res.redirect(req.get('Referrer') || '/');
  }
  res.status(500).render('500', { title: 'Server Error', layout: false });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});