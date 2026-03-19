const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');

// APPLY COUPON (AJAX)
router.post('/coupon/apply', requireAuth, (req, res) => {
  const code = (req.body.code || '').trim().toUpperCase();
  if (!code) return res.json({ success: false, message: 'Enter a coupon code.' });

  const coupon = db.prepare(`
    SELECT * FROM coupons
    WHERE code = ? AND is_active = 1
    AND (expires_at IS NULL OR expires_at > datetime('now'))
    AND (max_uses IS NULL OR uses_count < max_uses)
  `).get(code);

  if (!coupon) return res.json({ success: false, message: 'Invalid or expired coupon code.' });

  // Get cart total
  const cartItems = db.prepare(`
    SELECT p.price FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?
  `).all(req.session.user.id);
  const subtotal = cartItems.reduce((s, i) => s + i.price, 0);

  if (subtotal < coupon.min_order) {
    return res.json({ success: false, message: `Minimum order of $${coupon.min_order.toFixed(2)} required.` });
  }

  const discount = coupon.type === 'percent'
    ? parseFloat((subtotal * coupon.value / 100).toFixed(2))
    : Math.min(coupon.value, subtotal);

  const newTotal = Math.max(0, subtotal - discount);

  // Store in session
  req.session.coupon = { code: coupon.code, type: coupon.type, value: coupon.value, discount, id: coupon.id };

  return res.json({
    success: true,
    message: `✅ Code applied! You saved $${discount.toFixed(2)}`,
    discount: discount.toFixed(2),
    newTotal: newTotal.toFixed(2),
    label: coupon.type === 'percent' ? `${coupon.value}% OFF` : `$${coupon.value} OFF`
  });
});

// REMOVE COUPON
router.post('/coupon/remove', requireAuth, (req, res) => {
  req.session.coupon = null;
  res.json({ success: true });
});

// VIEW CART
router.get('/', requireAuth, (req, res) => {
  const cartItems = db.prepare(`
    SELECT c.id as cart_id, p.*, cat.name as category_name
    FROM cart c
    JOIN products p ON c.product_id = p.id
    LEFT JOIN categories cat ON p.category_id = cat.id
    WHERE c.user_id = ?
  `).all(req.session.user.id);

  const subtotal = cartItems.reduce((sum, item) => sum + item.price, 0);
  const coupon = req.session.coupon || null;
  const discount = coupon ? coupon.discount : 0;
  const total = Math.max(0, subtotal - discount);
  res.render('cart', { title: 'Shopping Cart - Exam Rescue Guides', cartItems, subtotal, total, discount, coupon });
});

// ADD TO CART
router.post('/add/:productId', requireAuth, (req, res) => {
  const productId = parseInt(req.params.productId);
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(productId);
  
  if (!product) {
    return res.json({ success: false, message: 'Product not found' });
  }

  // Check if already owns it
  const owned = db.prepare('SELECT id FROM downloads WHERE user_id = ? AND product_id = ?')
                  .get(req.session.user.id, productId);
  if (owned) {
    return res.json({ success: false, message: 'You already own this guide!', owned: true });
  }

  // Handle free products differently
  if (product.is_free || product.price === 0) {
    // Auto-grant download for free products
    const { v4: uuidv4 } = require('uuid');
    db.prepare(`
      INSERT OR IGNORE INTO downloads (user_id, product_id, download_token, max_downloads)
      VALUES (?, ?, ?, 10)
    `).run(req.session.user.id, productId, uuidv4());
    
    return res.json({ success: true, message: 'Free guide added to your library!', free: true, redirect: '/account/downloads' });
  }

  try {
    db.prepare('INSERT OR IGNORE INTO cart (user_id, product_id) VALUES (?, ?)').run(req.session.user.id, productId);
    const cartCount = db.prepare('SELECT COUNT(*) as count FROM cart WHERE user_id = ?').get(req.session.user.id).count;
    res.json({ success: true, message: 'Added to cart!', cartCount });
  } catch (err) {
    res.json({ success: false, message: 'Already in cart' });
  }
});

