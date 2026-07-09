/**
 * kyc.js — Endpoint KYC (Verifikasi Identitas Penjual)
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SIMULASI — Ganti bagian yang ditandai "// [KYC_PROVIDER]"       ║
 * ║  saat sudah terdaftar ke provider asli (Privy, VIDA, dll.)        ║
 * ║                                                                   ║
 * ║  Yang perlu diganti nanti:                                        ║
 * ║  1. POST /api/kyc/submit → panggil API provider, kirim dokumen   ║
 * ║  2. GET  /api/kyc/status → cek status dari provider              ║
 * ║  3. Webhook dari provider → update status di database            ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
const express  = require('express')
const { pool } = require('../database/db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

// ─── Konstanta durasi simulasi ────────────────────────────────────────────────
// [SIMULASI] Verifikasi otomatis setelah X detik
const KYC_AUTO_APPROVE_SECONDS = 5

// ─── POST /api/kyc/submit ─────────────────────────────────────────────────────
// Penjual upload KTP + selfie untuk verifikasi identitas
// [KYC_PROVIDER] Ganti isi fungsi ini dengan panggilan API provider asli
router.post('/submit', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'seller') {
      return res.status(403).json({ success: false, message: 'Hanya untuk penjual' })
    }

    const { ktpPhoto, selfiePhoto } = req.body
    if (!ktpPhoto || !selfiePhoto) {
      return res.status(400).json({ success: false, message: 'Foto KTP dan selfie wajib diupload' })
    }

    // Simpan dokumen & set status ke 'processing'
    await pool.query(
      `UPDATE users SET
         ktp_photo           = ?,
         selfie_photo        = ?,
         verification_status = 'pending',
         verified            = 0
       WHERE id = ?`,
      [ktpPhoto, selfiePhoto, req.user.id]
    )

    // [SIMULASI] Auto-approve setelah beberapa detik
    // [KYC_PROVIDER] Hapus blok ini dan ganti dengan panggilan API provider
    setTimeout(async () => {
      try {
        await pool.query(
          `UPDATE users SET
             verification_status = 'approved',
             verified            = 1,
             verification_date   = NOW()
           WHERE id = ? AND verification_status = 'pending'`,
          [req.user.id]
        )
        // Kirim notifikasi ke user
        await pool.query(
          `INSERT INTO notifications (recipient_id, type, message)
           VALUES (?, 'kyc_approved', ?)`,
          [req.user.id, '✅ Identitas kamu berhasil diverifikasi! Akun penjual kamu sekarang aktif penuh. Mulai upload barangmu!']
        )
        // Notif ke admin (info saja)
        await pool.query(
          `INSERT INTO notifications (recipient_id, type, message)
           VALUES ('admin-001', 'kyc_info', ?)`,
          [`ℹ️ KYC simulasi selesai untuk user ID ${req.user.id}.`]
        )
      } catch { /* ignore jika user sudah dihapus */ }
    }, KYC_AUTO_APPROVE_SECONDS * 1000)

    res.json({
      success:  true,
      status:   'processing',
      message:  'Dokumen diterima. Verifikasi sedang diproses...',
      // [KYC_PROVIDER] Tambahkan reference_id dari provider di sini
    })
  } catch (err) {
    console.error('KYC submit error:', err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ─── GET /api/kyc/status ──────────────────────────────────────────────────────
// Cek status KYC user yang sedang login
// [KYC_PROVIDER] Tambahkan polling ke provider asli jika diperlukan
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT verification_status, verified, kyc_submitted_at, verification_date, kyc_result
       FROM users WHERE id = ?`,
      [req.user.id]
    )
    if (rows.length === 0) return res.status(404).json({ success: false })

    const u = rows[0]
    res.json({
      success:            true,
      verificationStatus: u.verification_status,
      verified:           Boolean(u.verified),
      submittedAt:        u.kyc_submitted_at,
      verifiedAt:         u.verification_date,
      // [KYC_PROVIDER] Tambahkan data tambahan dari provider di sini
    })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ─── POST /api/kyc/webhook ────────────────────────────────────────────────────
// [KYC_PROVIDER] Endpoint ini dipanggil oleh provider asli saat status berubah
// Saat ini tidak dipakai karena simulasi auto-approve via setTimeout
// Nanti aktifkan dan daftarkan URL ini ke dashboard provider
router.post('/webhook', async (req, res) => {
  // [KYC_PROVIDER] Verifikasi signature dari provider
  // [KYC_PROVIDER] Parse payload, update status di database
  // [KYC_PROVIDER] Kirim notifikasi ke user
  res.json({ received: true })
})

module.exports = router
