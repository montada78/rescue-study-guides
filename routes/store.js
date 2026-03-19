const express = require('express');
const router = express.Router();
const db = require('../database/db');

// HOME PAGE
router.get('/', (req, res) => {
  const featuredProducts = db.prepare(`
    SELECT p.*, c.name as category_name, c.color as category_color
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_featured = 1 AND p.is_active = 1
    ORDER BY p.created_at DESC LIMIT 6
  `).all();

  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  
  const stats = {
    students: db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get().count,
    guides: db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get().count,
    downloads: db.prepare('SELECT COALESCE(SUM(downloads_count), 0) as total FROM products').get().total,
  };

  const freeGuides = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_free = 1 AND p.is_active = 1 LIMIT 3
  `).all();

  res.render('index', { title: 'Rescue Study Guides - Rescue Your Exam Results!', featuredProducts, categories, stats, freeGuides });
});

// SHOP PAGE
router.get('/shop', (req, res) => {
  const { category, level, curriculum, sort, search, page: pageParam } = req.query;
  const page = parseInt(pageParam) || 1;
  const limit = 12;
  const offset = (page - 1) * limit;

  let where = 'WHERE p.is_active = 1';
  let params = [];

  if (category && category !== 'all') {
    where += ' AND c.slug = ?';
    params.push(category);
  }
  if (level) {
    where += ' AND p.level = ?';
    params.push(level);
  }
  if (curriculum) {
    where += ' AND p.curriculum = ?';
    params.push(curriculum);
  }
  if (search) {
    where += ' AND (p.title LIKE ? OR p.description LIKE ? OR p.tags LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  let orderBy = 'ORDER BY p.is_featured DESC, p.created_at DESC';
  if (sort === 'price-low') orderBy = 'ORDER BY p.price ASC';
  if (sort === 'price-high') orderBy = 'ORDER BY p.price DESC';
  if (sort === 'popular') orderBy = 'ORDER BY p.downloads_count DESC';
  if (sort === 'newest') orderBy = 'ORDER BY p.created_at DESC';

  const totalResult = db.prepare(`SELECT COUNT(*) as count FROM products p LEFT JOIN categories c ON p.category_id = c.id ${where}`).get(...params);
  const total = totalResult.count;

  const products = db.prepare(`
    SELECT p.*, c.name as category_name, c.color as category_color, c.slug as category_slug
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    ${where} ${orderBy} LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  const levels = db.prepare('SELECT DISTINCT level FROM products WHERE is_active = 1').all();
  const curriculums = db.prepare('SELECT DISTINCT curriculum FROM products WHERE is_active = 1').all();

  res.render('shop', {
    title: 'Shop - Rescue Study Guides',
    products, categories, levels, curriculums,
    currentCategory: category || 'all',
    currentLevel: level || '',
    currentCurriculum: curriculum || '',
    currentSort: sort || '',
    searchQuery: search || '',
    pagination: { page, total, pages: Math.ceil(total / limit), limit }
  });
});

// PRODUCT DETAIL
router.get('/product/:slug', (req, res) => {
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, c.color as category_color
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.slug = ? AND p.is_active = 1
  `).get(req.params.slug);

  if (!product) return res.redirect('/shop');

  const reviews = db.prepare(`
    SELECT r.*, u.name as user_name FROM reviews r
    JOIN users u ON r.user_id = u.id
    WHERE r.product_id = ? AND r.is_approved = 1
    ORDER BY r.created_at DESC LIMIT 10
  `).all(product.id);

  const related = db.prepare(`
    SELECT p.*, c.name as category_name FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.category_id = ? AND p.id != ? AND p.is_active = 1 LIMIT 4
  `).all(product.category_id, product.id);

  const inCart = req.session.user
    ? db.prepare('SELECT id FROM cart WHERE user_id = ? AND product_id = ?').get(req.session.user.id, product.id)
    : null;

  const inWishlist = req.session.user
    ? db.prepare('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?').get(req.session.user.id, product.id)
    : null;

  const owned = req.session.user
    ? db.prepare('SELECT id FROM downloads WHERE user_id = ? AND product_id = ?').get(req.session.user.id, product.id)
    : null;

  res.render('product', { title: `${product.title} - Rescue Study Guides`, product, reviews, related, inCart, inWishlist, owned });
});

// ABOUT PAGE
router.get('/about', (req, res) => {
  res.render('about', { title: 'About Us - Rescue Study Guides' });
});

// CONTACT PAGE
router.get('/contact', (req, res) => {
  res.render('contact', { title: 'Contact - Rescue Study Guides' });
});

// HOW IT WORKS
router.get('/how-it-works', (req, res) => {
  res.render('how-it-works', { title: 'How It Works - Exam Rescue Guides' });
});

// FREE GUIDES PAGE
router.get('/free', (req, res) => {
  const { subject } = req.query;
  let where = 'WHERE p.is_free = 1 AND p.is_active = 1';
  let params = [];
  if (subject && subject !== 'all') {
    where += ' AND LOWER(p.subject) = LOWER(?)';
    params.push(subject);
  }
  const freeGuides = db.prepare(`
    SELECT p.*, c.name as category_name, c.color as category_color
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    ${where} ORDER BY p.created_at DESC
  `).all(...params);

  const subjects = db.prepare(`
    SELECT DISTINCT p.subject FROM products p WHERE p.is_free = 1 AND p.is_active = 1 ORDER BY p.subject
  `).all().map(r => r.subject);

  res.render('free', {
    title: 'Free Study Guides - Exam Rescue Guides',
    freeGuides,
    subjects,
    currentSubject: subject || 'all'
  });
});

module.exports = router;
