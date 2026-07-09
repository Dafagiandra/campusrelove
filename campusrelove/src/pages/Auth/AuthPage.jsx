import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { sendOTP, verifyOTP, submitKYC, getKYCStatus } from '../../services/kyc'
import styles from './AuthPage.module.css'

// ─── Global Verification Banner ──────────────────────────────────────────────
export function VerificationBanner() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)
  if (!user || user.role === 'admin') return null
  if (user.verificationStatus === 'approved') return null
  if (user.verificationStatus !== 'rejected') return null
  if (dismissed) return null
  return (
    <div className={styles.verifBanner}>
      <div className={styles.verifBannerIcon}>⚠️</div>
      <div className={styles.verifBannerBody}>
        <strong>Verifikasi Identitas Ditolak</strong>
        <p>{user.rejectionNote ? `Alasan: ${user.rejectionNote}` : 'Foto identitas tidak memenuhi syarat.'}{' '}Fitur jual terkunci sampai verifikasi ulang.</p>
      </div>
      <button className={styles.verifBannerBtn} onClick={() => navigate('/auth', { state: { mode: 'reverify' } })}>🔄 Upload Ulang</button>
      <button className={styles.verifBannerClose} onClick={() => setDismissed(true)}>✕</button>
    </div>
  )
}

export function useVerificationGuard() {
  const { user } = useAuth()
  return {
    isRejected: user?.verificationStatus === 'rejected',
    isPending:  user?.verificationStatus === 'pending' && !user?.verified,
    isVerified: user?.verificationStatus === 'approved' || user?.verified,
  }
}

// ─── Login Form ───────────────────────────────────────────────────────────────
function LoginForm({ onSwitch }) {
  const { login, loading, error, setError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const handleChange = e => { setError(''); setForm({ ...form, [e.target.name]: e.target.value }) }
  const handleSubmit = async e => {
    e.preventDefault()
    const result = await login(form.email, form.password)
    if (result.success) navigate(result.role === 'admin' ? '/admin' : from)
  }
  return (
    <div className={styles.formCard}>
      <div className={styles.formHeader}>
        <div className={styles.formIcon}>🔐</div>
        <h2>Masuk ke Preloved</h2>
        <p>Selamat datang kembali!</p>
      </div>
      <div className={styles.demoHint}><strong>🔑 Demo Admin:</strong> admin@preloved.id / admin123</div>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label>📧 Email</label>
          <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="email@contoh.com" required autoComplete="email" />
        </div>
        <div className={styles.field}>
          <label>🔒 Password</label>
          <div className={styles.passwordWrapper}>
            <input type={showPass ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} placeholder="Masukkan password" required autoComplete="current-password" />
            <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(!showPass)}>{showPass ? '🙈' : '👁️'}</button>
          </div>
        </div>
        {error && <div className={styles.errorMsg}>⚠️ {error}</div>}
        <button type="submit" className={styles.submitBtn} disabled={loading}>{loading ? '⏳ Memproses...' : '🚀 Masuk'}</button>
      </form>
      <div className={styles.switchText}>
        Belum punya akun?{' '}
        <button onClick={() => onSwitch('register')} className={styles.switchBtn}>Daftar sekarang</button>
      </div>
    </div>
  )
}

