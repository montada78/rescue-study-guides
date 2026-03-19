const express = require('express');
const router = express.Router();
const db = require('../database/db');
const nodemailer = require('nodemailer');

// Email transporter (Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.CONTACT_EMAIL || 'kanayatichemistry@gmail.com',
    pass: process.env.CONTACT_EMAIL_PASS || ''
  }
});

// HOME PAGE
router.get('/', (req, res) => {
  const featuredProducts = dbCached('featured', 60000, () => db.prepare(`
    SELECT p.*, c.name as category_name, c.color as category_color
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_featured = 1 AND p.is_active = 1
    ORDER BY p.created_at DESC LIMIT 6
  `).all());

  const categories = dbCached('categories', 300000, () =>
    db.prepare('SELECT * FROM categories ORDER BY name').all());

  const stats = dbCached('stats', 120000, () => ({
    students: db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get().count,
    guides: db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get().count,
    downloads: db.prepare('SELECT COALESCE(SUM(downloads_count), 0) as total FROM products').get().total,
  }));

  const freeGuides = dbCached('freeGuides', 120000, () => db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_free = 1 AND p.is_active = 1 LIMIT 3
  `).all());

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

  const productFiles    = db.prepare('SELECT * FROM product_files WHERE product_id = ? ORDER BY sort_order').all(product.id);
  const productPreviews = db.prepare('SELECT * FROM product_previews WHERE product_id = ? ORDER BY sort_order').all(product.id);

  const inCart = req.session.user
    ? db.prepare('SELECT id FROM cart WHERE user_id = ? AND product_id = ?').get(req.session.user.id, product.id)
    : null;

  const inWishlist = req.session.user
    ? db.prepare('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?').get(req.session.user.id, product.id)
    : null;

  const owned = req.session.user
    ? db.prepare('SELECT id FROM downloads WHERE user_id = ? AND product_id = ?').get(req.session.user.id, product.id)
    : null;

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.title,
    "description": product.description || product.short_description,
    "image": product.cover_image ? 'https://examrescueguides.com' + product.cover_image : '',
    "brand": { "@type": "Brand", "name": "Exam Rescue Guides" },
    "offers": {
      "@type": "Offer",
      "price": product.price,
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "url": "https://examrescueguides.com/product/" + product.slug
    },
    "aggregateRating": reviews.length > 0 ? {
      "@type": "AggregateRating",
      "ratingValue": (reviews.reduce((s,r) => s + r.rating, 0) / reviews.length).toFixed(1),
      "reviewCount": reviews.length
    } : undefined
  });

  res.render('product', {
    title: `${product.title} - Exam Rescue Guides`,
    metaDesc: product.short_description || product.description || 'High-quality revision guide for ' + product.subject,
    metaKeywords: (product.tags || '') + ',' + product.subject + ',' + product.level + ',' + product.curriculum,
    ogImage: product.cover_image ? 'https://examrescueguides.com' + product.cover_image : '',
    ogType: 'product',
    canonicalPath: '/product/' + product.slug,
    jsonLd,
    product, reviews, related, inCart, inWishlist, owned, productFiles, productPreviews
  });
});

// SUBMIT REVIEW (with simple math captcha)
router.post('/product/:slug/review', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }

  const product = db.prepare('SELECT id FROM products WHERE slug = ? AND is_active = 1').get(req.params.slug);
  if (!product) return res.redirect('/shop');

  const { rating, comment, captcha_answer, captcha_a, captcha_b } = req.body;
  const ratingNum = parseInt(rating);

  // Validate CAPTCHA
  const expectedAnswer = parseInt(captcha_a) + parseInt(captcha_b);
  if (parseInt(captcha_answer) !== expectedAnswer) {
    req.session.error = 'Incorrect CAPTCHA answer — please try again.';
    return res.redirect('/product/' + req.params.slug);
  }

  if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
    req.session.error = 'Please select a rating between 1 and 5 stars.';
    return res.redirect('/product/' + req.params.slug);
  }

  // Prevent duplicate review
  const existing = db.prepare('SELECT id FROM reviews WHERE user_id = ? AND product_id = ?')
    .get(req.session.user.id, product.id);
  if (existing) {
    req.session.error = 'You have already reviewed this guide.';
    return res.redirect('/product/' + req.params.slug);
  }

  db.prepare('INSERT INTO reviews (user_id, product_id, rating, comment, is_approved) VALUES (?, ?, ?, ?, 1)')
    .run(req.session.user.id, product.id, ratingNum, comment ? comment.trim() : null);

  req.session.success = '⭐ Thank you for your review!';
  res.redirect('/product/' + req.params.slug);
});

// ROBOTS.TXT
router.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /account/
Disallow: /cart
Disallow: /checkout
Disallow: /auth/
Sitemap: https://examrescueguides.com/sitemap.xml`);
});

// SITEMAP.XML
router.get('/sitemap.xml', (req, res) => {
  const products = db.prepare("SELECT slug, updated_at FROM products WHERE is_active = 1").all();
  const base = 'https://examrescueguides.com';
  const today = new Date().toISOString().split('T')[0];

  const urls = [
    `<url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority><lastmod>${today}</lastmod></url>`,
    `<url><loc>${base}/shop</loc><changefreq>daily</changefreq><priority>0.9</priority><lastmod>${today}</lastmod></url>`,
    `<url><loc>${base}/free</loc><changefreq>weekly</changefreq><priority>0.8</priority><lastmod>${today}</lastmod></url>`,
    `<url><loc>${base}/about</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`,
    `<url><loc>${base}/contact</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`,
    `<url><loc>${base}/how-it-works</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`,
    ...products.map(p => `<url><loc>${base}/product/${p.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority><lastmod>${(p.updated_at||today).split('T')[0]}</lastmod></url>`)
  ];

  res.header('Content-Type', 'application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`);
});

// ABOUT PAGE
router.get('/about', (req, res) => {
  res.render('about', { title: 'About Us - Rescue Study Guides' });
});

// CONTACT PAGE
router.get('/contact', (req, res) => {
  res.render('contact', { title: 'Contact - Rescue Study Guides', success: null, error: null });
});

// CONTACT FORM SUBMIT
router.post('/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.render('contact', { title: 'Contact - Rescue Study Guides', success: null, error: 'Please fill in all required fields.' });
  }
  try {
    await transporter.sendMail({
      from: `"${name}" <${process.env.CONTACT_EMAIL || 'kanayatichemistry@gmail.com'}>`,
      to: 'kanayatichemistry@gmail.com',
      replyTo: email,
      subject: `[Exam Rescue Guides] ${subject || 'Contact Form'} - from ${name}`,
      html: `
        <h2>New Contact Form Message</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject || 'General Question'}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `
    });
    res.render('contact', { title: 'Contact - Rescue Study Guides', success: 'Message sent! We\'ll get back to you within 24 hours.', error: null });
  } catch (err) {
    console.error('Contact email error:', err);
    res.render('contact', { title: 'Contact - Rescue Study Guides', success: null, error: 'Failed to send message. Please email us directly at kanayatichemistry@gmail.com' });
  }
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
