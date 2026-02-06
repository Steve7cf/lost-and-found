const requireAuth = (req, res, next) => {
  if (!req.session?.userId) {
    req.session.error = 'Please log in to continue.';
    return res.redirect('/auth/login');
  }
  next();
};

const requireGuest = (req, res, next) => {
  if (req.session?.userId) {
    return res.redirect('/');
  }
  next();
};

module.exports = { requireAuth, requireGuest };
