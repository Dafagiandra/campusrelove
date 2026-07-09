const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })
const express = require('express')
const cors    = require('cors')
const { testConnection } = require('./database/db')

const app  = express()
const PORT = process.env.PORT || 8002

// ── Middleware ────────────────────────────────────────────────────────────────
// CORS: izinkan GitHub Pages + localhost dev + env FRONTEND_URL
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true)
    // Allow any github.io URL (GitHub Pages)
    if (origin.includes('github.io')) return callback(null, true)
    // Allow specific origins
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(null, true) // dev mode: allow all
  },
  credentials: true,
}))

app.use(express.json({ limit: '20mb' }))
app.use(express.urlencoded({ extended: true, limit: '20mb' }))

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'))
app.use('/api/products',   require('./routes/products'))
app.use('/api/orders',     require('./routes/orders'))
app.use('/api/users',      require('./routes/users'))
app.use('/api/listing',    require('./routes/listing'))
app.use('/api/otp',        require('./routes/otp'))
app.use('/api/kyc',        require('./routes/kyc'))
app.use('/api/chat',       require('./routes/chat'))
app.use('/api/withdrawals',require('./routes/withdrawals'))

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    database:  process.env.DB_NAME,
  })
})

// ── Setup admin (protected by secret key) ─────────────────────────────────────
// GET /api/setup-admin?key=YOUR_SETUP_KEY
app.get('/api/setup-admin', async (req, res) => {
  const setupKey = process.env.SETUP_KEY || 'preloved-setup-2024'
  if (req.query.key !== setupKey) {
    return res.status(403).json({ success: false, message: 'Invalid setup key' })
  }
  try {
    const bcrypt = require('bcryptjs')
    const { pool } = require('./database/db')
    const hash = await bcrypt.hash('admin123', 10)
    await pool.query('DELETE FROM users WHERE email IN (?, ?)',
      ['admin@preloved.id', 'admin@campusrelove.id'])
    await pool.query(
      `INSERT INTO users (id, name, email, password, role, verified, verification_status)
       VALUES ('admin-001', 'Admin Preloved', 'admin@preloved.id', ?, 'admin', 1, 'approved')`,
      [hash]
    )
    res.json({ success: true, message: 'Admin reset! Login: admin@preloved.id / admin123' })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── Run migrations (protected) ─────────────────────────────────────────────────
// GET /api/migrate?key=YOUR_SETUP_KEY
app.get('/api/migrate', async (req, res) => {
  const setupKey = process.env.SETUP_KEY || 'preloved-setup-2024'
  if (req.query.key !== setupKey) {
    return res.status(403).json({ success: false, message: 'Invalid setup key' })
  }
  try {
    const { pool } = require('./database/db')

    // Helper: add column only if it doesn't exist (MySQL 5.7 compatible)
    async function addColumnSafe(table, column, definition) {
      try {
        const [cols] = await pool.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [process.env.DB_NAME || 'preloved_db', table, column]
        )
        if (cols.length === 0) {
          await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
          return { ok: true, msg: `Added ${table}.${column}` }
        }
        return { ok: true, msg: `${table}.${column} already exists` }
      } catch (e) {
        return { ok: false, error: e.message, msg: `Failed ${table}.${column}` }
      }
    }

    const columnResults = await Promise.all([
      addColumnSafe('users', 'phone_verified',   'TINYINT(1) NOT NULL DEFAULT 0'),
      addColumnSafe('users', 'email_verified',   'TINYINT(1) NOT NULL DEFAULT 0'),
      addColumnSafe('users', 'kyc_submitted_at', 'DATETIME DEFAULT NULL'),
      addColumnSafe('users', 'kyc_result',       'VARCHAR(100) DEFAULT NULL'),
      addColumnSafe('products', 'listing_expires_at', 'DATETIME DEFAULT NULL'),
      addColumnSafe('products', 'listing_status',     "ENUM('active','expired','pending_payment') DEFAULT 'active'"),
      addColumnSafe('products', 'is_free_listing',    'TINYINT(1) NOT NULL DEFAULT 0'),
      addColumnSafe('orders', 'payment_method', "VARCHAR(50) DEFAULT 'transfer_escrow'"),
      addColumnSafe('conversations', 'last_message_at', 'DATETIME DEFAULT NULL'),
      addColumnSafe('users', 'saved_bank_name',    'VARCHAR(100) DEFAULT NULL'),
      addColumnSafe('users', 'saved_bank_account', 'VARCHAR(50) DEFAULT NULL'),
      addColumnSafe('users', 'saved_bank_owner',   'VARCHAR(100) DEFAULT NULL'),
    ])

    const migrations = [
      `ALTER TABLE admin_wallet MODIFY COLUMN type ENUM('platform_fee','refund','carry_fee','listing_fee') DEFAULT 'platform_fee'`,
      `CREATE TABLE IF NOT EXISTS listing_fees (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        category VARCHAR(50) NOT NULL UNIQUE,
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        duration_days INT NOT NULL DEFAULT 7,
        updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS listing_payments (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        seller_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36),
        category VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status ENUM('pending','paid','free') NOT NULL DEFAULT 'pending',
        notes TEXT,
        created_at DATETIME NOT NULL DEFAULT NOW(),
        paid_at DATETIME
      )`,
      `CREATE TABLE IF NOT EXISTS complaints (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        order_id VARCHAR(36) NOT NULL,
        buyer_id VARCHAR(36) NOT NULL,
        seller_id VARCHAR(36) NOT NULL,
        reason TEXT NOT NULL,
        description TEXT,
        status ENUM('open','resolved_refund','resolved_release') DEFAULT 'open',
        admin_note TEXT,
        resolved_at DATETIME,
        created_at DATETIME NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        seller_id VARCHAR(36) NOT NULL,
        seller_name VARCHAR(100),
        amount DECIMAL(15,2) NOT NULL,
        bank_name VARCHAR(100) NOT NULL,
        account_number VARCHAR(50) NOT NULL,
        account_name VARCHAR(100) NOT NULL,
        name_mismatch TINYINT(1) NOT NULL DEFAULT 0,
        status ENUM('pending','completed','rejected') NOT NULL DEFAULT 'pending',
        admin_note TEXT,
        processed_at DATETIME,
        created_at DATETIME NOT NULL DEFAULT NOW()
      )`,
      `INSERT IGNORE INTO listing_fees (category, price, duration_days) VALUES
        ('fashion',5000,7),('electronic',10000,7),('furniture',10000,7),
        ('hobi',5000,7),('otomotif',15000,7),('buku',3000,7),
        ('olahraga',5000,7),('kesehatan',5000,7),('dapur',5000,7),
        ('bayi',5000,7),('lainnya',3000,7)`,
    ]

    const results = [...columnResults]
    for (const sql of migrations) {
      try {
        await pool.query(sql)
        results.push({ ok: true, sql: sql.slice(0, 60) + '...' })
      } catch (e) {
        results.push({ ok: false, error: e.message, sql: sql.slice(0, 60) + '...' })
      }
    }

    res.json({ success: true, migrations: results })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} tidak ditemukan` })
})

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ success: false, message: 'Internal server error' })
})

// ── Start ─────────────────────────────────────────────────────────────────────
const start = async () => {
  await testConnection()
  app.listen(PORT, () => {
    console.log(`🚀 Backend berjalan di http://localhost:${PORT}`)
    console.log(`📋 API Health: http://localhost:${PORT}/api/health`)
  })
}

start()
