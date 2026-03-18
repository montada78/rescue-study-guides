#!/bin/bash
# =====================================================
# RESCUE STUDY GUIDES — Hostinger Setup Script
# Run this after uploading files to your server
# =====================================================

echo ""
echo "🚑 Rescue Study Guides — Server Setup"
echo "======================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Current: $(node -v)"
    exit 1
fi

echo "✅ Node.js: $(node -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install --production
echo "✅ Dependencies installed"

# Create upload directories
echo ""
echo "📁 Creating upload directories..."
mkdir -p public/uploads/guides
mkdir -p public/uploads/images
chmod -R 755 public/uploads/
echo "✅ Upload directories ready"

# Ensure database directory exists
mkdir -p database
chmod 755 database

# Check .env file
if [ ! -f .env ]; then
    echo ""
    echo "⚠️  .env file not found. Creating default..."
    cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
SESSION_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_STRING_AT_LEAST_32_CHARS
DB_PATH=./database/rescuestudyguides.db
ADMIN_EMAIL=admin@rescuestudyguides.com
ADMIN_PASSWORD=Admin@2024!Rescue
MAX_FILE_SIZE=104857600
UPLOAD_PATH=./public/uploads
APP_NAME=Rescue Study Guides
APP_URL=https://www.rescuestudyguides.com
EOF
    echo "✅ .env created — PLEASE UPDATE IT before going live!"
else
    echo "✅ .env file exists"
fi

# Start the app
echo ""
echo "🚀 Starting app..."
if command -v pm2 &> /dev/null; then
    pm2 start app.js --name "rescue-study-guides" --env production
    pm2 save
    echo "✅ App started with PM2"
    echo ""
    echo "📊 App Status:"
    pm2 status rescue-study-guides
else
    echo "⚠️  PM2 not found. Starting with node..."
    echo "   Run: npm install -g pm2 && pm2 start app.js --name rescue-study-guides"
    NODE_ENV=production node app.js &
    sleep 2
    echo "✅ App started on port 3000"
fi

echo ""
echo "======================================"
echo "🎉 Setup Complete!"
echo ""
echo "🌐 Your site is running at http://localhost:3000"
echo "🔑 Admin login: /admin"
echo "   Email: admin@rescuestudyguides.com"
echo "   Password: Admin@2024!Rescue"
echo ""
echo "⚠️  IMPORTANT: Update these before going live:"
echo "   1. Change SESSION_SECRET in .env"
echo "   2. Change ADMIN_EMAIL and ADMIN_PASSWORD in .env"
echo "   3. Update APP_URL to your domain"
echo "======================================"
