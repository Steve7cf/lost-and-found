const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const DEGREE_LEVELS = ['certificate', 'diploma', 'bachelor', 'masters', 'phd'];

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  degreeLevel: { type: String, enum: DEGREE_LEVELS, default: null },
  course: { type: String, required: true, trim: true, maxlength: 150 },
  yearOfStudy: { type: String, trim: true, maxlength: 30, default: null },
  regNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 30 },
  password: { type: String, required: true, minlength: 8, select: false },
  photo: { type: String, default: null },
  about: { type: String, trim: true, maxlength: 500, default: null },
  profileViews: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

userSchema.statics.degreeLevels = DEGREE_LEVELS;
userSchema.statics.degreeLabel = function (key) {
  const labels = { certificate: 'Certificate', diploma: 'Diploma', bachelor: 'Bachelor', masters: "Master's", phd: 'PhD' };
  return labels[key] || key;
};

// email and regNumber already have unique: true in schema (creates indexes)

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