// REMOVE FROM CART
router.post('/remove/:productId', requireAuth, (req, res) => {
  db.prepare('DELETE FROM cart WHERE user_id = ? AND product_id = ?').run(req.session.user.id, parseInt(req.params.productId));
  
  if (req.headers['content-type']?.includes('json')) {
    const cartCount = db.prepare('SELECT COUNT(*) as count FROM cart WHERE user_id = ?').get(req.session.user.id).count;
    return res.json({ success: true, cartCount });
  }
  
  req.session.success = 'Item removed from cart';
  res.redirect('/cart');
});

// CHECKOUT PAGE
router.get('/checkout', requireAuth, (req, res) => {
  const cartItems = db.prepare(`
    SELECT c.id as cart_id, p.*, cat.name as category_name
    FROM cart c JOIN products p ON c.product_id = p.id
    LEFT JOIN categories cat ON p.category_id = cat.id
    WHERE c.user_id = ?
  `).all(req.session.user.id);

  if (cartItems.length === 0) return res.redirect('/cart');

  const subtotal = cartItems.reduce((sum, item) => sum + item.price, 0);
  const coupon = req.session.coupon || null;
  const discount = coupon ? coupon.discount : 0;
  const total = Math.max(0, subtotal - discount);
  res.render('checkout', { title: 'Checkout - Exam Rescue Guides', cartItems, subtotal, total, discount, coupon });
});

// PROCESS ORDER (Demo - in production integrate Stripe/PayPal)
router.post('/checkout/process', requireAuth, (req, res) => {
  const { payment_method = 'card', card_name, notes } = req.body;
  
  const cartItems = db.prepare(`
    SELECT p.* FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?
  `).all(req.session.user.id);

  if (cartItems.length === 0) return res.redirect('/cart');

  const subtotal = cartItems.reduce((sum, item) => sum + item.price, 0);
  const coupon = req.session.coupon || null;
  const discount = coupon ? coupon.discount : 0;
  const total = Math.max(0, subtotal - discount);
  const orderNumber = 'RSG-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();

  // Create order
  const orderResult = db.prepare(`
    INSERT INTO orders (order_number, user_id, total_amount, status, payment_method, notes)
    VALUES (?, ?, ?, 'completed', ?, ?)
  `).run(orderNumber, req.session.user.id, total, payment_method, notes || null);

  const orderId = orderResult.lastInsertRowid;
  const { v4: uuidv4 } = require('uuid');

  // Create order items and grant downloads
  cartItems.forEach(product => {
    db.prepare('INSERT INTO order_items (order_id, product_id, price) VALUES (?, ?, ?)').run(orderId, product.id, product.price);
    db.prepare(`
      INSERT OR IGNORE INTO downloads (user_id, product_id, order_id, download_token, max_downloads)
      VALUES (?, ?, ?, ?, 5)
    `).run(req.session.user.id, product.id, orderId, uuidv4());
  });

  // Increment coupon uses
  if (coupon && coupon.id) {
    db.prepare('UPDATE coupons SET uses_count = uses_count + 1 WHERE id = ?').run(coupon.id);
  }

  // Clear cart and coupon session
  db.prepare('DELETE FROM cart WHERE user_id = ?').run(req.session.user.id);
  req.session.coupon = null;

  req.session.success = `Order ${orderNumber} placed successfully! Your guides are ready to download. 🎉`;
  res.redirect('/account/downloads');
});

// WISHLIST TOGGLE
router.post('/wishlist/:productId', requireAuth, (req, res) => {
  const productId = parseInt(req.params.productId);
  const existing = db.prepare('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?').get(req.session.user.id, productId);
  
  if (existing) {
    db.prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?').run(req.session.user.id, productId);
    return res.json({ success: true, wishlisted: false, message: 'Removed from wishlist' });
  } else {
    db.prepare('INSERT OR IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)').run(req.session.user.id, productId);
    return res.json({ success: true, wishlisted: true, message: 'Added to wishlist!' });
  }
});

module.exports = router;
