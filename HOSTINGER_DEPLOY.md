# 🚀 Hostinger Deployment Guide — Rescue Study Guides

## Prerequisites
- Hostinger VPS or Business Hosting with Node.js support
- Node.js 18+ installed on server
- SSH access to your Hostinger account

---

## Step 1 — Upload Files

### Option A: File Manager (Easiest)
1. Log into Hostinger hPanel
2. Go to **File Manager**
3. Navigate to `public_html` (or your domain folder)
4. Upload the `rescuestudyguides.zip` file
5. Extract it — you should see `app.js`, `package.json`, etc.

### Option B: FTP (FileZilla)
1. Get FTP credentials from hPanel → FTP Accounts
2. Connect via FileZilla
3. Upload all files to `/public_html/`

### Option C: SSH + Git (Best for updates)
```bash
ssh u123456789@yourdomain.com
cd /home/u123456789/domains/rescuestudyguides.com/public_html
git clone https://github.com/YOURUSERNAME/rescue-study-guides.git .
```

---

## Step 2 — Install Dependencies on Server

```bash
# SSH into your server
ssh u123456789@yourdomain.com

# Go to your app directory
cd /home/u123456789/domains/rescuestudyguides.com/public_html

# Install production dependencies only
npm install --production
```

---

## Step 3 — Configure Environment Variables

Create the `.env` file on the server:
```bash
nano .env
```

Paste and update these values:
```
PORT=3000
NODE_ENV=production
SESSION_SECRET=CHANGE-THIS-TO-A-LONG-RANDOM-STRING-AT-LEAST-64-CHARS
DB_PATH=./database/rescuestudyguides.db
ADMIN_EMAIL=your-real-admin@email.com
ADMIN_PASSWORD=YourStrongPassword123!
MAX_FILE_SIZE=104857600
UPLOAD_PATH=./public/uploads
APP_NAME=Rescue Study Guides
APP_URL=https://www.rescuestudyguides.com
```

**IMPORTANT:** Generate a real session secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Step 4 — Set Up Node.js App in hPanel

1. In Hostinger hPanel, go to **Advanced → Node.js**
2. Click **Create Application**
3. Set:
   - **Node.js version**: 18.x or 20.x
   - **Application mode**: Production
   - **Application root**: `/public_html` (or your folder)
   - **Application URL**: Your domain
   - **Application startup file**: `app.js`
4. Click **Create**
5. Click **Run NPM Install**
6. Click **Start Application**

---

## Step 5 — Initialize Database

The database initializes automatically on first start. To verify:
```bash
# SSH into server
node -e "require('./database/db.js'); console.log('DB OK')"
```

---

## Step 6 — Set Up .htaccess (for Apache proxy)

The `.htaccess` file is already included. It proxies all requests to Node.js.

If you're on Hostinger shared hosting with Node.js support, also set up the proxy in hPanel.

---

## Step 7 — Upload Study Guide PDFs

Once the site is live:
1. Log in as Admin: `https://yourdomain.com/admin`
   - Email: (what you set in .env)
   - Password: (what you set in .env)
2. Go to **Products → Add Guide**
3. Fill in the guide details
4. Upload the PDF file (up to 200MB)
5. Set price and publish

---

## Admin Panel Access

| URL | Purpose |
|-----|---------|
| `/admin` | Dashboard |
| `/admin/products/new` | Upload new guide |
| `/admin/products` | Manage all guides |
| `/admin/orders` | View all orders |
| `/admin/users` | View all students |
| `/admin/categories` | Manage categories |

---

## Default Admin Credentials

Check your `.env` file:
- **Email**: ADMIN_EMAIL value
- **Password**: ADMIN_PASSWORD value

⚠️ **Change these immediately after first login!**

---

## Folder Structure on Hostinger

```
public_html/
├── app.js              ← Main entry point
├── package.json
├── .env                ← Environment variables (NEVER commit this)
├── .htaccess           ← Apache proxy config
├── database/
│   └── rescuestudyguides.db   ← SQLite database (auto-created)
├── public/
│   ├── css/style.css
│   ├── js/main.js
│   └── uploads/
│       ├── guides/     ← PDF files uploaded here
│       └── images/     ← Cover images uploaded here
├── routes/
├── views/
└── middleware/
```

---

## Updating the Site

```bash
# SSH in
cd /public_html

# Pull latest changes (if using git)
git pull origin main

# Restart the app
npm start
# OR if using PM2:
pm2 restart rescue-study-guides
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| App won't start | Check `node app.js` manually and read errors |
| Database error | Ensure `database/` folder has write permissions: `chmod 755 database/` |
| Uploads failing | Ensure `public/uploads/` has write permissions: `chmod 755 public/uploads -R` |
| Session issues | Make sure SESSION_SECRET is set in `.env` |
| 500 errors | Check logs: `pm2 logs` or `cat logs/error.log` |

---

## Support

📧 Built for **rescuestudyguides.com**
🛠️ Stack: Node.js + Express + SQLite + EJS + TailwindCSS
