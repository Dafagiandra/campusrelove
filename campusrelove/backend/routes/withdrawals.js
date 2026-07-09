const express  = require('express')
const { pool } = require('../database/db')
const { authMiddleware, adminOnly } = require('../middleware/auth')

const router = express.Router()

const MIN_WITHDRAWAL = 50000  // Rp 50.000 minimum

// ── GET /api/withdrawals/my — riwayat penarikan milik penjual ─────────────────
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM withdrawal_requests WHERE seller_id = ? ORDER BY created_at DESC',
      [req.user.id]
    )
    // Cek apakah ada penarikan yang sedang pending
    const hasPending = rows.some(r => r.status === 'pending')

    // Ambil data rekening tersimpan milik seller
    const [[seller]] = await pool.query(
      'SELECT balance, saved_bank_name, saved_bank_account, saved_bank_owner FROM users WHERE id = ?',
      [req.user.id]
    )

    res.json({
      success: true,
      withdrawals: rows,
      hasPending,
      balance: Number(seller.balance) || 0,
      savedBank: seller.saved_bank_name
        ? { bankName: seller.saved_bank_name, accountNumber: seller.saved_bank_account, accountName: seller.saved_bank_owner }
        : null,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── POST /api/withdrawals — ajukan penarikan saldo ───────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'seller') {
      return res.status(403).json({ success: false, message: 'Hanya penjual yang bisa menarik saldo' })
    }

    const { amount, bankName, accountNumber, accountName, saveBank } = req.body

    if (!amount || !bankName || !accountNumber || !accountName) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi' })
    }

    const withdrawAmount = Number(amount)
    if (withdrawAmount < MIN_WITHDRAWAL) {
      return res.status(400).json({ success: false, message: `Nominal minimum penarikan adalah Rp ${MIN_WITHDRAWAL.toLocaleString('id-ID')}` })
    }

    // Cek saldo cukup
    const [[seller]] = await pool.query(
      'SELECT balance, name FROM users WHERE id = ?',
      [req.user.id]
    )
    if (Number(seller.balance) < withdrawAmount) {
      return res.status(400).json({ success: false, message: 'Saldo tidak mencukupi' })
    }

    // Cek sudah ada penarikan pending
    const [[{ pendingCount }]] = await pool.query(
      "SELECT COUNT(*) as pendingCount FROM withdrawal_requests WHERE seller_id = ? AND status = 'pending'",
      [req.user.id]
    )
    if (Number(pendingCount) > 0) {
      return res.status(409).json({ success: false, message: 'Masih ada pengajuan penarikan yang sedang diproses. Tunggu sampai selesai sebelum mengajukan lagi.' })
    }

    // Cek nama rekening vs nama akun (untuk peringatan admin)
    const nameMismatch = accountName.toLowerCase().trim() !== seller.name.toLowerCase().trim() ? 1 : 0

    // Kurangi saldo sementara (reserved for withdrawal)
    await pool.query(
      'UPDATE users SET balance = balance - ? WHERE id = ?',
      [withdrawAmount, req.user.id]
    )

    // Simpan pengajuan — generate UUID dulu supaya bisa di-query balik
    const newId = require('crypto').randomUUID()
    await pool.query(
      `INSERT INTO withdrawal_requests
        (id, seller_id, seller_name, amount, bank_name, account_number, account_name, name_mismatch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, req.user.id, seller.name, withdrawAmount, bankName, accountNumber, accountName, nameMismatch]
    )

    // Simpan rekening ke profil seller jika diminta
    if (saveBank) {
      await pool.query(
        'UPDATE users SET saved_bank_name = ?, saved_bank_account = ?, saved_bank_owner = ? WHERE id = ?',
        [bankName, accountNumber, accountName, req.user.id]
      )
    }

    // Notif ke admin
    await pool.query(
      `INSERT INTO notifications (recipient_id, type, message)
       VALUES ('admin-001', 'withdrawal', ?)`,
      [`💸 Pengajuan penarikan saldo baru dari ${seller.name}: Rp ${withdrawAmount.toLocaleString('id-ID')} ke ${bankName} ${accountNumber}${nameMismatch ? ' ⚠️ NAMA BERBEDA' : ''}`]
    )

    // Notif ke penjual
    await pool.query(
      `INSERT INTO notifications (recipient_id, type, message)
       VALUES (?, 'withdrawal', ?)`,
      [req.user.id, `⏳ Pengajuan penarikan Rp ${withdrawAmount.toLocaleString('id-ID')} ke ${bankName} ${accountNumber} sedang diproses admin.`]
    )

    const [[newRequest]] = await pool.query('SELECT * FROM withdrawal_requests WHERE id = ?', [newId])
    res.status(201).json({ success: true, withdrawal: newRequest })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── GET /api/withdrawals/all — semua pengajuan (admin only) ──────────────────
router.get('/all', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT wr.*, u.email as seller_email, u.balance as seller_current_balance
       FROM withdrawal_requests wr
       JOIN users u ON wr.seller_id = u.id
       ORDER BY wr.created_at DESC`
    )
    res.json({ success: true, withdrawals: rows })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── PUT /api/withdrawals/:id/complete — admin tandai sudah ditransfer ─────────
