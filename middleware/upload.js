const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_MB = Number(process.env.UPLOAD_MAX_SIZE_MB) || 5;
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads');
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = (file.mimetype === 'image/jpeg') ? '.jpg' : (file.mimetype === 'image/png') ? '.png' : (file.mimetype === 'image/webp') ? '.webp' : '.gif';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WebP, GIF allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_BYTES },
});

const singlePhoto = upload.single('photo');
const postImages = upload.array('images', 5);

module.exports = { singlePhoto, postImages, ALLOWED_MIMES, MAX_BYTES };
