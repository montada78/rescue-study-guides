const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// ─── STRIPE ──────────────────────────────────────────────────────────────────
let stripe = null;
if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('YOUR_')) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// Create Stripe Payment Intent
router.post('/stripe/create-intent', requireAuth, async (req, res) => {
  if (!stripe) return res.json({ error: 'Stripe not configured. Add STRIPE_SECRET_KEY to .env' });

  try {
    const cartItems = db.prepare(`
      SELECT p.* FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?
    `).all(req.session.user.id);

    if (!cartItems.length) return res.json({ error: 'Cart is empty' });

    const total = cartItems.reduce((sum, i) => sum + i.price, 0);
    const amountCents = Math.round(total * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      metadata: { user_id: String(req.session.user.id), user_email: req.session.user.email },
    });

    res.json({ clientSecret: paymentIntent.client_secret, amount: total });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.json({ error: err.message });
  }
});

// Stripe Payment Success — confirm order
router.post('/stripe/confirm', requireAuth, async (req, res) => {
  const { payment_intent_id } = req.body;
  if (!stripe) return res.redirect('/cart/checkout?error=stripe_not_configured');

  try {
    const intent = await stripe.paymentIntents.retrieve(payment_intent_id);
    if (intent.status !== 'succeeded') {
      req.session.error = 'Payment not completed. Please try again.';
      return res.redirect('/cart/checkout');
    }

    await _fulfillOrder(req, 'stripe', payment_intent_id);
    req.session.success = '🎉 Payment successful! Your guides are ready to download.';
    res.redirect('/account/downloads');
  } catch (err) {
    console.error('Stripe confirm error:', err.message);
    req.session.error = 'Payment verification failed. Contact support.';
    res.redirect('/cart/checkout');
  }
});

// ─── PAYPAL ───────────────────────────────────────────────────────────────────
const PAYPAL_API = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getPayPalToken() {
  const creds = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const r = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await r.json();
  return data.access_token;
}

// Create PayPal Order
router.post('/paypal/create-order', requireAuth, async (req, res) => {
  if (!process.env.PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID.includes('YOUR_')) {
    return res.json({ error: 'PayPal not configured. Add PAYPAL_CLIENT_ID to .env' });
  }

  try {
    const cartItems = db.prepare(`
      SELECT p.* FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?
    `).all(req.session.user.id);

    if (!cartItems.length) return res.json({ error: 'Cart is empty' });

    const total = cartItems.reduce((sum, i) => sum + i.price, 0).toFixed(2);
    const token = await getPayPalToken();

    const r = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: 'USD', value: total },
          description: 'Rescue Study Guides',
        }],
        application_context: {
          return_url: `${process.env.APP_URL}/payment/paypal/capture`,
          cancel_url: `${process.env.APP_URL}/cart/checkout`,
          brand_name: 'Rescue Study Guides',
          user_action: 'PAY_NOW',
        },
      }),
    });

    const order = await r.json();
    if (order.id) {
      res.json({ orderID: order.id });
    } else {
      res.json({ error: order.message || 'PayPal order creation failed' });
    }
  } catch (err) {
    console.error('PayPal create error:', err.message);
    res.json({ error: err.message });
  }
});

// Capture PayPal Payment
router.post('/paypal/capture-order', requireAuth, async (req, res) => {
  const { orderID } = req.body;
  try {
    const token = await getPayPalToken();
    const r = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const data = await r.json();

    if (data.status === 'COMPLETED') {
      await _fulfillOrder(req, 'paypal', orderID);
      res.json({ success: true, redirect: '/account/downloads' });
    } else {
      res.json({ success: false, error: 'Payment not completed' });
    }
  } catch (err) {
    console.error('PayPal capture error:', err.message);
    res.json({ success: false, error: err.message });
  }
});

// ─── DEMO / TEST PAYMENT ──────────────────────────────────────────────────────
router.post('/demo/process', requireAuth, async (req, res) => {
  await _fulfillOrder(req, 'demo', 'DEMO-' + Date.now());
  req.session.success = '✅ Demo order placed! Guides are ready to download.';
  res.redirect('/account/downloads');
});

// ─── SHARED ORDER FULFILLMENT ─────────────────────────────────────────────────
async function _fulfillOrder(req, paymentMethod, paymentReference) {
  const cartItems = db.prepare(`
    SELECT p.* FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?
  `).all(req.session.user.id);

  if (!cartItems.length) return;

  const total = cartItems.reduce((sum, i) => sum + i.price, 0);
  const orderNumber = 'RSG-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();

  const orderResult = db.prepare(`
    INSERT INTO orders (order_number, user_id, total_amount, status, payment_method, payment_reference)
    VALUES (?, ?, ?, 'completed', ?, ?)
  `).run(orderNumber, req.session.user.id, total, paymentMethod, paymentReference);

  const orderId = orderResult.lastInsertRowid;

  cartItems.forEach(product => {
    db.prepare('INSERT INTO order_items (order_id, product_id, price) VALUES (?, ?, ?)').run(orderId, product.id, product.price);
    db.prepare(`INSERT OR IGNORE INTO downloads (user_id, product_id, order_id, download_token, max_downloads) VALUES (?, ?, ?, ?, 5)`)
      .run(req.session.user.id, product.id, orderId, uuidv4());
  });

  db.prepare('DELETE FROM cart WHERE user_id = ?').run(req.session.user.id);
}

module.exports = router;
