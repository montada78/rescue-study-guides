const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './database/rescuestudyguides.db';
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
const initDB = () => {
  db.exec(`
    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'student' CHECK(role IN ('student', 'admin')),
      is_verified INTEGER DEFAULT 0,
      avatar TEXT DEFAULT NULL,
      school TEXT DEFAULT NULL,
      grade_level TEXT DEFAULT NULL,
      country TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME DEFAULT NULL
    );

    -- Categories Table
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      icon TEXT DEFAULT '📚',
      color TEXT DEFAULT '#E63946',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Products (Study Guides) Table
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      short_description TEXT,
      category_id INTEGER,
      price REAL NOT NULL DEFAULT 0,
      original_price REAL DEFAULT NULL,
      subject TEXT NOT NULL,
      level TEXT NOT NULL,
      curriculum TEXT DEFAULT 'General',
      pages INTEGER DEFAULT 0,
      preview_image TEXT DEFAULT NULL,
      cover_image TEXT DEFAULT NULL,
      file_path TEXT DEFAULT NULL,
      file_name TEXT DEFAULT NULL,
      file_size INTEGER DEFAULT 0,
      is_featured INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      is_free INTEGER DEFAULT 0,
      downloads_count INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      tags TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    -- Orders Table
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      total_amount REAL NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'cancelled', 'refunded')),
      payment_method TEXT DEFAULT NULL,
      payment_reference TEXT DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Order Items Table
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      price REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Downloads Table
    CREATE TABLE IF NOT EXISTS downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      order_id INTEGER DEFAULT NULL,
      download_token TEXT UNIQUE NOT NULL,
      download_count INTEGER DEFAULT 0,
      max_downloads INTEGER DEFAULT 5,
      expires_at DATETIME DEFAULT NULL,
      last_downloaded DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Cart Table
    CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Reviews Table
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT,
      is_approved INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Wishlist Table
    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL DEFAULT 'percent' CHECK(type IN ('percent','fixed')),
      value REAL NOT NULL,
      min_order REAL DEFAULT 0,
      max_uses INTEGER DEFAULT NULL,
      uses_count INTEGER DEFAULT 0,
      expires_at DATETIME DEFAULT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_previews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      caption TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);

  console.log('✅ Database tables created/verified');
  seedData();
};

// Seed initial data
const seedData = () => {
  const existingCategories = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (existingCategories.count > 0) return;

  // Insert categories
  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO categories (name, slug, description, icon, color) VALUES (?, ?, ?, ?, ?)
  `);

  const categories = [
    ['Mathematics', 'mathematics', 'Algebra, Calculus, Statistics & more', '🔢', '#E63946'],
    ['Biology', 'biology', 'Cell biology, Genetics, Ecology & more', '🧬', '#2A9D8F'],
    ['Chemistry', 'chemistry', 'Organic, Inorganic, Physical Chemistry', '⚗️', '#E76F51'],
    ['Physics', 'physics', 'Mechanics, Waves, Electricity & more', '⚡', '#457B9D'],
    ['English', 'english', 'Literature, Language, Writing skills', '📖', '#6D4C7D'],
    ['History', 'history', 'World History, Modern History & more', '🏛️', '#C77D52'],
    ['Geography', 'geography', 'Physical & Human Geography', '🌍', '#4CAF50'],
    ['Economics', 'economics', 'Micro & Macro Economics', '📊', '#FF6B6B'],
    ['Computer Science', 'computer-science', 'Programming, Algorithms, Data Structures', '💻', '#1A1A2E'],
    ['All Subjects', 'all', 'Multi-subject revision bundles', '🎓', '#E63946'],
  ];

  categories.forEach(cat => insertCategory.run(...cat));

  // Insert demo products
  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (title, slug, description, short_description, category_id, price, original_price, subject, level, curriculum, pages, is_featured, is_active, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const products = [
    ['IGCSE Mathematics Complete Rescue Guide', 'igcse-maths-complete', 'The ultimate IGCSE Mathematics revision guide covering all topics from Number to Statistics. Color-coded sections, worked examples, cheat sheets and exam tips that rescue your grade!', 'Full coverage IGCSE Maths - Algebra to Stats', 1, 12.99, 19.99, 'Mathematics', 'IGCSE', 'IGCSE Cambridge', 85, 1, 1, 'maths,igcse,algebra,geometry,statistics'],
    ['IGCSE Biology Mega Rescue Pack', 'igcse-biology-mega', 'Complete IGCSE Biology revision with stunning visual diagrams, flashcard summaries and topic-by-topic breakdowns. Perfect for last-minute rescue!', 'Visual biology revision for IGCSE', 2, 11.99, 17.99, 'Biology', 'IGCSE', 'IGCSE Cambridge', 72, 1, 1, 'biology,igcse,cells,genetics'],
    ['AP Chemistry Rescue Guide', 'ap-chemistry-rescue', 'Ace your AP Chemistry exam with this comprehensive rescue guide. Covers all 9 units with color-coded notes, reaction summaries and practice strategies.', 'Complete AP Chemistry revision guide', 3, 14.99, 22.99, 'Chemistry', 'AP', 'AP College Board', 95, 1, 1, 'chemistry,ap,organic,reactions'],
    ['IGCSE Physics Formula Master', 'igcse-physics-formulas', 'All IGCSE Physics formulas, definitions and key concepts in one beautiful visual guide. Stop memorizing, start understanding!', 'Physics formulas and concepts for IGCSE', 4, 9.99, 14.99, 'Physics', 'IGCSE', 'IGCSE Cambridge', 55, 0, 1, 'physics,igcse,formulas,electricity'],
    ['SABIS Mathematics Grade 10 Rescue', 'sabis-maths-grade10', 'Specially designed for SABIS students - Grade 10 Mathematics rescue guide aligned with SABIS curriculum expectations.', 'SABIS-aligned Grade 10 Maths guide', 1, 10.99, 15.99, 'Mathematics', 'Grade 10', 'SABIS', 60, 1, 1, 'maths,sabis,grade10'],
    ['IGCSE English Language Rescue Kit', 'igcse-english-language', 'Master IGCSE English Language with guided reading, writing and speaking strategies. Includes model answers and examiner tips!', 'IGCSE English Language skills pack', 5, 10.99, 16.99, 'English', 'IGCSE', 'IGCSE Cambridge', 68, 0, 1, 'english,igcse,writing,language'],
    ['American Curriculum Chemistry Bundle', 'american-chem-bundle', 'Perfect for American curriculum high school chemistry - covers all core topics with vibrant infographics and study strategies.', 'American curriculum Chemistry complete guide', 3, 13.99, 20.99, 'Chemistry', 'High School', 'American', 80, 1, 1, 'chemistry,american,highschool'],
    ['IGCSE History Cold War Rescue', 'igcse-history-coldwar', 'Rescue your IGCSE History with this focused Cold War revision guide. Timeline, key events, causes & effects all in one place!', 'IGCSE History - Cold War special guide', 6, 8.99, 12.99, 'History', 'IGCSE', 'IGCSE Cambridge', 45, 0, 1, 'history,igcse,coldwar'],
    ['Complete IGCSE Exam Rescue Bundle', 'igcse-complete-bundle', 'The ULTIMATE bundle - includes Maths, Biology, Chemistry, and Physics rescue guides. Best value for full IGCSE preparation!', 'All 4 core IGCSE subjects in one bundle', 10, 39.99, 69.99, 'All Subjects', 'IGCSE', 'IGCSE Cambridge', 320, 1, 1, 'bundle,igcse,maths,biology,chemistry,physics'],
    ['Free Chemistry Basics Starter Guide', 'free-chemistry-basics', 'A FREE introduction to Chemistry basics - atoms, elements, and the periodic table. Get a taste of our Rescue Guides quality!', 'Free chemistry intro - atoms to elements', 3, 0, 0, 'Chemistry', 'Beginner', 'General', 20, 0, 1, 'free,chemistry,basics,atoms'],
  ];

  products.forEach(p => insertProduct.run(...p));

  // Create admin user
  const bcrypt = require('bcryptjs');
  const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Admin@2024!Rescue', 12);
  
  db.prepare(`
    INSERT OR IGNORE INTO users (name, email, password, role, is_verified)
    VALUES (?, ?, ?, 'admin', 1)
  `).run('Admin', process.env.ADMIN_EMAIL || 'admin@rescuestudyguides.com', hashedPassword);

  console.log('✅ Seed data inserted');
};

initDB();

module.exports = db;
