/**
 * chat.js — Endpoint chat antara buyer dan seller
 * Pesan disimpan di database MySQL sehingga bisa diakses dari device berbeda.
 */
const express  = require('express')
const { pool } = require('../database/db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

// ── GET /api/chat/conversations ───────────────────────────────────────────────
// Ambil semua percakapan milik user yang login (buyer atau seller)
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const [rows] = await pool.query(
      `SELECT c.*,
              ub.name as buyer_name,  ub.avatar as buyer_avatar,
              us.name as seller_name, us.avatar as seller_avatar,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != ? AND m.is_read = 0) as unread_count,
              (SELECT m2.text FROM messages m2 WHERE m2.conversation_id = c.id ORDER BY m2.sent_at DESC LIMIT 1) as last_message,
              (SELECT m2.sent_at FROM messages m2 WHERE m2.conversation_id = c.id ORDER BY m2.sent_at DESC LIMIT 1) as last_message_at
       FROM conversations c
       LEFT JOIN users ub ON c.buyer_id  = ub.id
       LEFT JOIN users us ON c.seller_id = us.id
       WHERE c.buyer_id = ? OR c.seller_id = ?
       ORDER BY last_message_at DESC, c.created_at DESC`,
      [userId, userId, userId]
    )
    res.json({ success: true, conversations: rows })
  } catch (err) {
    console.error('Get conversations error:', err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── POST /api/chat/conversations ──────────────────────────────────────────────
// Buat atau ambil percakapan antara buyer dan seller untuk produk tertentu
router.post('/conversations', authMiddleware, async (req, res) => {
  try {
    const { buyerId, sellerId, productId, productTitle } = req.body
    const requesterId = req.user.id

    // Pastikan user yang request adalah buyer atau seller
    if (requesterId !== buyerId && requesterId !== sellerId) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' })
    }

    // Cek apakah sudah ada percakapan
    const [existing] = await pool.query(
      'SELECT * FROM conversations WHERE buyer_id = ? AND seller_id = ? AND product_id = ?',
      [buyerId, sellerId, productId]
    )

    if (existing.length > 0) {
      return res.json({ success: true, conversation: existing[0], isNew: false })
    }

    // Buat percakapan baru
    await pool.query(
      'INSERT INTO conversations (buyer_id, seller_id, product_id, product_title) VALUES (?, ?, ?, ?)',
      [buyerId, sellerId, productId, productTitle || 'Produk']
    )

    const [[conv]] = await pool.query('SELECT * FROM conversations WHERE id = LAST_INSERT_ID()')

    // Pesan sistem pertama
    await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, text, is_read)
       VALUES (?, 'system', ?, 1)`,
      [conv.id, `💬 Percakapan dimulai untuk produk "${productTitle || 'Produk'}"`]
    )

    res.status(201).json({ success: true, conversation: conv, isNew: true })
  } catch (err) {
    console.error('Create conversation error:', err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── GET /api/chat/conversations/:id/messages ──────────────────────────────────
// Ambil semua pesan dalam satu percakapan
router.get('/conversations/:id/messages', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const convId = req.params.id

    // Pastikan user adalah bagian dari percakapan ini
    const [[conv]] = await pool.query('SELECT * FROM conversations WHERE id = ?', [convId])
    if (!conv) return res.status(404).json({ success: false, message: 'Percakapan tidak ditemukan' })
    if (conv.buyer_id !== userId && conv.seller_id !== userId) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' })
    }

    // Ambil semua pesan
    const [messages] = await pool.query(
      `SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ?
       ORDER BY m.sent_at ASC`,
      [convId]
    )

    // Tandai pesan dari lawan bicara sebagai sudah dibaca
    await pool.query(
      'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ?',
      [convId, userId]
    )

    res.json({ success: true, messages, conversation: conv })
  } catch (err) {
    console.error('Get messages error:', err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── POST /api/chat/conversations/:id/messages ─────────────────────────────────
// Kirim pesan baru
router.post('/conversations/:id/messages', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const convId = req.params.id
    const { text } = req.body

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Pesan tidak boleh kosong' })
    }

    // Pastikan user adalah bagian dari percakapan
    const [[conv]] = await pool.query('SELECT * FROM conversations WHERE id = ?', [convId])
    if (!conv) return res.status(404).json({ success: false, message: 'Percakapan tidak ditemukan' })
    if (conv.buyer_id !== userId && conv.seller_id !== userId) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' })
    }

    // Simpan pesan
    await pool.query(
      'INSERT INTO messages (conversation_id, sender_id, text) VALUES (?, ?, ?)',
      [convId, userId, text.trim()]
    )

    // Update last_message_at di conversations
    await pool.query(
      'UPDATE conversations SET last_message_at = NOW() WHERE id = ?',
      [convId]
    )

    const [[msg]] = await pool.query('SELECT * FROM messages WHERE id = LAST_INSERT_ID()')

    res.status(201).json({ success: true, message: msg })
  } catch (err) {
    console.error('Send message error:', err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── GET /api/chat/unread-count ─────────────────────────────────────────────────
// Hitung total pesan belum dibaca oleh user yang login
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const [[result]] = await pool.query(
      `SELECT COUNT(*) as count FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE (c.buyer_id = ? OR c.seller_id = ?)
         AND m.sender_id != ?
         AND m.is_read = 0`,
      [req.user.id, req.user.id, req.user.id]
    )
    res.json({ success: true, count: result.count })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── POST /api/chat/system-message ─────────────────────────────────────────────
// Kirim pesan sistem (dipakai internal saat order dibuat, dll)
router.post('/system-message', authMiddleware, async (req, res) => {
  try {
    const { conversationId, text } = req.body
    if (!conversationId || !text) {
      return res.status(400).json({ success: false, message: 'conversationId dan text wajib ada' })
    }
    await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, text, is_read)
       VALUES (?, 'system', ?, 1)`,
      [conversationId, text]
    )
    await pool.query(
      'UPDATE conversations SET last_message_at = NOW() WHERE id = ?',
      [conversationId]
    )
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

module.exports = router
