# 🚀 Rescue Study Guides — Hostinger Deployment Guide

## ✅ Pre-Deployment Checklist

Before uploading, make sure you have:
- [ ] A Hostinger VPS or Business Hosting plan (Node.js required)
- [ ] SSH access to your Hostinger server
- [ ] Node.js 18+ installed on server
- [ ] A domain pointed to Hostinger (rescuestudyguides.com)

---

## 📦 Step 1 — Upload Files to Hostinger

### Option A: File Manager (Hostinger hPanel)
1. Log into hPanel → File Manager
2. Navigate to `public_html/` (or your domain folder)
3. Upload `rescuestudyguides.zip`
4. Extract the zip — all files should be in the domain root
5. Delete the zip after extraction

### Option B: FTP (FileZilla)
1. Use your Hostinger FTP credentials
2. Upload all project files to `public_html/`

### Option C: SSH (Recommended)
```bash
# On your LOCAL machine — upload the zip
scp rescuestudyguides.zip user@yourserver.com:/home/user/public_html/

# SSH into server
ssh user@yourserver.com

# Navigate and extract
cd /home/user/public_html/
unzip rescuestudyguides.zip
```

---

## ⚙️ Step 2 — Configure Environment Variables

Edit the `.env` file on the server:

```bash
nano .env
```

Change these values:
```env
PORT=3000
NODE_ENV=production
SESSION_SECRET=your-super-long-random-secret-string-change-this-now!
DB_PATH=./database/rescuestudyguides.db
ADMIN_EMAIL=your-admin@email.com
ADMIN_PASSWORD=YourSecureAdminPassword123!
APP_URL=https://www.rescuestudyguides.com
```

> ⚠️ **IMPORTANT**: Change `SESSION_SECRET` to a long random string (50+ characters)
> ⚠️ **IMPORTANT**: Change `ADMIN_EMAIL` and `ADMIN_PASSWORD` before first launch

---

## 📦 Step 3 — Install Dependencies

```bash
cd /home/user/public_html/
npm install --production
```

---

## 🗃️ Step 4 — Initialize Database

The database auto-initializes on first start, but you can also run manually:

```bash
node database/db.js
```

---

## 🚀 Step 5 — Start the Application

### Using PM2 (Recommended for Hostinger VPS):
```bash
# Install PM2 globally if not installed
npm install -g pm2

# Start the app
pm2 start ecosystem.config.js --env production

# Save PM2 config so it restarts on server reboot
pm2 save
pm2 startup
```

### Using Hostinger Node.js Manager (hPanel):
1. Go to hPanel → Websites → your domain
2. Click **Node.js** in the sidebar
3. Set **Entry Point**: `app.js`
4. Set **Node.js Version**: 18.x or 20.x
5. Click **Start**

---

## 🌐 Step 6 — Configure Domain & SSL

In hPanel:
1. Go to **SSL/TLS** → Enable **Free SSL** (Let's Encrypt)
2. Go to **DNS** → Point A record to your server IP
3. Enable **Force HTTPS** redirect

---

## 🔐 Step 7 — First Login

Once running, visit:
- **Site**: https://www.rescuestudyguides.com
- **Admin**: https://www.rescuestudyguides.com/admin

Login with the credentials from your `.env` file.

**First things to do in Admin Panel:**
1. Add real product cover images
2. Upload PDF study guide files
3. Update product descriptions
4. Check the Orders dashboard

---

## 📂 Upload Study Guide PDFs

1. Go to `/admin/products/new` or edit an existing product
2. Upload the PDF file (max 200MB)
3. Uploaded files are stored in `public/uploads/guides/`
4. Files are served securely — students can only download guides they purchased

---

## 🛠️ Maintenance Commands

```bash
# View logs
pm2 logs rescue-study-guides

# Restart app
pm2 restart rescue-study-guides

# Update app (after file changes)
pm2 reload rescue-study-guides

# View status
pm2 status

# Stop app
pm2 stop rescue-study-guides
```

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| App won't start | Check `pm2 logs` for errors |
| Can't login | Check `.env` ADMIN_EMAIL/ADMIN_PASSWORD |
| Downloads not working | Ensure `public/uploads/guides/` is writable |
| 502 Bad Gateway | App crashed — run `pm2 restart rescue-study-guides` |
| Database errors | Delete `database/*.db` files and restart to re-seed |

---

## 📊 Project Structure

```
rescuestudyguides/
├── app.js              # Main application entry point
├── .env                # Environment variables (KEEP SECRET!)
├── .htaccess           # Apache proxy config
├── ecosystem.config.js # PM2 configuration
├── database/
│   └── db.js           # Database setup & seed data
├── routes/
│   ├── store.js        # Homepage, shop, product pages
│   ├── auth.js         # Login, register, logout
│   ├── cart.js         # Cart & checkout
│   ├── downloads.js    # File download handler
│   ├── account.js      # User account pages
│   └── admin.js        # Admin panel
├── views/              # EJS templates
├── public/
│   ├── css/style.css   # Custom styles
│   ├── js/main.js      # Frontend JavaScript
│   └── uploads/        # Uploaded PDFs & images
└── middleware/
    └── auth.js         # Authentication middleware
```

---

## 💬 Support

Need help? Email: hello@rescuestudyguides.com
