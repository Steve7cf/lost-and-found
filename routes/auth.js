const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireGuest, requireAuth } = require('../middleware/auth');
const { singlePhoto } = require('../middleware/upload');
const { registerRules, loginRules, handleValidation } = require('../validators/auth');
const { dedupeImage } = require('../utils/dedupeImage');
const fs = require('fs').promises;
const path = require('path');

router.get('/login', requireGuest, (req, res) => {
  res.render('auth/login', { title: 'Log in' });
});

router.post('/login', requireGuest, loginRules, handleValidation, async (req, res) => {
  try {
    const user = await User.findOne({ regNumber: req.body.regNumber.trim().toUpperCase() }).select('+password');
    if (!user || !(await user.comparePassword(req.body.password))) {
      req.session.error = 'Invalid registration number or password.';
      return res.redirect('/auth/login');
    }
    req.session.userId = user._id;
    req.session.user = user.toSafeObject();
    req.session.success = `Welcome back, ${user.fullName}.`;
    res.redirect('/');
  } catch (err) {
    req.session.error = 'Login failed. Try again.';
    res.redirect('/auth/login');
  }
});

router.get('/register', requireGuest, (req, res) => {
  const degreeLevels = User.degreeLevels.map(key => ({ value: key, label: User.degreeLabel(key) }));
  const registerForm = req.session.registerForm || {};
  delete req.session.registerForm;
  res.render('auth/register', { title: 'Register', degreeLevels, registerForm });
});

router.post('/register', requireGuest, singlePhoto, registerRules, handleValidation, async (req, res) => {
  try {
    const { fullName, email, phone, degreeLevel, course, yearOfStudy, regNumber, password } = req.body;
    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { regNumber: regNumber.trim().toUpperCase() }] });
    if (existing) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      req.session.error = 'Email or registration number already registered.';
      return res.redirect('/auth/register');
    }
    let photo = null;
    if (req.file) {
      photo = await dedupeImage(req.file.path, req.file.filename);
    }
    const user = await User.create({
      fullName: fullName.trim(),
      email: email.toLowerCase(),
      phone: phone.trim(),
      degreeLevel,
      course: course.trim(),
      yearOfStudy: yearOfStudy.trim(),
      regNumber: regNumber.trim().toUpperCase(),
      password,
      photo,
    });
    req.session.userId = user._id;
    req.session.user = user.toSafeObject();
    req.session.success = 'Account created. Welcome to KIU Lost & Found.';
    res.redirect('/');
  } catch (err) {
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    req.session.error = err.code === 11000 ? 'Email or registration number already in use.' : 'Registration failed. Try again.';
    res.redirect('/auth/register');
  }
});

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
