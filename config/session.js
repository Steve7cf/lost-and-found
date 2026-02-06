const session = require('express-session');
const MongoStore = require('connect-mongo');

const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/kiu-lost-found';
if (!process.env.MONGODB_URI) {
  console.warn('Session: MONGODB_URI not set; using default. Copy .env.example to .env and set MONGODB_URI.');
}

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl,
    ttl: 14 * 24 * 60 * 60, // 14 days
    touchAfter: 24 * 60 * 60, // 24 hours
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
    sameSite: 'lax',
  },
  name: 'kiu.sid',
};

module.exports = session(sessionConfig);
