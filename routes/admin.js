const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { requireAdmin } = require('../middleware/auth');

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadDir;
    if (file.fieldname === 'pdf_file') {
      uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'guides');
    } else {
      uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'images');
    }
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'pdf_file') {
      if (file.mimetype === 'application/pdf') return cb(null, true);
      return cb(new Error('Only PDF files allowed'));
    }
    if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) return cb(null, true);
    cb(new Error('Invalid file type'));
  }
});

// ADMIN DASHBOARD
router.get('/', requireAdmin, (req, res) => {
  const stats = {
    totalUsers: db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'student'").get().c,
    totalProducts: db.prepare('SELECT COUNT(*) as c FROM products').get().c,
    totalOrders: db.prepare('SELECT COUNT(*) as c FROM orders').get().c,
    totalRevenue: db.prepare("SELECT COALESCE(SUM(total_amount), 0) as t FROM orders WHERE status = 'completed'").get().t,
    totalDownloads: db.prepare('SELECT COALESCE(SUM(downloads_count), 0) as t FROM products').get().t,
    recentOrders: db.prepare(`SELECT o.*, u.name as user_name, u.email FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC LIMIT 10`).all(),
    recentUsers: db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 10').all(),
    topProducts: db.prepare('SELECT * FROM products ORDER BY downloads_count DESC LIMIT 5').all(),
  };

  res.render('admin/dashboard', { title: 'Admin Dashboard - Rescue Study Guides', stats });
});

// PRODUCTS LIST
router.get('/products', requireAdmin, (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name as category_name FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ORDER BY p.created_at DESC
  `).all();
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.render('admin/products', { title: 'Manage Products', products, categories });
});

// ADD PRODUCT PAGE
router.get('/products/new', requireAdmin, (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.render('admin/product-form', { title: 'Add New Product', product: null, categories, productFiles: [], productPreviews: [] });
});

// ADD PRODUCT POST
router.post('/products/new', requireAdmin, (req, res, next) => {
  upload.fields([
    { name: 'cover_image', maxCount: 1 },
    { name: 'preview_images', maxCount: 10 },
    { name: 'pdf_files', maxCount: 10 }
  ])(req, res, (err) => {
    if (err) {
      if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(400).json({ success: false, message: 'Upload error: ' + err.message });
      }
      req.session.error = 'Upload error: ' + err.message;
      return res.redirect('/admin/products/new');
    }
    next();
  });
}, (req, res) => {
  const { title, description, short_description, category_id, price, original_price, subject, level, curriculum, pages, tags, is_featured, is_active, is_free } = req.body;
  
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
  
  let coverImage = null;
  // Keep legacy single-file fields for backward compat
  let filePath = null, fileName = null, fileSize = 0;
  
  if (req.files?.cover_image?.[0]) {
    coverImage = '/uploads/images/' + req.files.cover_image[0].filename;
  }
  // Primary pdf (first one) for legacy field
  if (req.files?.pdf_files?.[0]) {
    filePath = '/uploads/guides/' + req.files.pdf_files[0].filename;
    fileName = req.files.pdf_files[0].originalname;
    fileSize = req.files.pdf_files[0].size;
  }

  const result = db.prepare(`
    INSERT INTO products (title, slug, description, short_description, category_id, price, original_price, subject, level, curriculum, pages, cover_image, file_path, file_name, file_size, is_featured, is_active, is_free, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, slug, description, short_description, parseInt(category_id), parseFloat(price), parseFloat(original_price) || null, subject, level, curriculum, parseInt(pages) || 0, coverImage, filePath, fileName, fileSize, is_featured ? 1 : 0, is_active ? 1 : 0, is_free ? 1 : 0, tags);

  const productId = result.lastInsertRowid;

  // Save all PDF files to product_files table
  if (req.files?.pdf_files) {
    req.files.pdf_files.forEach((f, i) => {
      db.prepare('INSERT INTO product_files (product_id, file_path, file_name, file_size, sort_order) VALUES (?,?,?,?,?)')
        .run(productId, '/uploads/guides/' + f.filename, f.originalname, f.size, i);
    });
  }
  // Save all preview images to product_previews table
  if (req.files?.preview_images) {
    req.files.preview_images.forEach((f, i) => {
      db.prepare('INSERT INTO product_previews (product_id, image_path, sort_order) VALUES (?,?,?)')
        .run(productId, '/uploads/images/' + f.filename, i);
    });
  }

  req.session.success = 'Product added successfully!';
  if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
    return res.json({ success: true, redirect: '/admin/products', message: 'Product saved successfully!' });
  }
  res.redirect('/admin/products');
});