// ─── Face Capture ─────────────────────────────────────────────────────────────
function FaceCapture({ onCapture, captured }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [streaming, setStreaming] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)

  const startCamera = useCallback(async () => {
    setCameraError(''); setVideoReady(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().then(() => { setStreaming(true); setVideoReady(true) }).catch(() => { setStreaming(true); setVideoReady(true) })
        }
      }
    } catch { setCameraError('Tidak bisa akses kamera. Gunakan Upload Foto.') }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (videoRef.current) videoRef.current.srcObject = null
    setStreaming(false); setVideoReady(false)
  }, [])

  const takePhoto = useCallback(() => {
    const video = videoRef.current; const canvas = canvasRef.current; if (!video || !canvas) return
    const w = video.videoWidth || 640; const h = video.videoHeight || 480
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d'); ctx.translate(w, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0, w, h)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    stopCamera(); setVerifying(true)
    setTimeout(() => { setVerifying(false); setVerified(true); onCapture(dataUrl) }, 2000)
  }, [stopCamera, onCapture])

  const handleFileUpload = e => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setVerifying(true); setTimeout(() => { setVerifying(false); setVerified(true); onCapture(ev.target.result) }, 2000) }
    reader.readAsDataURL(file)
  }

  if (verifying) return (
    <div className={styles.faceVerifying}>
      <div className={styles.faceVerifySpinner}>🔍</div>
      <p>Memverifikasi wajah...</p>
      <div className={styles.verifyBar}><div className={styles.verifyBarFill}></div></div>
    </div>
  )

  if (verified && captured) return (
    <div className={styles.faceVerified}>
      <div className={styles.faceVerifiedCheck}>✅</div>
      <img src={captured} alt="Selfie" className={styles.selfiePreview} />
      <p className={styles.faceVerifiedText}>Wajah berhasil diverifikasi!</p>
      <button type="button" className={styles.retakeBtn} onClick={() => { setVerified(false); onCapture(null) }}>🔄 Ambil Ulang</button>
    </div>
  )

  return (
    <div className={styles.faceCapture}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {!streaming ? (
        <div className={styles.faceCaptureIdle}>
          <div className={styles.faceIcon}>🤳</div>
          <p>Ambil foto selfie untuk verifikasi wajah</p>
          <div className={styles.faceBtns}>
            <button type="button" className={styles.btnCamera} onClick={startCamera}>📷 Buka Kamera</button>
            <label className={styles.btnUploadSelfie}>📁 Upload Foto<input type="file" accept="image/*" capture="user" onChange={handleFileUpload} style={{ display: 'none' }} /></label>
          </div>
          {cameraError && <p className={styles.cameraError}>{cameraError}</p>}
        </div>
      ) : (
        <div className={styles.cameraActive}>
          <video ref={videoRef} className={styles.cameraVideo} autoPlay playsInline muted />
          <div className={styles.cameraOverlay}><div className={styles.faceGuide}></div></div>
          <div className={styles.cameraActions}>
            <button type="button" className={styles.btnCapture} onClick={takePhoto} disabled={!videoReady}>
              {videoReady ? '📸 Ambil Foto' : '⏳ Memuat...'}
            </button>
            <button type="button" className={styles.btnCancelCamera} onClick={stopCamera}>✕ Batal</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── OTP Step ─────────────────────────────────────────────────────────────────
function OTPStep({ phone, email, onVerified, onBack }) {
  const [otpMethod, setOtpMethod] = useState(phone ? 'phone' : 'email')
  const [codeSent, setCodeSent]   = useState(false)
  const [devCode, setDevCode]     = useState('')
  const [code, setCode]           = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const target = otpMethod === 'phone' ? phone : email

  const handleSend = async () => {
    if (!target) { setError(`${otpMethod === 'phone' ? 'Nomor HP' : 'Email'} tidak tersedia`); return }
    setLoading(true); setError('')
    try {
      const res = await sendOTP(otpMethod, target)
      if (res.success) { setCodeSent(true); setCountdown(60); if (res._dev_code) setDevCode(res._dev_code) }
      else setError(res.message || 'Gagal mengirim OTP')
    } catch { setError('Tidak dapat terhubung. Coba lagi.') }
    setLoading(false)
  }

  const handleVerify = async () => {
    if (code.length !== 6) { setError('Masukkan 6 digit kode OTP'); return }
    setLoading(true); setError('')
    try {
      const res = await verifyOTP(otpMethod, target, code)
      if (res.success) onVerified()
      else setError(res.message || 'Kode OTP salah')
    } catch { setError('Gagal verifikasi. Coba lagi.') }
    setLoading(false)
  }

  return (
    <div>
      <div className={styles.formHeader} style={{ marginBottom: 20 }}>
        <div className={styles.formIcon}>📱</div>
        <h2>Verifikasi {otpMethod === 'phone' ? 'WhatsApp/SMS' : 'Email'}</h2>
        <p>Kami kirim kode 6 digit ke {target}</p>
      </div>
      {phone && email && (
        <div className={styles.roleSelector} style={{ marginBottom: 20 }}>
          <button type="button" className={`${styles.roleBtn} ${otpMethod === 'phone' ? styles.roleBtnActive : ''}`}
            onClick={() => { setOtpMethod('phone'); setCodeSent(false); setCode(''); setError('') }}>📱 WA/SMS</button>
          <button type="button" className={`${styles.roleBtn} ${otpMethod === 'email' ? styles.roleBtnActive : ''}`}
            onClick={() => { setOtpMethod('email'); setCodeSent(false); setCode(''); setError('') }}>📧 Email</button>
        </div>
      )}
      {!codeSent ? (
        <div>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 20, fontSize: '0.85rem', color: '#374151' }}>
            Kode OTP dikirim ke:<br/><strong>{target}</strong>
          </div>
          {error && <div className={styles.errorMsg} style={{ marginBottom: 12 }}>⚠️ {error}</div>}
          <button className={styles.submitBtn} onClick={handleSend} disabled={loading}>
            {loading ? '⏳ Mengirim...' : `📤 Kirim Kode ke ${otpMethod === 'phone' ? 'WA/SMS' : 'Email'}`}
          </button>
        </div>
      ) : (
        <div>
          {devCode && (
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: '0.8rem', color: '#92400e', textAlign: 'center' }}>
              🧪 <strong>Demo:</strong> Kode OTP kamu adalah <strong style={{ fontSize: '1.1rem', letterSpacing: 2 }}>{devCode}</strong>
            </div>
          )}
          <div className={styles.field} style={{ marginBottom: 16 }}>
            <label>Masukkan Kode OTP (6 digit)</label>
            <input type="text" inputMode="numeric" maxLength={6} value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••" style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: 8, fontWeight: 700 }} autoFocus />
          </div>
          {error && <div className={styles.errorMsg} style={{ marginBottom: 12 }}>⚠️ {error}</div>}
          <button className={styles.submitBtn} onClick={handleVerify} disabled={loading || code.length !== 6} style={{ marginBottom: 12 }}>
            {loading ? '⏳ Memverifikasi...' : '✅ Verifikasi Kode'}
          </button>
          <div style={{ textAlign: 'center', fontSize: '0.82rem', color: '#6b7280' }}>
            {countdown > 0 ? `Kirim ulang dalam ${countdown} detik` :
              <button onClick={handleSend} style={{ background: 'none', border: 'none', color: '#7C3AED', cursor: 'pointer', fontFamily: 'Poppins,sans-serif', fontSize: '0.82rem', fontWeight: 600 }}>🔄 Kirim Ulang</button>}
          </div>
        </div>
      )}
      <button type="button" className={styles.submitBtnOutline} onClick={onBack} style={{ marginTop: 14, width: '100%' }}>← Kembali</button>
    </div>
  )
}

