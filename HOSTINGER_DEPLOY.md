# 🚀 RESCUE STUDY GUIDES — HOSTINGER DEPLOYMENT GUIDE

## Prerequisites
- Node.js 18+ installed on Hostinger
- SSH access to your Hostinger VPS or use the File Manager for shared hosting

---

## 🖥️ Option 1: Hostinger VPS / Cloud Hosting (RECOMMENDED)

### Step 1: Upload Files
```bash
# Compress the project (exclude node_modules and uploads)
tar --exclude='./node_modules' --exclude='./public/uploads' --exclude='./.git' -czf rescue-study-guides.tar.gz .

# Upload via SCP
scp rescue-study-guides.tar.gz user@YOUR_SERVER_IP:/home/user/
```

### Step 2: Connect to Server via SSH
```bash
ssh user@YOUR_SERVER_IP
```

### Step 3: Extract & Setup
```bash
cd /home/user
mkdir -p rescue-study-guides
tar -xzf rescue-study-guides.tar.gz -C rescue-study-guides
cd rescue-study-guides

# Install dependencies
npm install --production

# Create required upload directories
mkdir -p public/uploads/guides public/uploads/images

# Build CSS (already built - but run if making changes)
npm run build:css
```

### Step 4: Configure Environment
```bash
# Edit .env file with your production settings
nano .env
```

Update these values in .env:
```
NODE_ENV=production
SESSION_SECRET=YOUR_VERY_LONG_RANDOM_SECRET_HERE_CHANGE_THIS
DB_PATH=./database/rescuestudyguides.db
ADMIN_EMAIL=your-admin-email@domain.com
ADMIN_PASSWORD=YourSecureAdminPassword123!
APP_URL=https://www.rescuestudyguides.com
```

### Step 5: Install PM2 (Process Manager)
```bash
npm install -g pm2
pm2 start app.js --name "rescue-study-guides" --env production
pm2 save
pm2 startup
```

### Step 6: Configure NGINX (if using NGINX reverse proxy)
Create `/etc/nginx/sites-available/rescuestudyguides`:
```nginx
server {
    listen 80;
    server_name rescuestudyguides.com www.rescuestudyguides.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Serve static files directly via NGINX for speed
    location /css/ {
        alias /home/user/rescue-study-guides/public/css/;
        expires 1d;
        add_header Cache-Control "public, no-transform";
    }
    
    location /js/ {
        alias /home/user/rescue-study-guides/public/js/;
        expires 1d;
    }
    
    location /images/ {
        alias /home/user/rescue-study-guides/public/images/;
        expires 7d;
    }
    
    # Security: Block direct access to uploads/guides (PDFs should only be served via /downloads route)
    location /uploads/guides/ {
        deny all;
        return 403;
    }
    
    client_max_body_size 200M;
}
```

Enable site:
```bash
ln -s /etc/nginx/sites-available/rescuestudyguides /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### Step 7: SSL Certificate (Free with Let's Encrypt)
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d rescuestudyguides.com -d www.rescuestudyguides.com
```

---

## 📁 Option 2: Hostinger Shared Hosting (hPanel)

> **Note:** Shared hosting requires Hostinger's Node.js app feature.

### Step 1: Enable Node.js in hPanel
1. Log into hPanel → Advanced → Node.js
2. Create new Node.js app
3. Set: Node.js version = 18.x
4. App URL = your domain
5. App root = /public_html/rescue-study-guides (or your subfolder)
6. Application startup file = app.js

### Step 2: Upload Files
1. Go to hPanel → File Manager
2. Navigate to your app root directory
3. Upload the project files (excluding `node_modules`)
4. OR use FTP/SFTP client like FileZilla

### Step 3: Install Dependencies via SSH
```bash
cd ~/public_html/rescue-study-guides
npm install --production
mkdir -p public/uploads/guides public/uploads/images
```

### Step 4: Set Environment Variables
In hPanel Node.js settings, add these environment variables:
- `NODE_ENV` = `production`
- `SESSION_SECRET` = `your-very-long-random-secret-key`
- `PORT` = `3000` (or Hostinger's assigned port)

### Step 5: Start the App
In hPanel Node.js → click "Restart" or "Start"

---

## 🗄️ Database Management

The app uses SQLite which creates the database automatically.

### Backup Database
```bash
cp ./database/rescuestudyguides.db ./database/rescuestudyguides_backup_$(date +%Y%m%d).db
```

### Reset Database (CAUTION: deletes all data!)
```bash
rm ./database/rescuestudyguides.db
node app.js  # Recreates it with fresh data
```

---

## 🔑 Default Admin Access

After first deployment:
- URL: https://www.rescuestudyguides.com/admin
- Email: admin@rescuestudyguides.com  
- Password: Admin@2024!Rescue
- **⚠️ CHANGE THIS IMMEDIATELY after first login!**

Change via Admin Panel → or update .env:
```
ADMIN_EMAIL=your-email@domain.com
ADMIN_PASSWORD=YourNewSecurePassword
```

---

## 📦 Uploading PDF Study Guides

1. Login to admin panel: `/admin`
2. Click "Add Guide" in sidebar
3. Fill in all product details
4. Upload your PDF file (max 200MB)
5. Upload a cover image (JPG/PNG recommended)
6. Set price, curriculum, level etc.
7. Check "Active" and optionally "Featured"
8. Click Save

PDF files are stored in `public/uploads/guides/` and served securely via `/downloads/file/:token` (requires authentication + ownership check).

---

## 🔒 Security Notes

1. **Change admin password** immediately after deployment
2. **Update SESSION_SECRET** to a long random string (32+ chars)
3. **NGINX blocks** direct access to `/uploads/guides/` (PDFs only via download route)
4. **HTTPS** is enforced in production (secure cookies)
5. **Helmet.js** is active for security headers

---

## 📊 Monitoring

```bash
# View live logs
pm2 logs rescue-study-guides

# View app status
pm2 status

# Restart app
pm2 restart rescue-study-guides

# View error logs
cat ~/.pm2/logs/rescue-study-guides-error.log
```

---

## 🛠️ Common Issues

### App Not Starting
```bash
# Check logs
pm2 logs rescue-study-guides --lines 50
# Check if port 3000 is in use
lsof -i :3000
```

### Database Errors
```bash
# Check if database directory exists and is writable
ls -la database/
chmod 755 database/
chmod 644 database/*.db
```

### Upload Errors
```bash
# Ensure upload directories exist and are writable
mkdir -p public/uploads/guides public/uploads/images
chmod -R 755 public/uploads/
```

---

## 📞 Support
Email: hello@rescuestudyguides.com
