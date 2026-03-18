const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/db');

// LOGIN PAGE
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/account');
  if (req.query.redirect) req.session.redirectTo = req.query.redirect;
  res.render('auth/login', { title: 'Login - Rescue Study Guides', error: null });
});

// LOGIN POST
router.post('/login', async (req, res) => {
  const { email, password, remember } = req.body;
  
  if (!email || !password) {
    return res.render('auth/login', { title: 'Login', error: 'Please fill in all fields' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  
  if (!user) {
    return res.render('auth/login', { title: 'Login', error: 'Invalid email or password' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.render('auth/login', { title: 'Login', error: 'Invalid email or password' });
  }

  // Update last login
  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  req.session.user = {
    id: user.id, name: user.name, email: user.email,
    role: user.role, avatar: user.avatar
  };

  if (remember) req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;

  req.session.success = `Welcome back, ${user.name}! 🎉`;
  
  if (user.role === 'admin') return res.redirect('/admin');
  
  const redirect = req.session.redirectTo || '/account';
  delete req.session.redirectTo;
  res.redirect(redirect);
});

// REGISTER PAGE
router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/account');
  res.render('auth/register', { title: 'Register - Rescue Study Guides', error: null });
});

// REGISTER POST
router.post('/register', async (req, res) => {
  const { name, email, password, confirmPassword, school, grade_level, country, terms } = req.body;

  if (!name || !email || !password || !confirmPassword) {
    return res.render('auth/register', { title: 'Register', error: 'Please fill in all required fields' });
  }

  if (password !== confirmPassword) {
    return res.render('auth/register', { title: 'Register', error: 'Passwords do not match' });
  }

  if (password.length < 8) {
    return res.render('auth/register', { title: 'Register', error: 'Password must be at least 8 characters' });
  }

  if (!terms) {
    return res.render('auth/register', { title: 'Register', error: 'Please accept the Terms & Conditions' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) {
    return res.render('auth/register', { title: 'Register', error: 'An account with this email already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  
  const result = db.prepare(`
    INSERT INTO users (name, email, password, school, grade_level, country, is_verified)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(name.trim(), email.toLowerCase().trim(), hashedPassword, school || null, grade_level || null, country || null);

  const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  
  req.session.user = {
    id: newUser.id, name: newUser.name, email: newUser.email,
    role: newUser.role, avatar: newUser.avatar
  };

  req.session.success = `Account created! Welcome to Rescue Study Guides, ${newUser.name}! 🎉`;
  res.redirect('/account');
});

// LOGOUT
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    res.redirect('/?logout=success');
  });
});

// FORGOT PASSWORD PAGE
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', { title: 'Forgot Password - Rescue Study Guides', sent: false });
});

router.post('/forgot-password', (req, res) => {
  // In production, send email - for now just show success
  res.render('auth/forgot-password', { title: 'Forgot Password', sent: true });
});

module.exports = router;