// EDIT PRODUCT PAGE
router.get('/products/edit/:id', requireAdmin, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.redirect('/admin/products');
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  const productFiles = db.prepare('SELECT * FROM product_files WHERE product_id = ? ORDER BY sort_order').all(product.id);
  const productPreviews = db.prepare('SELECT * FROM product_previews WHERE product_id = ? ORDER BY sort_order').all(product.id);
  res.render('admin/product-form', { title: 'Edit Product', product, categories, productFiles, productPreviews });
});

// EDIT PRODUCT POST
router.post('/products/edit/:id', requireAdmin, (req, res, next) => {
  upload.fields([
    { name: 'cover_image', maxCount: 1 },
    { name: 'preview_images', maxCount: 10 },
    { name: 'pdf_files', maxCount: 10 }
  ])(req, res, (err) => {
    if (err) {
      if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(400).json({ success: false, message: 'Upload error: ' + err.message });
      }
      req.session.error = 'Upload error: ' + err.message;
      return res.redirect('/admin/products/edit/' + req.params.id);
    }
    next();
  });
}, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.redirect('/admin/products');

  const { title, description, short_description, category_id, price, original_price, subject, level, curriculum, pages, tags, is_featured, is_active, is_free } = req.body;
  
  let coverImage = product.cover_image;
  let filePath = product.file_path;
  let fileName = product.file_name;
  let fileSize = product.file_size;

  if (req.files?.cover_image?.[0]) {
    coverImage = '/uploads/images/' + req.files.cover_image[0].filename;
  }
  if (req.files?.pdf_files?.[0]) {
    filePath = '/uploads/guides/' + req.files.pdf_files[0].filename;
    fileName = req.files.pdf_files[0].originalname;
    fileSize = req.files.pdf_files[0].size;
  }

  db.prepare(`
    UPDATE products SET title=?, description=?, short_description=?, category_id=?, price=?, original_price=?,
    subject=?, level=?, curriculum=?, pages=?, cover_image=?, file_path=?, file_name=?,
    file_size=?, is_featured=?, is_active=?, is_free=?, tags=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(title, description, short_description, parseInt(category_id), parseFloat(price), parseFloat(original_price) || null, subject, level, curriculum, parseInt(pages) || 0, coverImage, filePath, fileName, fileSize, is_featured ? 1 : 0, is_active ? 1 : 0, is_free ? 1 : 0, tags, product.id);

  // Append new PDF files (don't delete existing)
  if (req.files?.pdf_files) {
    const existing = db.prepare('SELECT COUNT(*) as c FROM product_files WHERE product_id = ?').get(product.id).c;
    req.files.pdf_files.forEach((f, i) => {
      db.prepare('INSERT INTO product_files (product_id, file_path, file_name, file_size, sort_order) VALUES (?,?,?,?,?)')
        .run(product.id, '/uploads/guides/' + f.filename, f.originalname, f.size, existing + i);
    });
  }
  // Append new preview images
  if (req.files?.preview_images) {
    const existing = db.prepare('SELECT COUNT(*) as c FROM product_previews WHERE product_id = ?').get(product.id).c;
    req.files.preview_images.forEach((f, i) => {
      db.prepare('INSERT INTO product_previews (product_id, image_path, sort_order) VALUES (?,?,?)')
        .run(product.id, '/uploads/images/' + f.filename, existing + i);
    });
  }

  req.session.success = 'Product updated successfully!';
  if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
    return res.json({ success: true, redirect: '/admin/products/edit/' + product.id, message: 'Product updated successfully!' });
  }
  res.redirect('/admin/products/edit/' + product.id);
});

// TOGGLE PRODUCT STATUS
router.post('/products/toggle/:id', requireAdmin, (req, res) => {
  const product = db.prepare('SELECT is_active FROM products WHERE id = ?').get(req.params.id);
  db.prepare('UPDATE products SET is_active = ? WHERE id = ?').run(product.is_active ? 0 : 1, req.params.id);
  res.json({ success: true, active: !product.is_active });
});

// DELETE INDIVIDUAL PRODUCT FILE
router.post('/products/files/delete/:fileId', requireAdmin, (req, res) => {
  const file = db.prepare('SELECT * FROM product_files WHERE id = ?').get(req.params.fileId);
  if (!file) return res.json({ success: false, message: 'File not found' });
  db.prepare('DELETE FROM product_files WHERE id = ?').run(file.id);
  res.json({ success: true });
});

// DELETE INDIVIDUAL PREVIEW IMAGE
router.post('/products/previews/delete/:previewId', requireAdmin, (req, res) => {
  const prev = db.prepare('SELECT * FROM product_previews WHERE id = ?').get(req.params.previewId);
  if (!prev) return res.json({ success: false });
  db.prepare('DELETE FROM product_previews WHERE id = ?').run(prev.id);
  res.json({ success: true });
});

// ADMIN DOWNLOAD FILE (any uploaded file)
router.get('/products/download/:fileId', requireAdmin, (req, res) => {
  const file = db.prepare('SELECT * FROM product_files WHERE id = ?').get(req.params.fileId);
  if (!file) {
    // Try legacy single file from product
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.fileId);
    if (!product || !product.file_path) return res.status(404).send('File not found');
    const fullPath = require('path').join(__dirname, '..', 'public', product.file_path);
    return res.download(fullPath, product.file_name || 'guide.pdf');
  }
  const fullPath = require('path').join(__dirname, '..', 'public', file.file_path);
  res.download(fullPath, file.file_name || 'guide.pdf');
});

// ADMIN DOWNLOAD LEGACY (by product id)
router.get('/products/download-legacy/:productId', requireAdmin, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.productId);
  if (!product || !product.file_path) return res.status(404).send('No file attached to this product');
  const fullPath = require('path').join(__dirname, '..', 'public', product.file_path);
  res.download(fullPath, product.file_name || 'guide.pdf');
});

// DELETE PRODUCT
router.post('/products/delete/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  req.session.success = 'Product deleted';
  res.redirect('/admin/products');
});

// USERS LIST
router.get('/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  res.render('admin/users', { title: 'Manage Users', users });
});

// ORDERS LIST
router.get('/orders', requireAdmin, (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, u.name as user_name, u.email as user_email
    FROM orders o JOIN users u ON o.user_id = u.id
    ORDER BY o.created_at DESC
  `).all();

  const ordersWithItems = orders.map(order => {
    const items = db.prepare(`
      SELECT oi.*, p.title FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?
    `).all(order.id);
    return { ...order, items };
  });

  res.render('admin/orders', { title: 'Manage Orders', orders: ordersWithItems });
});

