/**
 * kyc.js — Frontend KYC Service
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  Layer abstraksi KYC — pisahkan dari AuthPage dan AuthContext    ║
 * ║                                                                   ║
 * ║  Untuk ganti ke provider asli nanti:                             ║
 * ║  1. Ubah submitKYC() agar panggil endpoint backend yang          ║
 * ║     terkoneksi ke API provider (Privy, VIDA, dll.)               ║
 * ║  2. Ubah pollKYCStatus() jika provider punya polling endpoint    ║
 * ║  3. Jangan ubah file lain — hanya file ini yang perlu diganti    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const BASE_URL = import.meta.env.VITE_API_URL || ''

function getToken() {
  return localStorage.getItem('cr_token') || ''
}

/**
 * Kirim dokumen KYC (KTP + selfie) ke backend / provider
 * @param {string} ktpPhoto   - base64 foto KTP
 * @param {string} selfiePhoto - base64 foto selfie
 * @returns {{ success: boolean, status: string, message: string }}
 */
export async function submitKYC(ktpPhoto, selfiePhoto) {
  if (!BASE_URL) {
    // ── [SIMULASI offline] ─────────────────────────────────────────
    // Tidak ada backend: auto-approve setelah 5 detik
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, status: 'processing', message: 'Verifikasi sedang diproses...' })
      }, 300)
    })
  }

  const res = await fetch(`${BASE_URL}/kyc/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ ktpPhoto, selfiePhoto }),
  })
  return res.json()
}

/**
 * Cek status KYC user saat ini
 * @returns {{ success: boolean, verificationStatus: string, verified: boolean }}
 */
export async function getKYCStatus() {
  if (!BASE_URL) {
    // [SIMULASI offline] Kembalikan data dari localStorage
    const session = JSON.parse(localStorage.getItem('cr_session') || 'null')
    return {
      success: true,
      verificationStatus: session?.verificationStatus || 'pending',
      verified: Boolean(session?.verified),
    }
  }

  const res = await fetch(`${BASE_URL}/kyc/status`, {
    headers: { 'Authorization': `Bearer ${getToken()}` },
  })
  return res.json()
}

/**
 * Kirim OTP ke nomor HP atau email
 * @param {'phone'|'email'} type
 * @param {string} target - nomor HP atau alamat email
 * @returns {{ success: boolean, message: string, _dev_code?: string }}
 */
export async function sendOTP(type, target) {
  if (!BASE_URL) {
    // [SIMULASI offline] OTP = 123456
    console.log(`[SIMULASI OTP] Kode OTP untuk ${target}: 123456`)
    return { success: true, message: `Kode OTP dikirim ke ${target}`, _dev_code: '123456' }
  }

  const res = await fetch(`${BASE_URL}/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, target }),
  })
  return res.json()
}

/**
 * Verifikasi kode OTP
 * @param {'phone'|'email'} type
 * @param {string} target
 * @param {string} code
 * @returns {{ success: boolean, message: string }}
 */
export async function verifyOTP(type, target, code) {
  if (!BASE_URL) {
    // [SIMULASI offline] Terima kode apapun yang 6 digit
    if (code === '123456' || code.length === 6) {
      return { success: true, message: 'OTP berhasil diverifikasi!' }
    }
    return { success: false, message: 'Kode OTP salah. Gunakan 123456 untuk demo.' }
  }

  const res = await fetch(`${BASE_URL}/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, target, code }),
  })
  return res.json()
}
