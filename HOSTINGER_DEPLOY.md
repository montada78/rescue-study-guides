# 🚀 Rescue Study Guides — Hostinger Deployment Guide

## 📁 What's Included
- Full Node.js Express web application
- SQLite database (auto-created on first run)
- User authentication (login/register)
- Online store with product management
- Downloadable PDF system
- Admin panel at `/admin`
- Beautiful Gen Z-styled frontend

---

## 🖥️ Hostinger Setup (Node.js Hosting)

### Step 1: Upload Files
1. Log into Hostinger Control Panel (hPanel)
2. Go to **File Manager** or use **FTP** (FileZilla)
3. Navigate to your domain's folder (e.g., `public_html` or a subdirectory)
4. Upload ALL files EXCEPT `node_modules/` and `database/*.db`

### Step 2: Set Node.js App in hPanel
1. Go to **Websites → Manage → Node.js**
2. Set **Node.js version**: 18.x or higher
3. Set **Application root**: `/public_html` (or your folder)
4. Set **Application URL**: your domain
5. Set **Application startup file**: `app.js`
6. Click **Create**

### Step 3: Install Dependencies
In the Node.js terminal in hPanel (or SSH):
```bash
cd /home/username/public_html
npm install --production
```

### Step 4: Set Environment Variables
In hPanel Node.js settings, add these environment variables:
```
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-super-secret-key-change-this-to-something-random
DB_PATH=./database/rescuestudyguides.db
ADMIN_EMAIL=your-admin@email.com
ADMIN_PASSWORD=YourSecureAdminPassword123!
APP_NAME=Rescue Study Guides
APP_URL=https://www.rescuestudyguides.com
```

### Step 5: Create Required Directories
```bash
mkdir -p database
mkdir -p public/uploads/guides
mkdir -p public/uploads/images
```

### Step 6: Start the App
In hPanel Node.js panel, click **Start** or **Restart**

---

## 🔐 Admin Panel Access
- **URL**: `https://yourdomain.com/admin`
- **Email**: Set in environment variables (`ADMIN_EMAIL`)
- **Password**: Set in environment variables (`ADMIN_PASSWORD`)

---

## 📤 Uploading Study Guide PDFs
1. Login as admin
2. Go to `/admin/products/new`
3. Fill in guide details
4. Upload your PDF file (up to 200MB)
5. Upload a cover image
6. Click **Publish Guide**

Students can then purchase/download from their account.

---

## 🗃️ Database
- SQLite is used (no MySQL setup needed!)
- Database auto-creates on first run
- Located at `./database/rescuestudyguides.db`
- Backup this file regularly!

---

## 📧 Email Setup (Optional - for password reset)
To enable real email, add to environment variables:
```
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_USER=hello@rescuestudyguides.com
SMTP_PASS=your-email-password
```
Then install nodemailer: `npm install nodemailer`

---

## 💳 Payment Integration (Production)
The current checkout is a demo. To add real payments:
- **Stripe**: Install `stripe` package and add `STRIPE_SECRET_KEY`
- **PayPal**: Install `paypal-rest-sdk` and add PayPal credentials

---

## 🔄 Restart App
If you make changes, restart via hPanel Node.js panel or SSH:
```bash
pm2 restart rescue-study-guides
# OR
node app.js
```

---

## 📞 Support
For help: hello@rescuestudyguides.com

---

## 🌐 Domain Setup
1. Point your domain DNS to Hostinger nameservers
2. Add SSL certificate (free with Hostinger)
3. Update `APP_URL` environment variable to your domain

---

*Built with ❤️ for Rescue Study Guides — Rescue Your Exam Results!*
