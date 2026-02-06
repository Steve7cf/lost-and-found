const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireGuest, requireAuth } = require('../middleware/auth');
const { singlePhoto, cloudinary } = require('../middleware/upload'); // Import cloudinary
const { registerRules, loginRules, handleValidation } = require('../validators/auth');


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
    console.log('Registration started'); // Debug log
    console.log('req.file:', req.file); // Debug log

    const { fullName, email, phone, degreeLevel, course, yearOfStudy, regNumber, password } = req.body;

    const existing = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { regNumber: regNumber.trim().toUpperCase() }
      ]
    });

    if (existing) {
      // Delete uploaded image from Cloudinary if user already exists
      if (req.file) {
        try {
          const publicId = req.file.filename; // Cloudinary stores public_id in filename
          await cloudinary.uploader.destroy(`lost-and-found/${publicId}`);
        } catch (err) {
          console.error('Failed to delete Cloudinary image:', err);
        }
      }
      req.session.error = 'Email or registration number already registered.';
      return res.redirect('/auth/register');
    }

    // Get photo URL from Cloudinary (stored in req.file.path)
    let photo = null;
    if (req.file) {
      photo = req.file.path; // This is the full Cloudinary URL
      console.log('Photo URL from Cloudinary:', photo); // Debug log
    }

    console.log('Creating user with data:', { fullName, email, photo }); // Debug log

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

    console.log('User created successfully:', user._id); // Debug log

    req.session.userId = user._id;
    req.session.user = user.toSafeObject();
    req.session.success = 'Account created. Welcome to KIU Lost & Found.';
    res.redirect('/');
  } catch (err) {
    console.error('Registration error:', err); // Debug log
    console.error('Error stack:', err.stack); // Debug log

    // Delete uploaded image from Cloudinary on error
    if (req.file) {
      try {
        const publicId = req.file.filename;
        await cloudinary.uploader.destroy(`lost-and-found/${publicId}`);
        console.log('Deleted Cloudinary image after error'); // Debug log
      } catch (deleteErr) {
        console.error('Failed to delete Cloudinary image:', deleteErr);
      }
    }

    req.session.error = err.code === 11000
      ? 'Email or registration number already in use.'
      : 'Registration failed. Try again.';
    res.redirect('/auth/register');
  }
});

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;