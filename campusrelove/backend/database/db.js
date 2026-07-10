const mysql = require('mysql2/promise')
require('dotenv').config()

const isRemote = process.env.DB_HOST && process.env.DB_HOST !== 'localhost'

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT) || 3306,
  database:           process.env.DB_NAME     || 'preloved_db',
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4',
  // SSL wajib untuk koneksi ke database eksternal (Clever Cloud, Railway, dll)
  // Untuk localhost, SSL dinonaktifkan supaya tidak error
  ssl: isRemote ? { rejectUnauthorized: false } : undefined,
})

// Test connection on startup
const testConnection = async () => {
  try {
    const conn = await pool.getConnection()
    console.log('✅ MySQL connected —', isRemote ? `remote: ${process.env.DB_HOST}` : 'localhost')
    console.log('   Database:', process.env.DB_NAME)
    conn.release()
  } catch (err) {
    console.error('❌ MySQL connection error:', err.message)
    if (isRemote) {
      console.error('   Cek kredensial Clever Cloud dan pastikan IP tidak diblokir firewall.')
    } else {
      console.error('   Pastikan Laragon MySQL sudah berjalan dan database sudah dibuat.')
    }
    process.exit(1)
  }
}

module.exports = { pool, testConnection }
