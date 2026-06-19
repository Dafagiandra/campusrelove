/**
 * migrate.js — Jalankan dengan: npm run migrate
 * Membuat semua tabel di database preloved_db
 */
const fs   = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')
require('dotenv').config()

async function migrate() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  })

  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
    console.log('🔄 Running migration...')
    await conn.query(sql)
    console.log('✅ Migration selesai! Semua tabel berhasil dibuat di preloved_db.')
  } catch (err) {
    console.error('❌ Migration error:', err.message)
  } finally {
    await conn.end()
  }
}

migrate()
