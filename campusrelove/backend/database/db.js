const mysql = require('mysql2/promise')
require('dotenv').config()

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
})

// Test connection on startup
const testConnection = async () => {
  try {
    const conn = await pool.getConnection()
    console.log('✅ MySQL connected — database:', process.env.DB_NAME)
    conn.release()
  } catch (err) {
    console.error('❌ MySQL connection error:', err.message)
    console.error('   Pastikan Laragon MySQL sudah berjalan dan database sudah dibuat.')
    process.exit(1)
  }
}

module.exports = { pool, testConnection }