router.put('/:id/complete', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [[wr]] = await pool.query('SELECT * FROM withdrawal_requests WHERE id = ?', [req.params.id])
    if (!wr) return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' })
    if (wr.status !== 'pending') return res.status(400).json({ success: false, message: 'Pengajuan sudah diproses sebelumnya' })

    // Tandai selesai — saldo sudah dikurangi saat pengajuan, tidak perlu kurangi lagi
    await pool.query(
      "UPDATE withdrawal_requests SET status = 'completed', processed_at = NOW() WHERE id = ?",
      [req.params.id]
    )

    // Notif ke penjual
    await pool.query(
      `INSERT INTO notifications (recipient_id, type, message)
       VALUES (?, 'withdrawal', ?)`,
      [wr.seller_id, `✅ Penarikan saldo Rp ${Number(wr.amount).toLocaleString('id-ID')} ke ${wr.bank_name} ${wr.account_number} sudah berhasil ditransfer oleh admin!`]
    )

    res.json({ success: true, message: 'Penarikan ditandai selesai' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── PUT /api/withdrawals/:id/reject — admin tolak pengajuan ─────────────────
router.put('/:id/reject', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { reason } = req.body
    if (!reason) return res.status(400).json({ success: false, message: 'Alasan penolakan wajib diisi' })

    const [[wr]] = await pool.query('SELECT * FROM withdrawal_requests WHERE id = ?', [req.params.id])
    if (!wr) return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' })
    if (wr.status !== 'pending') return res.status(400).json({ success: false, message: 'Pengajuan sudah diproses sebelumnya' })

    // Tandai ditolak
    await pool.query(
      "UPDATE withdrawal_requests SET status = 'rejected', admin_note = ?, processed_at = NOW() WHERE id = ?",
      [reason, req.params.id]
    )

    // Kembalikan saldo ke penjual (saldo sudah dikurangi saat pengajuan)
    await pool.query(
      'UPDATE users SET balance = balance + ? WHERE id = ?',
      [wr.amount, wr.seller_id]
    )

    // Notif ke penjual
    await pool.query(
      `INSERT INTO notifications (recipient_id, type, message)
       VALUES (?, 'withdrawal', ?)`,
      [wr.seller_id, `❌ Pengajuan penarikan Rp ${Number(wr.amount).toLocaleString('id-ID')} ditolak. Alasan: ${reason}. Saldo sudah dikembalikan ke akunmu.`]
    )

    res.json({ success: true, message: 'Pengajuan ditolak dan saldo dikembalikan' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

module.exports = router
