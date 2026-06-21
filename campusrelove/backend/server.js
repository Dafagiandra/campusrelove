require('dotenv').config()
const express = require('express')
const cors    = require('cors')
const { testConnection } = require('./database/db')

const app  = express()
const PORT = process.env.PORT || 8000

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '20mb' }))   // 20MB untuk base64 foto KTP
app.use(express.urlencoded({ extended: true, limit: '20mb' }))

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'))
app.use('/api/products', require('./routes/products'))
app.use('/api/orders',   require('./routes/orders'))
app.use('/api/users',    require('./routes/users'))

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    database:  process.env.DB_NAME,
  })
})

// ── Dev utility: reset admin password ────────────────────────────────────────
// Akses sekali: GET /api/setup-admin → set admin@preloved.id password = admin123
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/setup-admin', async (req, res) => {
    try {
      const bcrypt = require('bcryptjs')
      const { pool } = require('./database/db')
      const hash = await bcrypt.hash('admin123', 10)

      // Hapus admin lama kalau ada, buat ulang dengan hash baru
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
}

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