// GRANT MANUAL DOWNLOAD ACCESS
router.post('/grant-access', requireAdmin, (req, res) => {
  const { user_email, product_id } = req.body;
  
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(user_email);
  if (!user) return req.session.error = 'User not found', res.redirect('/admin/users');
  
  db.prepare(`
    INSERT OR IGNORE INTO downloads (user_id, product_id, download_token, max_downloads)
    VALUES (?, ?, ?, 5)
  `).run(user.id, parseInt(product_id), uuidv4());

  req.session.success = 'Download access granted!';
  res.redirect('/admin/users');
});

// CATEGORIES
router.get('/categories', requireAdmin, (req, res) => {
  const categories = db.prepare('SELECT c.*, COUNT(p.id) as product_count FROM categories c LEFT JOIN products p ON c.id = p.category_id GROUP BY c.id').all();
  res.render('admin/categories', { title: 'Manage Categories', categories });
});

router.post('/categories/add', requireAdmin, (req, res) => {
  const { name, description, icon, color } = req.body;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  db.prepare('INSERT OR IGNORE INTO categories (name, slug, description, icon, color) VALUES (?, ?, ?, ?, ?)').run(name, slug, description, icon, color);
  req.session.success = 'Category added!';
  res.redirect('/admin/categories');
});

// SETTINGS PAGE
router.get('/settings', requireAdmin, (req, res) => {
  const envPath = require('path').join(__dirname, '..', '.env');
  const envContent = require('fs').existsSync(envPath) ? require('fs').readFileSync(envPath, 'utf8') : '';
  const settings = {};
  envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && !key.startsWith('#')) settings[key.trim()] = val.join('=').trim();
  });
  res.render('admin/settings', { title: 'Settings', settings, saved: req.query.saved === '1' });
});

