const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');

// MY DOWNLOADS PAGE
router.get('/', requireAuth, (req, res) => {
  const downloads = db.prepare(`
    SELECT d.*, p.title, p.cover_image, p.subject, p.level, p.curriculum,
           c.name as category_name, c.color as category_color
    FROM downloads d
    JOIN products p ON d.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE d.user_id = ?
    ORDER BY d.created_at DESC
  `).all(req.session.user.id);

  res.render('downloads', { title: 'My Downloads - Rescue Study Guides', downloads });
});

// DOWNLOAD FILE
router.get('/file/:token', requireAuth, (req, res) => {
  const download = db.prepare(`
    SELECT d.*, p.file_path, p.file_name, p.title
    FROM downloads d JOIN products p ON d.product_id = p.id
    WHERE d.download_token = ? AND d.user_id = ?
  `).get(req.params.token, req.session.user.id);

  if (!download) {
    req.session.error = 'Download not found or not authorized';
    return res.redirect('/account/downloads');
  }

  if (download.max_downloads > 0 && download.download_count >= download.max_downloads) {
    req.session.error = 'Download limit reached for this file. Please contact support.';
    return res.redirect('/account/downloads');
  }

  if (download.expires_at && new Date(download.expires_at) < new Date()) {
    req.session.error = 'This download link has expired. Please contact support.';
    return res.redirect('/account/downloads');
  }

  if (!download.file_path) {
    req.session.error = 'File not yet available. Please check back soon!';
    return res.redirect('/account/downloads');
  }

  const filePath = path.join(__dirname, '..', download.file_path);
  
  if (!fs.existsSync(filePath)) {
    req.session.error = 'File temporarily unavailable. Please contact support.';
    return res.redirect('/account/downloads');
  }

  // Update download count
  db.prepare(`
    UPDATE downloads SET download_count = download_count + 1, last_downloaded = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(download.id);

  // Update product download count
  db.prepare('UPDATE products SET downloads_count = downloads_count + 1 WHERE id = ?').run(download.product_id);

  // Send file
  res.download(filePath, download.file_name || path.basename(filePath), (err) => {
    if (err) {
      console.error('Download error:', err);
    }
  });
});

module.exports = router;
