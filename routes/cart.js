const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');

// VIEW CART
router.get('/', requireAuth, (req, res) => {
  const cartItems = db.prepare(`
    SELECT c.id as cart_id, p.*, cat.name as category_name
    FROM cart c
    JOIN products p ON c.product_id = p.id
    LEFT JOIN categories cat ON p.category_id = cat.id
    WHERE c.user_id = ?
  `).all(req.session.user.id);

  const total = cartItems.reduce((sum, item) => sum + item.price, 0);
  res.render('cart', { title: 'Shopping Cart - Rescue Study Guides', cartItems, total });
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

  const total = cartItems.reduce((sum, item) => sum + item.price, 0);
  res.render('checkout', { title: 'Checkout - Rescue Study Guides', cartItems, total });
});

// PROCESS ORDER (Demo - in production integrate Stripe/PayPal)
router.post('/checkout/process', requireAuth, (req, res) => {
  const { payment_method = 'card', card_name, notes } = req.body;
  
  const cartItems = db.prepare(`
    SELECT p.* FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?
  `).all(req.session.user.id);

  if (cartItems.length === 0) return res.redirect('/cart');

  const total = cartItems.reduce((sum, item) => sum + item.price, 0);
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

  // Clear cart
  db.prepare('DELETE FROM cart WHERE user_id = ?').run(req.session.user.id);

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
