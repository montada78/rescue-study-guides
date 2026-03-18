const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');

// ACCOUNT DASHBOARD
router.get('/', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
  
  const downloads = db.prepare(`
    SELECT d.*, p.title, p.cover_image, p.subject, p.level
    FROM downloads d JOIN products p ON d.product_id = p.id
    WHERE d.user_id = ? ORDER BY d.created_at DESC LIMIT 5
  `).all(user.id);

  const orders = db.prepare(`
    SELECT o.*, GROUP_CONCAT(p.title) as product_titles
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE o.user_id = ? GROUP BY o.id ORDER BY o.created_at DESC LIMIT 5
  `).all(user.id);

  const wishlist = db.prepare(`
    SELECT p.*, cat.name as category_name
    FROM wishlist w JOIN products p ON w.product_id = p.id
    LEFT JOIN categories cat ON p.category_id = cat.id
    WHERE w.user_id = ? LIMIT 4
  `).all(user.id);

  const stats = {
    totalDownloads: db.prepare('SELECT COUNT(*) as count FROM downloads WHERE user_id = ?').get(user.id).count,
    totalOrders: db.prepare('SELECT COUNT(*) as count FROM orders WHERE user_id = ?').get(user.id).count,
    totalSpent: db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE user_id = ? AND status = 'completed'").get(user.id).total,
    wishlistCount: db.prepare('SELECT COUNT(*) as count FROM wishlist WHERE user_id = ?').get(user.id).count,
  };

  res.render('account/dashboard', { title: 'My Account - Rescue Study Guides', user, downloads, orders, wishlist, stats });
});

// MY DOWNLOADS
router.get('/downloads', requireAuth, (req, res) => {
  const downloads = db.prepare(`
    SELECT d.*, p.title, p.cover_image, p.subject, p.level, p.curriculum, p.pages,
           c.name as category_name, c.color as category_color
    FROM downloads d JOIN products p ON d.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE d.user_id = ? ORDER BY d.created_at DESC
  `).all(req.session.user.id);

  res.render('account/downloads', { title: 'My Downloads - Rescue Study Guides', downloads });
});

// MY ORDERS
router.get('/orders', requireAuth, (req, res) => {
  const orders = db.prepare(`
    SELECT o.* FROM orders o WHERE o.user_id = ? ORDER BY o.created_at DESC
  `).all(req.session.user.id);

  const ordersWithItems = orders.map(order => {
    const items = db.prepare(`
      SELECT oi.*, p.title, p.cover_image FROM order_items oi
      JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?
    `).all(order.id);
    return { ...order, items };
  });

  res.render('account/orders', { title: 'My Orders - Rescue Study Guides', orders: ordersWithItems });
});

// MY WISHLIST
router.get('/wishlist', requireAuth, (req, res) => {
  const wishlist = db.prepare(`
    SELECT p.*, cat.name as category_name, cat.color as category_color
    FROM wishlist w JOIN products p ON w.product_id = p.id
    LEFT JOIN categories cat ON p.category_id = cat.id
    WHERE w.user_id = ? ORDER BY w.created_at DESC
  `).all(req.session.user.id);

  res.render('account/wishlist', { title: 'My Wishlist - Rescue Study Guides', wishlist });
});

// PROFILE SETTINGS
router.get('/profile', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
  res.render('account/profile', { title: 'Profile Settings - Rescue Study Guides', user, updateSuccess: null, updateError: null });
});

router.post('/profile', requireAuth, async (req, res) => {
  const { name, school, grade_level, country } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
  
  db.prepare(`
    UPDATE users SET name = ?, school = ?, grade_level = ?, country = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name.trim(), school || null, grade_level || null, country || null, user.id);

  req.session.user.name = name.trim();
  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  
  res.render('account/profile', { title: 'Profile Settings', user: updatedUser, updateSuccess: 'Profile updated successfully!', updateError: null });
});

// CHANGE PASSWORD
router.post('/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);

  const valid = await bcrypt.compare(current_password, user.password);
  if (!valid) {
    req.session.error = 'Current password is incorrect';
    return res.redirect('/account/profile');
  }

  if (new_password !== confirm_password) {
    req.session.error = 'New passwords do not match';
    return res.redirect('/account/profile');
  }

  if (new_password.length < 8) {
    req.session.error = 'Password must be at least 8 characters';
    return res.redirect('/account/profile');
  }

  const hashed = await bcrypt.hash(new_password, 12);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, user.id);
  
  req.session.success = 'Password changed successfully!';
  res.redirect('/account/profile');
});

module.exports = router;