router.post('/settings', requireAdmin, (req, res) => {
  const envPath = require('path').join(__dirname, '..', '.env');
  const fs = require('fs');
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const updates = {
    STRIPE_PUBLISHABLE_KEY: req.body.STRIPE_PUBLISHABLE_KEY,
    STRIPE_SECRET_KEY: req.body.STRIPE_SECRET_KEY,
    PAYPAL_CLIENT_ID: req.body.PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET: req.body.PAYPAL_CLIENT_SECRET,
    PAYPAL_MODE: req.body.PAYPAL_MODE,
    APP_URL: req.body.APP_URL,
    ADMIN_EMAIL: req.body.ADMIN_EMAIL,
  };
  if (req.body.ADMIN_PASSWORD) updates.ADMIN_PASSWORD = req.body.ADMIN_PASSWORD;

  Object.entries(updates).forEach(([key, value]) => {
    if (!value) return;
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
    process.env[key] = value;
  });

  fs.writeFileSync(envPath, envContent);
  res.redirect('/admin/settings?saved=1');
});


// ── COUPON MANAGEMENT ─────────────────────────────────────────────────────────

// List coupons
router.get('/coupons', requireAdmin, (req, res) => {
  const coupons = db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all();
  res.render('admin/coupons', { title: 'Coupon Codes - Admin', coupons });
});

// Create coupon
router.post('/coupons/create', requireAdmin, (req, res) => {
  const { code, type, value, min_order, max_uses, expires_at } = req.body;
  if (!code || !type || !value) {
    req.session.error = 'Code, type and value are required.';
    return res.redirect('/admin/coupons');
  }
  try {
    db.prepare(`
      INSERT INTO coupons (code, type, value, min_order, max_uses, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      code.trim().toUpperCase(),
      type,
      parseFloat(value),
      parseFloat(min_order) || 0,
      max_uses ? parseInt(max_uses) : null,
      expires_at || null
    );
    req.session.success = `Coupon ${code.toUpperCase()} created!`;
  } catch(e) {
    req.session.error = 'Coupon code already exists.';
  }
  res.redirect('/admin/coupons');
});

// Toggle coupon active
router.post('/coupons/toggle/:id', requireAdmin, (req, res) => {
  const c = db.prepare('SELECT is_active FROM coupons WHERE id = ?').get(req.params.id);
  if (!c) return res.json({ success: false });
  db.prepare('UPDATE coupons SET is_active = ? WHERE id = ?').run(c.is_active ? 0 : 1, req.params.id);
  res.json({ success: true, active: !c.is_active });
});

// Delete coupon
router.post('/coupons/delete/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
  req.session.success = 'Coupon deleted.';
  res.redirect('/admin/coupons');
});

module.exports = router;
