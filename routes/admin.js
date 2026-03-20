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
    if (file.fieldname === 'pdf_files') {
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
    if (file.fieldname === 'pdf_files') {
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

// ADD PRODUCT POST — cover image only; PDFs/previews use dedicated upload endpoint
router.post('/products/new', requireAdmin, (req, res, next) => {
  upload.fields([{ name: 'cover_image', maxCount: 1 }])(req, res, (err) => {
    if (err) {
      req.session.error = 'Upload error: ' + err.message;
      return res.redirect('/admin/products/new');
    }
    next();
  });
}, (req, res) => {
  const { title, description, short_description, category_id, price, original_price, subject, level, curriculum, pages, tags, is_featured, is_active, is_free, is_bundle } = req.body;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
  let coverImage = null;
  if (req.files?.cover_image?.[0]) {
    coverImage = '/uploads/images/' + req.files.cover_image[0].filename;
  }
  const result = db.prepare(`
    INSERT INTO products (title, slug, description, short_description, category_id, price, original_price, subject, level, curriculum, pages, cover_image, is_featured, is_active, is_free, is_bundle, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, slug, description, short_description, parseInt(category_id), parseFloat(price), parseFloat(original_price) || null, subject, level, curriculum, parseInt(pages) || 0, coverImage, is_featured ? 1 : 0, is_active ? 1 : 0, is_free ? 1 : 0, is_bundle ? 1 : 0, tags);

  req.session.success = 'Product added! Now upload PDF files and preview images using the Upload button.';
  res.redirect('/admin/products/edit/' + result.lastInsertRowid);
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

// EDIT PRODUCT POST — cover image only via multer; PDFs/previews use dedicated upload endpoint
router.post('/products/edit/:id', requireAdmin, (req, res, next) => {
  upload.fields([
    { name: 'cover_image', maxCount: 1 }
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

  const { title, description, short_description, category_id, price, original_price, subject, level, curriculum, pages, tags, is_featured, is_active, is_free, is_bundle } = req.body;

  let coverImage = product.cover_image;
  if (req.files?.cover_image?.[0]) {
    coverImage = '/uploads/images/' + req.files.cover_image[0].filename;
  }

  db.prepare(`
    UPDATE products SET title=?, description=?, short_description=?, category_id=?, price=?, original_price=?,
    subject=?, level=?, curriculum=?, pages=?, cover_image=?,
    is_featured=?, is_active=?, is_free=?, is_bundle=?, tags=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(title, description, short_description, parseInt(category_id), parseFloat(price), parseFloat(original_price) || null,
    subject, level, curriculum, parseInt(pages) || 0, coverImage,
    is_featured ? 1 : 0, is_active ? 1 : 0, is_free ? 1 : 0, is_bundle ? 1 : 0, tags, product.id);

  req.session.success = 'Product updated successfully!';
  res.redirect('/admin/products/edit/' + product.id);
});

// ── DEDICATED FILE UPLOAD ENDPOINT ────────────────────────────────────────
// Two routes: one for new products (no id yet), one for existing
function _handleFileUpload(req, res) {
  const productId = req.params.productId ? parseInt(req.params.productId) : null;
  const savedPdfs = [];
  const savedPreviews = [];

  if (req.files?.pdf_files) {
    req.files.pdf_files.forEach((f, i) => {
      const filePath = '/uploads/guides/' + f.filename;
      const row = { file_path: filePath, file_name: f.originalname, file_size: f.size };
      if (productId) {
        const existing = db.prepare('SELECT COUNT(*) as c FROM product_files WHERE product_id = ?').get(productId).c;
        const result = db.prepare('INSERT INTO product_files (product_id, file_path, file_name, file_size, sort_order) VALUES (?,?,?,?,?)')
          .run(productId, filePath, f.originalname, f.size, existing + i);
        row.id = result.lastInsertRowid;
      }
      savedPdfs.push(row);
    });
  }

  if (req.files?.preview_images) {
    req.files.preview_images.forEach((f, i) => {
      const imgPath = '/uploads/images/' + f.filename;
      const row = { image_path: imgPath };
      if (productId) {
        const existing = db.prepare('SELECT COUNT(*) as c FROM product_previews WHERE product_id = ?').get(productId).c;
        const result = db.prepare('INSERT INTO product_previews (product_id, image_path, sort_order) VALUES (?,?,?)')
          .run(productId, imgPath, existing + i);
        row.id = result.lastInsertRowid;
      }
      savedPreviews.push(row);
    });
  }

  return res.json({ success: true, pdfs: savedPdfs, previews: savedPreviews });
}

const _uploadMiddleware = (req, res, next) => {
  upload.fields([
    { name: 'pdf_files', maxCount: 10 },
    { name: 'preview_images', maxCount: 10 }
  ])(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
};

// Upload with existing product id
router.post('/products/upload-files/:productId', requireAdmin, _uploadMiddleware, _handleFileUpload);
// Upload for new product (files saved but not linked yet — JS keeps them client-side until form save)
router.post('/products/upload-files', requireAdmin, _uploadMiddleware, _handleFileUpload);

// TOGGLE PRODUCT STATUS
router.post('/products/toggle/:id', requireAdmin, (req, res) => {
  const product = db.prepare('SELECT is_active FROM products WHERE id = ?').get(req.params.id);
  db.prepare('UPDATE products SET is_active = ? WHERE id = ?').run(product.is_active ? 0 : 1, req.params.id);
  res.json({ success: true, active: !product.is_active });
});

// DELETE INDIVIDUAL PRODUCT FILE
router.post('/products/files/delete/:fileId', requireAdmin, (req, res) => {
  try {
    const file = db.prepare('SELECT * FROM product_files WHERE id = ?').get(req.params.fileId);
    if (!file) return res.json({ success: false, message: 'File not found' });
    // Delete physical file
    try {
      const fullPath = require('path').join(__dirname, '..', 'public', file.file_path);
      if (require('fs').existsSync(fullPath)) require('fs').unlinkSync(fullPath);
    } catch(e) { console.error('File delete error:', e.message); }
    db.prepare('DELETE FROM product_files WHERE id = ?').run(file.id);
    res.json({ success: true });
  } catch(e) {
    console.error('Delete file error:', e);
    res.json({ success: false, message: e.message });
  }
});

// DELETE INDIVIDUAL PREVIEW IMAGE
router.post('/products/previews/delete/:previewId', requireAdmin, (req, res) => {
  try {
    const prev = db.prepare('SELECT * FROM product_previews WHERE id = ?').get(req.params.previewId);
    if (!prev) return res.json({ success: false, message: 'Preview not found' });
    // Delete physical file
    try {
      const fullPath = require('path').join(__dirname, '..', 'public', prev.image_path);
      if (require('fs').existsSync(fullPath)) require('fs').unlinkSync(fullPath);
    } catch(e) { console.error('Preview delete error:', e.message); }
    db.prepare('DELETE FROM product_previews WHERE id = ?').run(prev.id);
    res.json({ success: true });
  } catch(e) {
    console.error('Delete preview error:', e);
    res.json({ success: false, message: e.message });
  }
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
  try {
    const id = req.params.id;
    // Delete associated files physically
    const files = db.prepare('SELECT * FROM product_files WHERE product_id = ?').all(id);
    files.forEach(f => {
      try {
        const fp = require('path').join(__dirname, '..', 'public', f.file_path);
        if (require('fs').existsSync(fp)) require('fs').unlinkSync(fp);
      } catch(e) {}
    });
    const previews = db.prepare('SELECT * FROM product_previews WHERE product_id = ?').all(id);
    previews.forEach(p => {
      try {
        const fp = require('path').join(__dirname, '..', 'public', p.image_path);
        if (require('fs').existsSync(fp)) require('fs').unlinkSync(fp);
      } catch(e) {}
    });
    // Delete from DB
    db.prepare('DELETE FROM product_files WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM product_previews WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    req.session.success = 'Product deleted';
    res.redirect('/admin/products');
  } catch(e) {
    console.error('Delete product error:', e);
    req.session.error = 'Failed to delete product: ' + e.message;
    res.redirect('/admin/products');
  }
});

// USERS LIST
router.get('/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  const products = db.prepare('SELECT id, title FROM products WHERE is_active=1 ORDER BY title').all();
  res.render('admin/users', { title: 'Manage Users', users, products });
});

// Search users API
router.get('/users/search', requireAdmin, (req, res) => {
  const q = '%' + (req.query.q || '') + '%';
  const users = db.prepare("SELECT id, name, email FROM users WHERE name LIKE ? OR email LIKE ? LIMIT 10").all(q, q);
  res.json(users);
});

// Search products API
router.get('/products/search-api', requireAdmin, (req, res) => {
  const q = '%' + (req.query.q || '') + '%';
  const products = db.prepare("SELECT id, title FROM products WHERE title LIKE ? AND is_active=1 LIMIT 10").all(q);
  res.json(products);
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
  const { user_email, product_id, max_downloads } = req.body;
  const maxDL = parseInt(max_downloads) || 5;

  // Support multiple product_ids (array)
  const productIds = Array.isArray(product_id) ? product_id : [product_id];
  const user = db.prepare('SELECT id, name FROM users WHERE email = ?').get(user_email);
  if (!user) { req.session.error = 'User not found: ' + user_email; return res.redirect('/admin/users'); }

  let count = 0;
  productIds.forEach(pid => {
    if (!pid) return;
    db.prepare(`INSERT OR IGNORE INTO downloads (user_id, product_id, download_token, max_downloads) VALUES (?, ?, ?, ?)`)
      .run(user.id, parseInt(pid), uuidv4(), maxDL);
    count++;
  });

  req.session.success = `✅ Granted access to ${count} product(s) for ${user.name || user_email}`;
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
  const { getSettings } = require('../database/settings');
  const settings = getSettings();
  res.render('admin/settings', { title: 'Settings', settings, saved: req.query.saved === '1' });
});

router.post('/settings', requireAdmin, (req, res) => {
  const { setSettings } = require('../database/settings');
  // Collect all submitted fields
  const updates = {};
  const fields = [
    'STRIPE_PUBLISHABLE_KEY','STRIPE_SECRET_KEY','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_MODE',
    'APP_NAME','APP_URL','SITE_TAGLINE','ADMIN_EMAIL',
    'CONTACT_EMAIL','CONTACT_EMAIL_PASS','SUPPORT_WHATSAPP',
    'PROMO_BANNER_ENABLED','PROMO_BANNER_TEXT','PROMO_BANNER_CODE',
    'CURRENCY','CURRENCY_SYMBOL','MAX_DOWNLOADS','DEFAULT_MAX_DOWNLOADS',
    'INSTAGRAM_URL','TIKTOK_URL','FACEBOOK_URL','YOUTUBE_URL','TWITTER_URL','LINKEDIN_URL',
    'GOOGLE_ANALYTICS_ID','FACEBOOK_PIXEL_ID','TAWK_PROPERTY_ID',
    'ALLOW_REGISTRATION','MAINTENANCE_MODE',
    'SITE_LOGO_URL','SITE_FAVICON_URL','SITE_PRIMARY_COLOR',
    'FOOTER_TEXT','COPYRIGHT_TEXT','META_DESCRIPTION','META_KEYWORDS',
    'HOMEPAGE_HERO_TITLE','HOMEPAGE_HERO_SUBTITLE','FEATURED_SECTION_TITLE',
    'SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','SMTP_FROM',
    'TAX_ENABLED','TAX_RATE','TAX_LABEL',
    'MAX_CART_ITEMS','FREE_TRIAL_DAYS','PDF_WATERMARK',
    'REQUIRE_EMAIL_VERIFICATION','ORDER_NOTIFICATION_EMAIL','LOW_STOCK_ALERT',
    'CUSTOM_HEAD_CODE','CUSTOM_FOOTER_CODE',
    'SHOW_REVIEWS','SHOW_WISHLIST','SHOW_HOW_IT_WORKS'
  ];
  fields.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  // Handle admin password change separately (hash it)
  if (req.body.ADMIN_PASSWORD && req.body.ADMIN_PASSWORD.trim()) {
    const bcrypt = require('bcryptjs');
    const hashed = bcrypt.hashSync(req.body.ADMIN_PASSWORD.trim(), 12);
    const db = require('../database/db');
    db.prepare('UPDATE users SET password = ? WHERE role = ?').run(hashed, 'admin');
  }

  setSettings(updates);
  req.session.success = '✅ Settings saved successfully!';
  res.redirect('/admin/settings?saved=1');
});


// ── ACCESS CODES MANAGEMENT ───────────────────────────────────────────────────

// List access codes
router.get('/access-codes', requireAdmin, (req, res) => {
  const codes = db.prepare(`
    SELECT ac.*, p.title as product_title,
      (SELECT COUNT(*) FROM access_code_uses WHERE code_id = ac.id) as use_count
    FROM access_codes ac
    LEFT JOIN products p ON ac.product_id = p.id
    ORDER BY ac.created_at DESC
  `).all();
  const products = db.prepare('SELECT id, title FROM products WHERE is_active=1 ORDER BY title').all();
  res.render('admin/access-codes', { title: 'Access Codes - Admin', codes, products });
});

// Create access code
router.post('/access-codes/create', requireAdmin, (req, res) => {
  const { code, type, product_id, max_uses, duration_days, expires_at, note, bulk_count } = req.body;
  const count = parseInt(bulk_count) || 1;

  try {
    const stmt = db.prepare(`
      INSERT INTO access_codes (code, type, product_id, max_uses, duration_days, expires_at, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    if (count > 1) {
      // Bulk generate codes
      const prefix = code || 'RSG';
      let created = 0;
      for (let i = 0; i < count; i++) {
        const autoCode = prefix.toUpperCase() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        try {
          stmt.run(autoCode, type, product_id || null, parseInt(max_uses) || 1,
            parseInt(duration_days) || null, expires_at || null, note || '');
          created++;
        } catch(e) {} // skip duplicates
      }
      req.session.success = `✅ Generated ${created} access codes!`;
    } else {
      if (!code) { req.session.error = 'Code is required.'; return res.redirect('/admin/access-codes'); }
      stmt.run(code.trim().toUpperCase(), type, product_id || null, parseInt(max_uses) || 1,
        parseInt(duration_days) || null, expires_at || null, note || '');
      req.session.success = `✅ Access code ${code.toUpperCase()} created!`;
    }
  } catch(e) {
    req.session.error = e.message.includes('UNIQUE') ? 'Code already exists.' : e.message;
  }
  res.redirect('/admin/access-codes');
});

// Toggle access code active
router.post('/access-codes/toggle/:id', requireAdmin, (req, res) => {
  const c = db.prepare('SELECT is_active FROM access_codes WHERE id = ?').get(req.params.id);
  if (!c) return res.json({ success: false });
  db.prepare('UPDATE access_codes SET is_active = ? WHERE id = ?').run(c.is_active ? 0 : 1, req.params.id);
  res.json({ success: true, active: !c.is_active });
});

// Delete access code
router.post('/access-codes/delete/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM access_codes WHERE id = ?').run(req.params.id);
  req.session.success = 'Code deleted.';
  res.redirect('/admin/access-codes');
});

// Edit access code
router.post('/access-codes/edit/:id', requireAdmin, (req, res) => {
  const { type, max_uses, duration_days, expires_at, note, product_id } = req.body;
  db.prepare(`UPDATE access_codes SET type=?, max_uses=?, duration_days=?, expires_at=?, note=?, product_id=? WHERE id=?`)
    .run(type, parseInt(max_uses) || 1, parseInt(duration_days) || null, expires_at || null, note || '', product_id || null, req.params.id);
  req.session.success = 'Code updated!';
  res.redirect('/admin/access-codes');
});

// Export codes as CSV
router.get('/access-codes/export', requireAdmin, (req, res) => {
  const codes = db.prepare(`
    SELECT ac.code, ac.type, p.title as product, ac.max_uses, ac.uses_count, ac.duration_days, ac.expires_at, ac.is_active, ac.note, ac.created_at
    FROM access_codes ac LEFT JOIN products p ON ac.product_id = p.id
    ORDER BY ac.created_at DESC
  `).all();
  const csv = ['Code,Type,Product,Max Uses,Uses Count,Duration Days,Expires At,Active,Note,Created At']
    .concat(codes.map(c => [c.code,c.type,c.product||'',c.max_uses,c.uses_count,c.duration_days||'',c.expires_at||'',c.is_active?'Yes':'No',c.note||'',c.created_at].join(','))).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="access-codes.csv"');
  res.send(csv);
});

// ── BUNDLE ITEMS MANAGEMENT ───────────────────────────────────────────────────

// Get bundle items (API)
router.get('/products/bundle-items/:id', requireAdmin, (req, res) => {
  const items = db.prepare(`
    SELECT bi.*, p.title, p.subject, p.level FROM bundle_items bi
    JOIN products p ON bi.item_product_id = p.id
    WHERE bi.bundle_product_id = ? ORDER BY bi.sort_order
  `).all(req.params.id);
  res.json(items);
});

// Add item to bundle
router.post('/products/bundle-items/:id/add', requireAdmin, (req, res) => {
  const { item_product_id } = req.body;
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM bundle_items WHERE bundle_product_id = ?').get(req.params.id).c;
    db.prepare('INSERT OR IGNORE INTO bundle_items (bundle_product_id, item_product_id, sort_order) VALUES (?,?,?)')
      .run(req.params.id, item_product_id, count);
    res.json({ success: true });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// Remove item from bundle
router.post('/products/bundle-items/:id/remove', requireAdmin, (req, res) => {
  const { item_product_id } = req.body;
  db.prepare('DELETE FROM bundle_items WHERE bundle_product_id = ? AND item_product_id = ?').run(req.params.id, item_product_id);
  res.json({ success: true });
});

// ── COUPON MANAGEMENT ─────────────────────────────────────────────────────────

// FILE RECOVERY TOOL
router.get('/file-recovery', requireAdmin, (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'guides');
  const allFiles = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir).filter(f => f.endsWith('.pdf')) : [];
  const linked = new Set(db.prepare('SELECT file_path FROM product_files').all().map(r => r.file_path.split('/').pop()));

  // Known file map from git history (uuid → {productId, fileName})
  const knownMap = {
    '6df24bc3-d0d0-47b7-ab20-719d788b110a.pdf': { productId: 11, fileName: 'AP Psychology Study Guide Part 1.pdf' },
    'afe12e1d-7386-4616-975a-5032c4400709.pdf': { productId: 11, fileName: 'AP Psychology Study Guide Part 1 (copy).pdf' },
    '44f2272f-0bbe-4093-a13e-149413e615e0.pdf': { productId: null, fileName: 'AP Chemistry Rescue Pack 2026.pdf' },
    'b3523bda-9182-4451-912b-2e411afc9f64.pdf': { productId: null, fileName: 'Unit 9 Student Notes.pdf' },
    'f049b12a-6459-42a6-908a-c68e32bdc2a7.pdf': { productId: null, fileName: '' },
    'c32ff68e-de2c-4442-ac7f-fc6a775f8df9.pdf': { productId: null, fileName: '' },
    '1fda47d5-527d-4c13-92d0-b23c117075b1.pdf': { productId: null, fileName: '' },
    'ca63e51b-6c12-48aa-b990-1eec812a4f68.pdf': { productId: null, fileName: '' },
  };

  // Auto-link any known files that have both productId and fileName and product exists
  let autoLinked = 0;
  for (const [uuid, info] of Object.entries(knownMap)) {
    if (!linked.has(uuid) && info.productId && info.fileName) {
      const filePath = '/uploads/guides/' + uuid;
      const diskPath = path.join(__dirname, '..', 'public', filePath);
      if (fs.existsSync(diskPath)) {
        const stat = fs.statSync(diskPath);
        const product = db.prepare('SELECT id FROM products WHERE id = ?').get(info.productId);
        if (product) {
          db.prepare('INSERT OR IGNORE INTO product_files (product_id, file_path, file_name, file_size) VALUES (?, ?, ?, ?)').run(info.productId, filePath, info.fileName, stat.size);
          linked.add(uuid);
          autoLinked++;
        }
      }
    }
  }

  const orphans = allFiles
    .filter(f => !linked.has(f))
    .map(f => {
      const stat = fs.statSync(path.join(uploadsDir, f));
      const known = knownMap[f] || {};
      return {
        filename: f,
        size: stat.size,
        sizeMB: (stat.size / 1024 / 1024).toFixed(2),
        path: '/uploads/guides/' + f,
        suggestedName: known.fileName || '',
        suggestedProductId: known.productId || null
      };
    })
    .filter(f => f.size > 1000)
    .sort((a, b) => b.size - a.size);

  const products = db.prepare('SELECT id, title FROM products WHERE is_active = 1 ORDER BY title').all();
  res.render('admin/file-recovery', { title: 'File Recovery', orphans, products, autoLinked });
});

router.post('/file-recovery/link', requireAdmin, (req, res) => {
  const { product_id, file_path, file_name } = req.body;
  const fs = require('fs');
  const diskPath = require('path').join(__dirname, '..', 'public', file_path);
  if (!fs.existsSync(diskPath)) { req.session.error = 'File not found on disk'; return res.redirect('/admin/file-recovery'); }
  const stat = fs.statSync(diskPath);
  db.prepare('INSERT INTO product_files (product_id, file_path, file_name, file_size) VALUES (?, ?, ?, ?)').run(parseInt(product_id), file_path, file_name, stat.size);
  req.session.success = `✅ Linked "${file_name}" to product successfully`;
  res.redirect('/admin/file-recovery');
});


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