// ─── KYC Step (Penjual — Simulasi, siap swap ke provider asli) ───────────────
function KYCStep({ onDone }) {
  const { updateProfile } = useAuth()
  const [kycStep, setKycStep]       = useState(1) // 1=ktp, 2=selfie, 3=processing, 4=done
  const [ktpPreview, setKtpPreview] = useState(null)
  const [selfieData, setSelfieData] = useState(null)
  const [error, setError]           = useState('')
  const [progress, setProgress]     = useState(0)

  const handleKtpChange = e => {
    const f = e.target.files[0]; if (!f) return
    const reader = new FileReader(); reader.onload = ev => setKtpPreview(ev.target.result); reader.readAsDataURL(f)
  }

  const handleSubmitKYC = async () => {
    setKycStep(3); setProgress(0)
    const interval = setInterval(() => setProgress(p => Math.min(p + 12, 90)), 400)
    try {
      await submitKYC(ktpPreview, selfieData)
      // Poll status
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        const status = await getKYCStatus()
        if (status.verified || status.verificationStatus === 'approved' || attempts >= 8) {
          clearInterval(poll); clearInterval(interval); setProgress(100)
          await updateProfile({ verified: true, verificationStatus: 'approved' })
          setTimeout(() => setKycStep(4), 500)
        }
      }, 2000)
    } catch {
      clearInterval(interval); setError('Tidak dapat terhubung. Coba lagi.'); setKycStep(2)
    }
  }

  if (kycStep === 4) return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
      <h3 style={{ color: '#065f46', marginBottom: 8 }}>Identitas Terverifikasi!</h3>
      <p style={{ fontSize: '0.88rem', color: '#6b7280', marginBottom: 16 }}>Akun penjual kamu sekarang aktif penuh.</p>

      {/* Info kuota gratis — ditampilkan langsung saat verifikasi selesai */}
      <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #bbf7d0', borderRadius: 14, padding: '16px 18px', marginBottom: 20, textAlign: 'left' }}>
        <div style={{ fontWeight: 700, color: '#065f46', fontSize: '0.95rem', marginBottom: 8 }}>🎁 Selamat! Kamu dapat 1 upload GRATIS</div>
        <div style={{ fontSize: '0.82rem', color: '#047857', lineHeight: 1.6 }}>
          Sebagai penjual baru, kamu mendapat <strong>1 kali upload listing gratis</strong> dengan masa tayang <strong>7 hari</strong>.<br/><br/>
          Setelah jatah gratis digunakan atau masa tayang habis, kamu perlu membayar <strong>biaya listing</strong> sesuai kategori barang untuk upload/perpanjang listing berikutnya.<br/><br/>
          💡 Biaya listing bisa dilihat di Dashboard Penjual.
        </div>
      </div>

      <button className={styles.submitBtn} onClick={onDone}>🚀 Mulai Upload Barang</button>
    </div>
  )

  if (kycStep === 3) return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔍</div>
      <h3 style={{ marginBottom: 8 }}>Memverifikasi Identitas...</h3>
      <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 20 }}>Mohon tunggu, sistem sedang memeriksa dokumenmu</p>
      <div style={{ background: '#e5e7eb', borderRadius: 99, height: 8, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ height: '100%', background: 'linear-gradient(90deg,#7C3AED,#2563EB)', borderRadius: 99, width: `${progress}%`, transition: 'width 0.4s ease' }} />
      </div>
      <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{progress < 40 ? 'Mengirim dokumen...' : progress < 80 ? 'Memeriksa keaslian...' : 'Menyelesaikan verifikasi...'}</p>
    </div>
  )

  return (
    <div>
      <div className={styles.formHeader} style={{ marginBottom: 20 }}>
        <div className={styles.formIcon}>{kycStep === 1 ? '🪪' : '🤳'}</div>
        <h2>{kycStep === 1 ? 'Foto Identitas (KTP/SIM)' : 'Foto Selfie'}</h2>
        <p>{kycStep === 1 ? 'Upload foto KTP atau SIM yang masih berlaku' : 'Ambil foto selfie untuk kecocokan wajah'}</p>
      </div>
      <div className={styles.stepBar} style={{ marginBottom: 24 }}>
        {['Foto KTP', 'Selfie'].map((label, i) => (
          <div key={i} className={`${styles.stepItem} ${kycStep > i+1 ? styles.stepDone : kycStep === i+1 ? styles.stepActive : ''}`}>
            <div className={styles.stepCircle}>{kycStep > i+1 ? '✓' : i+1}</div>
            <span className={styles.stepLabel}>{label}</span>
            {i < 1 && <div className={`${styles.stepLine} ${kycStep > i+1 ? styles.stepLineDone : ''}`} />}
          </div>
        ))}
      </div>
      {kycStep === 1 && (
        <>
          <div className={styles.ktmUploadArea} onClick={() => document.getElementById('kyc-ktp').click()}>
            {ktpPreview ? <img src={ktpPreview} alt="KTP" className={styles.ktmPreviewImg} />
              : <><div className={styles.ktmUploadIcon}>🪪</div><p>Klik untuk upload foto KTP / SIM / Paspor</p><span>JPG · PNG · Maks 5MB · Pastikan terbaca jelas</span></>}
          </div>
          <input id="kyc-ktp" type="file" accept="image/*" onChange={handleKtpChange} style={{ display: 'none' }} />
          <div className={styles.ktmTips}>✅ Foto jelas &amp; tidak buram &nbsp;·&nbsp; ✅ Semua teks terbaca &nbsp;·&nbsp; ✅ Tidak terpotong</div>
          <div className={styles.infoBox}>🔒 Foto KTP hanya digunakan untuk verifikasi identitas sesuai kebijakan privasi.</div>
          {error && <div className={styles.errorMsg}>⚠️ {error}</div>}
          <button className={styles.submitBtn} disabled={!ktpPreview} onClick={() => { setError(''); setKycStep(2) }}>→ Lanjut Foto Selfie</button>
        </>
      )}
      {kycStep === 2 && (
        <>
          <div className={styles.faceInstructions}>
            <div className={styles.faceInstructionItem}>💡 Wajah terlihat jelas</div>
            <div className={styles.faceInstructionItem}>☀️ Pencahayaan cukup</div>
            <div className={styles.faceInstructionItem}>😐 Tatap kamera langsung</div>
          </div>
          <FaceCapture onCapture={setSelfieData} captured={selfieData} />
          {error && <div className={styles.errorMsg}>⚠️ {error}</div>}
          <div className={styles.ktmActions} style={{ marginTop: 16 }}>
            <button className={styles.submitBtnOutline} onClick={() => setKycStep(1)}>← Kembali</button>
            <button className={styles.submitBtn} disabled={!selfieData} onClick={handleSubmitKYC}>✅ Verifikasi Sekarang</button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Register Form (Data → OTP → KYC for seller) ──────────────────────────────
function RegisterForm({ onSwitch }) {
  const { register, loading, error, setError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const defaultRole = location.state?.role === 'seller' ? 'seller' : 'buyer'

  const [step, setStep] = useState(1) // 1=data, 2=otp, 3=kyc
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: defaultRole, city: '', phone: '' })
  const [localError, setLocalError] = useState('')
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    setForm(prev => ({ ...prev, role: location.state?.role === 'seller' ? 'seller' : 'buyer' }))
  }, [location.state?.role])

  const handleChange = e => { setError(''); setLocalError(''); setForm({ ...form, [e.target.name]: e.target.value }) }

  const handleStep1 = async e => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) { setLocalError('Password tidak cocok!'); return }
    if (form.password.length < 6) { setLocalError('Password minimal 6 karakter'); return }
    if (!form.phone.trim()) { setLocalError('No. WhatsApp wajib diisi'); return }
    const result = await register({
      name: form.name, email: form.email, password: form.password,
      role: form.role, city: form.city, phone: form.phone,
      verificationStatus: form.role === 'buyer' ? 'approved' : 'pending',
    })
    if (result.success) setStep(2)
  }

  if (step === 2) return (
    <div className={styles.formCard}>
      <OTPStep phone={form.phone} email={form.email}
        onVerified={() => form.role === 'seller' ? setStep(3) : navigate('/')}
        onBack={() => setStep(1)} />
    </div>
  )

  if (step === 3) return (
    <div className={styles.formCard}>
      <KYCStep onDone={() => navigate('/dashboard')} />
    </div>
  )

  const displayError = localError || error
  return (
    <div className={styles.formCard}>
      <div className={styles.formHeader}>
        <div className={styles.formIcon}>🎉</div>
        <h2>Daftar Preloved</h2>
        <p>Bergabung dengan jutaan pengguna Preloved</p>
      </div>
      <div className={styles.roleSelector}>
        <button type="button" className={`${styles.roleBtn} ${form.role === 'buyer' ? styles.roleBtnActive : ''}`} onClick={() => setForm({ ...form, role: 'buyer' })}>🛍️ Pembeli</button>
        <button type="button" className={`${styles.roleBtn} ${form.role === 'seller' ? styles.roleBtnActive : ''}`} onClick={() => setForm({ ...form, role: 'seller' })}>📦 Penjual</button>
      </div>
      <div className={styles.infoBox}>
        {form.role === 'buyer' ? '🛍️ Pembeli: Verifikasi OTP saja. Akun langsung aktif!' : '📦 Penjual: OTP + verifikasi KTP & selfie. Proses cepat, hanya sekali.'}
      </div>
      <form onSubmit={handleStep1} className={styles.form}>
        <div className={styles.field}>
          <label>👤 Nama Lengkap</label>
          <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="Nama lengkap kamu" required />
        </div>
        <div className={styles.field}>
          <label>📧 Email</label>
          <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="email@contoh.com" required />
        </div>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label>🏙️ Kota</label>
            <input type="text" name="city" value={form.city} onChange={handleChange} placeholder="Jakarta..." />
          </div>
          <div className={styles.field}>
            <label>📱 WhatsApp</label>
            <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="08xxxxxxxxxx" maxLength={15} required />
          </div>
        </div>
        <div className={styles.field}>
          <label>🔒 Password</label>
          <div className={styles.passwordWrapper}>
            <input type={showPass ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} placeholder="Min. 6 karakter" required />
            <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(!showPass)}>{showPass ? '🙈' : '👁️'}</button>
          </div>
        </div>
        <div className={styles.field}>
          <label>🔒 Konfirmasi Password</label>
          <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="Ulangi password" required />
        </div>
        {displayError && <div className={styles.errorMsg}>⚠️ {displayError}</div>}
        <button type="submit" className={styles.submitBtn} disabled={loading}>{loading ? '⏳ Mendaftar...' : '→ Lanjut Verifikasi OTP'}</button>
      </form>
      <div className={styles.switchText}>Sudah punya akun?{' '}<button onClick={() => onSwitch('login')} className={styles.switchBtn}>Masuk di sini</button></div>
    </div>
  )
}

