# KIU Lost & Found

A campus Lost & Found platform for **Kampala International University** students. Students can register with their details (name, email, phone, course, reg number, photo), post lost or found items, search and filter listings, and manage their own posts.

## Stack

- **Backend:** Node.js, Express
- **Database:** MongoDB (Mongoose)
- **Views:** EJS (SSR), Bootstrap 5, Bootstrap Icons
- **Security:** Helmet, rate limiting, express-mongo-sanitize, bcrypt, validated file uploads, session cookies

## Setup

1. **Copy environment file and set variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set at least:
   - `MONGODB_URI` (e.g. `mongodb://localhost:27017/kiu-lost-found`)
   - `SESSION_SECRET` (long random string in production)

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run**
   ```bash
   npm run dev    # development with file watch
   # or
   npm start      # production
   ```
   Open http://localhost:3000 (or your `PORT`).

## Features

- **Auth:** Register (full name, email, phone, course, reg number, profile photo), login with reg number + password, logout. Passwords hashed with bcrypt; sessions in MongoDB.
- **Posts:** Create/edit lost or found items with title, description, category, location, date, up to 5 images. Mark as resolved or closed. Only the author can edit or change status.
- **Browse:** Search by text (title, description, category, location), filter by type (lost/found), category, status; sort by newest/oldest. Similar items shown on the post detail page.
- **Profile:** View your profile and all your posts; quick link to create a new post.
- **Images:** Stored on the server under `uploads/` (UUID filenames). Allowed types: JPEG, PNG, WebP, GIF; max 5MB per file.

## Security

- Helmet for security headers and CSP
- Rate limiting (general + stricter on login/register)
- Mongo sanitize to prevent NoSQL injection
- Input validation (express-validator) on auth and posts
- File uploads restricted by MIME type and size; filenames randomized (UUID)
- Session cookie httpOnly, sameSite, secure in production
- Passwords never stored in plain text

## Project structure

```
├── config/         # DB, session
├── middleware/     # auth, upload (multer)
├── models/        # User, Post
├── public/        # static assets, CSS
├── routes/        # auth, home, posts, profile
├── uploads/       # user-uploaded images (create via app)
├── validators/    # auth, post validation rules
├── views/         # EJS layouts, partials, pages
├── server.js
└── .env           # not committed; use .env.example
```
