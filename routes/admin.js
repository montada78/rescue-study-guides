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
  res.render('admin/product-form', { title: 'Add New Product', product: null, categories });
});

// ADD PRODUCT POST
router.post('/products/new', requireAdmin, (req, res, next) => {
  upload.fields([
    { name: 'cover_image', maxCount: 1 },
    { name: 'preview_image', maxCount: 1 },
    { name: 'pdf_file', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) {
      req.session.error = 'Upload error: ' + err.message;
      return res.redirect('/admin/products/new');
    }
    next();
  });
}, (req, res) => {
  const { title, description, short_description, category_id, price, original_price, subject, level, curriculum, pages, tags, is_featured, is_active, is_free } = req.body;
  
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
  
  let coverImage = null, previewImage = null, filePath = null, fileName = null, fileSize = 0;
  
  if (req.files?.cover_image?.[0]) {
    coverImage = '/uploads/images/' + req.files.cover_image[0].filename;
  }
  if (req.files?.preview_image?.[0]) {
    previewImage = '/uploads/images/' + req.files.preview_image[0].filename;
  }
  if (req.files?.pdf_file?.[0]) {
    filePath = '/uploads/guides/' + req.files.pdf_file[0].filename;
    fileName = req.files.pdf_file[0].originalname;
    fileSize = req.files.pdf_file[0].size;
  }

  db.prepare(`
    INSERT INTO products (title, slug, description, short_description, category_id, price, original_price, subject, level, curriculum, pages, cover_image, preview_image, file_path, file_name, file_size, is_featured, is_active, is_free, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, slug, description, short_description, parseInt(category_id), parseFloat(price), parseFloat(original_price) || null, subject, level, curriculum, parseInt(pages) || 0, coverImage, previewImage, filePath, fileName, fileSize, is_featured ? 1 : 0, is_active ? 1 : 0, is_free ? 1 : 0, tags);

  req.session.success = 'Product added successfully!';
  res.redirect('/admin/products');
});

// EDIT PRODUCT PAGE
router.get('/products/edit/:id', requireAdmin, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.redirect('/admin/products');
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.render('admin/product-form', { title: 'Edit Product', product, categories });
});

// EDIT PRODUCT POST
router.post('/products/edit/:id', requireAdmin, (req, res, next) => {
  upload.fields([
    { name: 'cover_image', maxCount: 1 },
    { name: 'preview_image', maxCount: 1 },
    { name: 'pdf_file', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) {
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
  let previewImage = product.preview_image;
  let filePath = product.file_path;
  let fileName = product.file_name;
  let fileSize = product.file_size;

  if (req.files?.cover_image?.[0]) {
    coverImage = '/uploads/images/' + req.files.cover_image[0].filename;
  }
  if (req.files?.preview_image?.[0]) {
    previewImage = '/uploads/images/' + req.files.preview_image[0].filename;
  }
  if (req.files?.pdf_file?.[0]) {
    filePath = '/uploads/guides/' + req.files.pdf_file[0].filename;
    fileName = req.files.pdf_file[0].originalname;
    fileSize = req.files.pdf_file[0].size;
  }

  db.prepare(`
    UPDATE products SET title=?, description=?, short_description=?, category_id=?, price=?, original_price=?,
    subject=?, level=?, curriculum=?, pages=?, cover_image=?, preview_image=?, file_path=?, file_name=?,
    file_size=?, is_featured=?, is_active=?, is_free=?, tags=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(title, description, short_description, parseInt(category_id), parseFloat(price), parseFloat(original_price) || null, subject, level, curriculum, parseInt(pages) || 0, coverImage, previewImage, filePath, fileName, fileSize, is_featured ? 1 : 0, is_active ? 1 : 0, is_free ? 1 : 0, tags, product.id);

  req.session.success = 'Product updated successfully!';
  res.redirect('/admin/products');
});

// TOGGLE PRODUCT STATUS
router.post('/products/toggle/:id', requireAdmin, (req, res) => {
  const product = db.prepare('SELECT is_active FROM products WHERE id = ?').get(req.params.id);
  db.prepare('UPDATE products SET is_active = ? WHERE id = ?').run(product.is_active ? 0 : 1, req.params.id);
  res.json({ success: true, active: !product.is_active });
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

module.exports = router;

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
