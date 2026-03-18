require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');

// Initialize DB
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Hostinger
app.set('trust proxy', 1);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Security & Performance
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'"],
    },
  },
}));

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
}));

// Session setup
const sessionStore = new SQLiteStore({
  db: 'sessions.db',
  dir: './database',
  concurrentDB: true,
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'rescue-secret-key',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',
  },
}));

// Global template variables
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isLoggedIn = !!req.session.user;
  res.locals.isAdmin = req.session.user?.role === 'admin';
  res.locals.appName = process.env.APP_NAME || 'Rescue Study Guides';
  res.locals.cartCount = 0;
  
  if (req.session.user) {
    const cartCount = db.prepare('SELECT COUNT(*) as count FROM cart WHERE user_id = ?')
                       .get(req.session.user.id);
    res.locals.cartCount = cartCount?.count || 0;
    
    const wishlistCount = db.prepare('SELECT COUNT(*) as count FROM wishlist WHERE user_id = ?')
                           .get(req.session.user.id);
    res.locals.wishlistCount = wishlistCount?.count || 0;
  }
  
  res.locals.success = req.session.success || null;
  res.locals.error = req.session.error || null;
  delete req.session.success;
  delete req.session.error;
  
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const storeRoutes = require('./routes/store');
const cartRoutes = require('./routes/cart');
const downloadRoutes = require('./routes/downloads');
const accountRoutes = require('./routes/account');
const adminRoutes = require('./routes/admin');

app.use('/', storeRoutes);
app.use('/auth', authRoutes);
app.use('/cart', cartRoutes);
app.use('/downloads', downloadRoutes);
app.use('/account', accountRoutes);
app.use('/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: '404 - Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).render('error', { 
    title: 'Something went wrong',
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
🚀 ============================================
   Rescue Study Guides - Server Running!
   URL: http://localhost:${PORT}
   ENV: ${process.env.NODE_ENV || 'development'}
   Admin: /admin
============================================
  `);
});

module.exports = app;
