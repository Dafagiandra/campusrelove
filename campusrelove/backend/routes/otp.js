/**
 * otp.js — Endpoint OTP untuk verifikasi nomor HP / email
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SIMULASI — OTP dicetak di console server (tidak dikirim asli)   ║
 * ║                                                                   ║
 * ║  Yang perlu diganti nanti:                                        ║
 * ║  1. sendOTP() → integrasikan dengan provider WA/SMS              ║
 * ║     Pilihan: Twilio, Fonnte, ZenziVa, WA Business API            ║
 * ║  2. Ganti penyimpanan OTP dari memory ke Redis/database           ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
const express = require('express')
const { pool } = require('../database/db')

const router = express.Router()

// [SIMULASI] Simpan OTP di memory (production: pakai Redis/DB dengan TTL)
const otpStore = new Map() // key: `${type}:${target}`, value: { code, expiresAt }

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// [OTP_PROVIDER] Ganti fungsi ini dengan panggilan API provider asli
async function sendOTP(type, target, code) {
  if (type === 'phone') {
    // [OTP_PROVIDER] Kirim via WhatsApp/SMS ke nomor target
    console.log(`\n📱 [SIMULASI OTP] Kirim ke WA/SMS ${target}: Kode OTP kamu adalah ${code} (berlaku 5 menit)\n`)
  } else {
    // [OTP_PROVIDER] Kirim via email ke alamat target
    console.log(`\n📧 [SIMULASI OTP] Kirim ke email ${target}: Kode OTP kamu adalah ${code} (berlaku 5 menit)\n`)
  }
  // [SIMULASI] Di production, return { success: true/false } dari provider
  return { success: true }
}

// ─── POST /api/otp/send ────────────────────────────────────────────────────────
// Kirim OTP ke nomor HP atau email
router.post('/send', async (req, res) => {
  try {
    const { type, target } = req.body // type: 'phone' | 'email'

    if (!type || !target) {
      return res.status(400).json({ success: false, message: 'type dan target wajib diisi' })
    }
    if (!['phone', 'email'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type harus "phone" atau "email"' })
    }

    // Rate limiting sederhana: max 1 OTP per 60 detik
    const key = `${type}:${target}`
    const existing = otpStore.get(key)
    if (existing && existing.expiresAt > Date.now() + 4 * 60 * 1000) {
      return res.status(429).json({
        success: false,
        message: 'Tunggu 60 detik sebelum minta OTP lagi',
      })
    }

    const code = generateOTP()
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 menit

    // Simpan OTP
    otpStore.set(key, { code, expiresAt })

    // Bersihkan otomatis setelah kadaluarsa
    setTimeout(() => otpStore.delete(key), 5 * 60 * 1000)

    // [OTP_PROVIDER] Kirim OTP via provider
    await sendOTP(type, target, code)

    res.json({
      success:  true,
      message:  `Kode OTP telah dikirim ke ${type === 'phone' ? 'WhatsApp/SMS' : 'email'} kamu`,
      // [SIMULASI] Hapus baris ini di production!
      // Ini hanya untuk kemudahan demo/testing
      _dev_code: process.env.NODE_ENV !== 'production' ? code : undefined,
    })
  } catch (err) {
    console.error('OTP send error:', err)
    res.status(500).json({ success: false, message: 'Gagal mengirim OTP' })
  }
})

// ─── POST /api/otp/verify ──────────────────────────────────────────────────────
// Verifikasi kode OTP yang dimasukkan user
router.post('/verify', async (req, res) => {
  try {
    const { type, target, code } = req.body

    if (!type || !target || !code) {
      return res.status(400).json({ success: false, message: 'type, target, dan code wajib diisi' })
    }

    const key = `${type}:${target}`
    const stored = otpStore.get(key)

    if (!stored) {
      return res.status(400).json({ success: false, message: 'OTP tidak ditemukan atau sudah kadaluarsa. Minta OTP baru.' })
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(key)
      return res.status(400).json({ success: false, message: 'OTP sudah kadaluarsa. Minta OTP baru.' })
    }

    if (stored.code !== code.toString().trim()) {
      return res.status(400).json({ success: false, message: 'Kode OTP salah. Periksa kembali.' })
    }

    // OTP valid — hapus dari store
    otpStore.delete(key)

    // Kalau ada user terdaftar dengan target ini, tandai sudah diverifikasi
    if (type === 'phone') {
      await pool.query(
        `UPDATE users SET phone_verified = 1 WHERE phone = ? AND phone_verified = 0`,
        [target]
      ).catch(() => {}) // ignore jika kolom belum ada
    } else {
      await pool.query(
        `UPDATE users SET email_verified = 1 WHERE email = ? AND email_verified = 0`,
        [target]
      ).catch(() => {})
    }

    res.json({ success: true, message: 'OTP berhasil diverifikasi!' })
  } catch (err) {
    console.error('OTP verify error:', err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

module.exports = router
