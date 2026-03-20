// Site Settings Helper
// Loads from DB, falls back to process.env, cached in memory for 60s

const db = require('./db');

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 60000; // 60 seconds

// Default values for all settings
const DEFAULTS = {
  APP_NAME: 'Rescue Study Guides',
  APP_URL: 'https://rescue-study-guides-production.up.railway.app',
  SITE_TAGLINE: 'From I Don\'t Get It to I Ace It!',
  SITE_LOGO_URL: '',
  SITE_FAVICON_URL: '',
  SITE_PRIMARY_COLOR: '#E63946',
  FOOTER_TEXT: 'Rescue Study Guides',
  COPYRIGHT_TEXT: '© 2026 Rescue Study Guides. All rights reserved.',
  META_DESCRIPTION: 'High-quality colorful revision guides for IGCSE, AP, SABIS & more',
  META_KEYWORDS: 'IGCSE, AP Chemistry, SABIS, study guides, revision',
  PROMO_BANNER_ENABLED: 'false',
  PROMO_BANNER_TEXT: '🎉 Special Offer! Use code RESCUE20 for 20% off',
  PROMO_BANNER_CODE: 'RESCUE20',
  CONTACT_EMAIL: 'kanayatichemistry@gmail.com',
  SUPPORT_WHATSAPP: '',
  INSTAGRAM_URL: '',
  TIKTOK_URL: '',
  FACEBOOK_URL: '',
  YOUTUBE_URL: '',
  TWITTER_URL: '',
  LINKEDIN_URL: '',
  CURRENCY: 'USD',
  CURRENCY_SYMBOL: '$',
  MAX_DOWNLOADS: '5',
  DEFAULT_MAX_DOWNLOADS: '3',
  GOOGLE_ANALYTICS_ID: '',
  FACEBOOK_PIXEL_ID: '',
  TAWK_PROPERTY_ID: '',
  HOMEPAGE_HERO_TITLE: 'From I Don\'t Get It to I Ace It!',
  HOMEPAGE_HERO_SUBTITLE: 'High-quality colorful revision guides for IGCSE, AP, SABIS & more',
  FEATURED_SECTION_TITLE: '★ Featured Rescue Guides',
  TAX_ENABLED: 'false',
  TAX_RATE: '0',
  TAX_LABEL: 'VAT',
  MAX_CART_ITEMS: '10',
  FREE_TRIAL_DAYS: '0',
  PDF_WATERMARK: 'false',
  REQUIRE_EMAIL_VERIFICATION: 'false',
  ORDER_NOTIFICATION_EMAIL: '',
  LOW_STOCK_ALERT: '5',
  CUSTOM_HEAD_CODE: '',
  CUSTOM_FOOTER_CODE: '',
  SHOW_REVIEWS: 'true',
  SHOW_WISHLIST: 'true',
  SHOW_HOW_IT_WORKS: 'true',
  ALLOW_REGISTRATION: 'true',
  MAINTENANCE_MODE: 'false',
  STRIPE_PUBLISHABLE_KEY: '',
  PAYPAL_CLIENT_ID: '',
  PAYPAL_MODE: 'sandbox',
  SMTP_HOST: '',
  SMTP_PORT: '587',
  SMTP_USER: '',
  SMTP_FROM: '',
  ADMIN_EMAIL: 'admin@rescuestudyguides.com',
};

const getSettings = () => {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < CACHE_TTL) return _cache;

  // Load from DB
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const dbSettings = {};
  rows.forEach(r => { dbSettings[r.key] = r.value; });

  // Merge: defaults → process.env → DB (DB wins)
  const settings = { ...DEFAULTS };
  Object.keys(DEFAULTS).forEach(k => {
    if (process.env[k] !== undefined) settings[k] = process.env[k];
  });
  Object.assign(settings, dbSettings);

  _cache = settings;
  _cacheTime = now;
  return settings;
};

const setSetting = (key, value) => {
  db.prepare('INSERT OR REPLACE INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(key, value);
  _cache = null; // invalidate cache
};

const setSettings = (obj) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
  const setMany = db.transaction((entries) => {
    for (const [key, value] of entries) stmt.run(key, String(value ?? ''));
  });
  setMany(Object.entries(obj));
  _cache = null; // invalidate cache
};

module.exports = { getSettings, setSetting, setSettings, DEFAULTS };
