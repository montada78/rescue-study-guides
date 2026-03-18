# 🚀 Hostinger Deployment Guide — Rescue Study Guides

## ✅ COMPLETED FEATURES

### Frontend / Pages
- ✅ **Home Page** — Hero, Stats, Subject Categories, Featured Products, Testimonials, CTA
- ✅ **Shop Page** — Filter by subject/level/curriculum/sort, search, pagination
- ✅ **Product Detail Page** — Full info, reviews, related guides, buy/cart/wishlist
- ✅ **About Page** — Mission, values, stats
- ✅ **How It Works Page** — 5-step guide + FAQ accordion
- ✅ **Contact Page** — Form + contact info
- ✅ **Cart Page** — Cart items, promo code, order summary
- ✅ **Checkout Page** — Secure payment form
- ✅ **404 & Error Pages**

### Authentication
- ✅ **User Registration** — Name, email, password, school, level, country
- ✅ **User Login** — Session-based, remember me
- ✅ **Logout**
- ✅ **Forgot Password** page

### Student Account
- ✅ **Dashboard** — Stats, recent downloads, quick links
- ✅ **My Downloads** — View & download purchased/free guides
- ✅ **My Orders** — Full purchase history
- ✅ **Wishlist** — Save guides for later
- ✅ **Profile Settings** — Edit name, school, level, country
- ✅ **Change Password**

### Store / E-Commerce
- ✅ **Product Catalog** with 10 seed products
- ✅ **Add to Cart / Remove from Cart**
- ✅ **Wishlist toggle**
- ✅ **Checkout & Order creation**
- ✅ **Free guide instant access**
- ✅ **Download token system** (max 5 downloads per guide)

### Admin Panel (`/admin`)
- ✅ **Dashboard** — Revenue, users, orders, top products stats
- ✅ **Products** — List, add, edit, delete, toggle active
- ✅ **Add/Edit Guide** — Upload PDF + cover image, set price, curriculum, level
- ✅ **Orders** — View all orders with items
- ✅ **Users** — View all students, grant manual download access
- ✅ **Categories** — View & add categories

### Database (SQLite via better-sqlite3)
- ✅ users, categories, products, orders, order_items, downloads, cart, reviews, wishlist
- ✅ Auto-seeded with 10 demo products + admin account

---

## 🔐 Admin Login
- **URL:** `/admin`
- **Email:** `admin@rescuestudyguides.com`
- **Password:** `Admin@2024!Rescue`

> ⚠️ Change these in `.env` before going live!

---

## 📦 HOSTINGER DEPLOYMENT STEPS

### 1. Upload Files
Upload the **entire project folder** (excluding `node_modules`) to your Hostinger Node.js hosting root. Usually `/home/username/htdocs/rescuestudyguides.com/`

### 2. Set Node.js Version
In Hostinger Panel → Node.js → Set version to **18+**

### 3. Set Startup File
In Hostinger Panel → Node.js → Startup file: `app.js`

### 4. Install Dependencies
In Hostinger SSH terminal:
```bash
cd /home/username/htdocs/rescuestudyguides.com
npm install --production
```

### 5. Configure Environment Variables
In Hostinger Panel → Node.js → Environment Variables, add:
```
NODE_ENV=production
SESSION_SECRET=your-super-secret-random-key-here
PORT=3000
ADMIN_EMAIL=your-admin@email.com
ADMIN_PASSWORD=YourSecurePassword123!
DB_PATH=./database/rescuestudyguides.db
UPLOAD_PATH=./public/uploads
```

### 6. Initialize Database
```bash
node database/db.js
```

### 7. Start the App
In Hostinger Panel → Node.js → **Restart Application**

Or via SSH:
```bash
npm start
```

### 8. Set Up Domain
- Point your domain `rescuestudyguides.com` to Hostinger
- Enable SSL/HTTPS in Hostinger Panel

---

## 📁 PROJECT STRUCTURE
```
rescuestudyguides/
├── app.js              ← Main server entry point
├── package.json        ← Dependencies
├── .env                ← Environment config (DO NOT COMMIT)
├── .htaccess           ← Apache proxy config
├── database/
│   ├── db.js           ← Database init & seed
│   └── *.db            ← SQLite database files (auto-created)
├── routes/
│   ├── store.js        ← Home, Shop, Product pages
│   ├── auth.js         ← Login, Register, Logout
│   ├── cart.js         ← Cart, Checkout, Wishlist
│   ├── downloads.js    ← Download management
│   ├── account.js      ← Student account pages
│   └── admin.js        ← Admin panel
├── middleware/
│   └── auth.js         ← Auth guards
├── views/              ← EJS templates
│   ├── layout.ejs      ← Main layout (nav + footer)
│   ├── index.ejs       ← Homepage
│   ├── shop.ejs        ← Shop page
│   ├── product.ejs     ← Product detail
│   ├── auth/           ← Login, Register, Forgot password
│   ├── account/        ← Dashboard, Downloads, Orders, Wishlist, Profile
│   └── admin/          ← Admin dashboard, products, orders, users
└── public/
    ├── css/style.css   ← Custom styles
    ├── js/main.js      ← Frontend JavaScript
    └── uploads/        ← Uploaded PDF guides & images
```

---

## 💰 PAYMENTS (TO INTEGRATE)
Currently checkout is a demo. To take real payments, integrate one of:
- **Stripe** — Add `stripe` npm package, create payment intent in checkout route
- **PayPal** — Add `@paypal/checkout-server-sdk`
- **Paddle** — Great for digital downloads with built-in tax handling

---

## 📧 EMAIL (TO INTEGRATE)
For password reset emails, integrate:
- **Nodemailer** with Gmail SMTP or
- **SendGrid** (`@sendgrid/mail`) or
- **Mailgun**

---

## 🌐 Live Preview URL (Sandbox)
https://3000-itvyzjnd3wz1fjhyh2u45-8f57ffe2.sandbox.novita.ai