// ─── Re-Verify Form (Penjual KYC ditolak) ─────────────────────────────────────
function ReVerifyForm() {
  const { user } = useAuth()
  const navigate = useNavigate()
  return (
    <div className={styles.formCard}>
      <div className={styles.formHeader}>
        <div className={styles.formIcon}>🔄</div>
        <h2>Verifikasi Ulang Identitas</h2>
        <p>Upload ulang dokumen yang lebih jelas</p>
      </div>
      {user?.rejectionNote && (
        <div className={styles.rejectionAlert}><strong>⚠️ Alasan penolakan sebelumnya:</strong><br />{user.rejectionNote}</div>
      )}
      <KYCStep onDone={() => navigate('/dashboard')} />
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AuthPage() {
  const location = useLocation()
  const { user } = useAuth()
  const initialMode = location.state?.mode || 'login'
  const [mode, setMode] = useState(initialMode)

  useEffect(() => {
    setMode(location.state?.mode || 'login')
  }, [location.state?.mode])

  const isReverify = mode === 'reverify' && user?.verificationStatus === 'rejected'

  return (
    <div className={styles.page}>
      <div className={styles.bg}>
        <div className={styles.bgCircle1}></div>
        <div className={styles.bgCircle2}></div>
        <div className={styles.bgCircle3}></div>
      </div>
      <div className={styles.container}>
        <div className={styles.branding}>
          <div className={styles.brandLogo}><span>♻️</span><span>Pre<strong>loved</strong></span></div>
          <h1 className={styles.brandTitle}>Barang Bekas,<br /><span>Nilai Baru.</span></h1>
          <p className={styles.brandDesc}>Marketplace jual beli barang preloved terpercaya untuk semua orang. Hemat lebih banyak, bantu sesama, dan jaga lingkungan tetap hijau. 🌱</p>
          <div className={styles.brandFeatures}>
            <div className={styles.brandFeature}>✅ Verifikasi Identitas Aman</div>
            <div className={styles.brandFeature}>📱 OTP via WhatsApp / Email</div>
            <div className={styles.brandFeature}>🔒 Sistem Escrow Terpercaya</div>
            <div className={styles.brandFeature}>⭐ Rating &amp; Ulasan Real</div>
          </div>
        </div>
        <div className={styles.formWrapper}>
          {isReverify ? <ReVerifyForm />
            : mode === 'login' ? <LoginForm onSwitch={setMode} />
            : <RegisterForm onSwitch={setMode} />}
        </div>
      </div>
    </div>
  )
}
