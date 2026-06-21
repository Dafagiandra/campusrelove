import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { userAPI } from '../../services/api'
import styles from './AuthPage.module.css'

// ─── Global Verification Banner ──────────────────────────────────────────────
// Shown on all pages when user's verification is rejected
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
        <p>
          {user.rejectionNote
            ? `Alasan: ${user.rejectionNote}`
            : 'Foto identitas atau selfie tidak memenuhi syarat.'}
          {' '}Fitur jual & beli terkunci sampai verifikasi ulang selesai.
        </p>
      </div>
      <button className={styles.verifBannerBtn} onClick={() => navigate('/auth', { state: { mode: 'reverify' } })}>
        🔄 Upload Ulang
      </button>
      <button className={styles.verifBannerClose} onClick={() => setDismissed(true)}>✕</button>
    </div>
  )
}

// ─── Hook: cek apakah user boleh bertransaksi ─────────────────────────────────
export function useVerificationGuard() {
  const { user } = useAuth()
  const isRejected = user?.verificationStatus === 'rejected'
  const isPending  = user?.verificationStatus === 'pending' && !user?.verified
  const isVerified = user?.verificationStatus === 'approved' || user?.verified
  return { isRejected, isPending, isVerified }
}
function LoginForm({ onSwitch }) {
  const { login, loading, error, setError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)

  const handleChange = (e) => { setError(''); setForm({ ...form, [e.target.name]: e.target.value }) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await login(form.email, form.password)
    if (result.success) {
      if (result.role === 'admin') navigate('/admin')
      else navigate(from)
    }
  }

  return (
    <div className={styles.formCard}>
      <div className={styles.formHeader}>
        <div className={styles.formIcon}>🔐</div>
        <h2>Masuk ke Preloved</h2>
        <p>Selamat datang kembali!</p>
      </div>
      <div className={styles.demoHint}>
        <strong>🔑 Demo Admin:</strong> admin@preloved.id / admin123
      </div>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label>📧 Email</label>
          <input type="email" name="email" value={form.email} onChange={handleChange}
            placeholder="email@contoh.com" required autoComplete="email" />
        </div>
        <div className={styles.field}>
          <label>🔒 Password</label>
          <div className={styles.passwordWrapper}>
            <input type={showPass ? 'text' : 'password'} name="password" value={form.password}
              onChange={handleChange} placeholder="Masukkan password" required autoComplete="current-password" />
            <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(!showPass)}>
              {showPass ? '🙈' : '👁️'}
            </button>
          </div>
        </div>
        {error && <div className={styles.errorMsg}>⚠️ {error}</div>}
        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? '⏳ Memproses...' : '🚀 Masuk'}
        </button>
      </form>
      <div className={styles.switchText}>
        Belum punya akun?{' '}
        <button onClick={() => onSwitch('register')} className={styles.switchBtn}>Daftar sekarang</button>
      </div>
    </div>
  )
}

// ─── Face Capture Component ───────────────────────────────────────────────────
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
    setCameraError('')
    setVideoReady(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // Wait for metadata then play
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().then(() => {
            setStreaming(true)
            setVideoReady(true)
          }).catch(() => {
            setStreaming(true)
            setVideoReady(true)
          })
        }
      }
    } catch {
      setCameraError('Tidak bisa akses kamera. Pastikan izin kamera diberikan atau gunakan Upload Foto.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setStreaming(false)
    setVideoReady(false)
  }, [])

  const takePhoto = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    // Use actual video dimensions or fallback
    const w = video.videoWidth  || 640
    const h = video.videoHeight || 480
    canvas.width  = w
    canvas.height = h

    const ctx = canvas.getContext('2d')
    // Mirror the image to match what user sees
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, w, h)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    stopCamera()
    setVerifying(true)
    setTimeout(() => {
      setVerifying(false)
      setVerified(true)
      onCapture(dataUrl)
    }, 2000)
  }, [stopCamera, onCapture])

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setVerifying(true)
      setTimeout(() => {
        setVerifying(false)
        setVerified(true)
        onCapture(ev.target.result)
      }, 2000)
    }
    reader.readAsDataURL(file)
  }

  if (verifying) {
    return (
      <div className={styles.faceVerifying}>
        <div className={styles.faceVerifySpinner}>🔍</div>
        <p>Memverifikasi wajah...</p>
        <div className={styles.verifyBar}><div className={styles.verifyBarFill}></div></div>
      </div>
    )
  }

  if (verified && captured) {
    return (
      <div className={styles.faceVerified}>
        <div className={styles.faceVerifiedCheck}>✅</div>
        <img src={captured} alt="Selfie" className={styles.selfiePreview} />
        <p className={styles.faceVerifiedText}>Wajah berhasil diverifikasi!</p>
        <button type="button" className={styles.retakeBtn}
          onClick={() => { setVerified(false); onCapture(null) }}>
          🔄 Ambil Ulang
        </button>
      </div>
    )
  }

  return (
    <div className={styles.faceCapture}>
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {!streaming ? (
        <div className={styles.faceCaptureIdle}>
          <div className={styles.faceIcon}>🤳</div>
          <p>Ambil foto selfie untuk verifikasi wajah</p>
          <div className={styles.faceBtns}>
            <button type="button" className={styles.btnCamera} onClick={startCamera}>
              📷 Buka Kamera
            </button>
            <label className={styles.btnUploadSelfie}>
              📁 Upload Foto
              <input type="file" accept="image/*" capture="user" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>
          {cameraError && <p className={styles.cameraError}>{cameraError}</p>}
        </div>
      ) : (
        <div className={styles.cameraActive}>
          <video
            ref={videoRef}
            className={styles.cameraVideo}
            autoPlay
            playsInline
            muted
          />
          <div className={styles.cameraOverlay}>
            <div className={styles.faceGuide}></div>
          </div>
          <div className={styles.cameraActions}>
            <button
              type="button"
              className={styles.btnCapture}
              onClick={takePhoto}
              disabled={!videoReady}
            >
              {videoReady ? '📸 Ambil Foto' : '⏳ Memuat...'}
            </button>
            <button type="button" className={styles.btnCancelCamera} onClick={stopCamera}>
              ✕ Batal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Register Form (3 steps) ──────────────────────────────────────────────────
function RegisterForm({ onSwitch }) {
  const { register, loading, error, setError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Baca default role dari state navigasi (e.g. dari tombol "+ Jual Barang")
  const defaultRole = location.state?.role === 'seller' ? 'seller' : 'buyer'

  // step: 1 = data diri, 2 = upload KTP, 3 = selfie / face verify
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    role: defaultRole, city: '', phone: '',
  })
  const [localError, setLocalError] = useState('')
  const [showPass, setShowPass] = useState(false)

  // KTP
  const [ktpFile, setKtpFile] = useState(null)
  const [ktpPreview, setKtpPreview] = useState(null)

  // Selfie
  const [selfieData, setSelfieData] = useState(null)

  // Sync role jika navigasi berubah (e.g. klik "+ Jual Barang" saat sudah di halaman register)
  useEffect(() => {
    const newRole = location.state?.role === 'seller' ? 'seller' : 'buyer'
    setForm(prev => ({ ...prev, role: newRole }))
  }, [location.state?.role])

  const handleChange = (e) => {
    setError(''); setLocalError('')
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleKtpChange = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setKtpFile(f)
    const reader = new FileReader()
    reader.onload = ev => setKtpPreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  // Step 1 → Step 2
  const handleStep1 = (e) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) { setLocalError('Password tidak cocok!'); return }
    if (form.password.length < 6) { setLocalError('Password minimal 6 karakter'); return }
    if (!form.phone.trim()) { setLocalError('No. WhatsApp wajib diisi'); return }
    setStep(2)
  }

  // Step 2 → Step 3
  const handleStep2 = () => {
    if (!ktpFile && !ktpPreview) { setLocalError('Upload foto KTP terlebih dahulu'); return }
    setLocalError('')
    setStep(3)
  }

  // Step 3 → Selesai daftar
  const doRegister = async () => {
    if (!selfieData) { setLocalError('Foto selfie wajib untuk verifikasi wajah'); return }
    const result = await register({
      name: form.name, email: form.email, password: form.password,
      role: form.role, city: form.city, phone: form.phone,
      ktpPhoto: ktpPreview,
      selfiePhoto: selfieData,
      verificationStatus: 'pending',
    })
    if (result.success) {
      // Redirect ke dashboard — PendingGate akan tampilkan halaman tunggu verifikasi
      if (result.role === 'seller') navigate('/dashboard')
      else navigate('/')
    }
  }

  const displayError = localError || error

  // ── Step Progress Bar ──────────────────────────────────────────────────────
  const StepBar = () => (
    <div className={styles.stepBar}>
      {['Data Diri', 'Foto KTP', 'Verifikasi Wajah'].map((label, i) => (
        <div key={i} className={`${styles.stepItem} ${step > i + 1 ? styles.stepDone : ''} ${step === i + 1 ? styles.stepActive : ''}`}>
          <div className={styles.stepCircle}>{step > i + 1 ? '✓' : i + 1}</div>
          <span className={styles.stepLabel}>{label}</span>
          {i < 2 && <div className={`${styles.stepLine} ${step > i + 1 ? styles.stepLineDone : ''}`} />}
        </div>
      ))}
    </div>
  )

  // ── STEP 1: Data Diri ──────────────────────────────────────────────────────
  if (step === 1) return (
    <div className={styles.formCard}>
      <div className={styles.formHeader}>
        <div className={styles.formIcon}>🎉</div>
        <h2>Daftar Preloved</h2>
        <p>Bergabung dengan jutaan pengguna Preloved</p>
      </div>
      <StepBar />
      <div className={styles.roleSelector}>
        <button type="button"
          className={`${styles.roleBtn} ${form.role === 'buyer' ? styles.roleBtnActive : ''}`}
          onClick={() => setForm({ ...form, role: 'buyer' })}>🛍️ Pembeli</button>
        <button type="button"
          className={`${styles.roleBtn} ${form.role === 'seller' ? styles.roleBtnActive : ''}`}
          onClick={() => setForm({ ...form, role: 'seller' })}>📦 Penjual</button>
      </div>
      <form onSubmit={handleStep1} className={styles.form}>
        <div className={styles.field}>
          <label>👤 Nama Lengkap (sesuai KTP)</label>
          <input type="text" name="name" value={form.name} onChange={handleChange}
            placeholder="Nama lengkap sesuai KTP" required />
        </div>
        <div className={styles.field}>
          <label>📧 Email</label>
          <input type="email" name="email" value={form.email} onChange={handleChange}
            placeholder="email@contoh.com" required />
        </div>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label>🏙️ Kota</label>
            <input type="text" name="city" value={form.city} onChange={handleChange}
              placeholder="Jakarta, Bandung..." />
          </div>
          <div className={styles.field}>
            <label>📱 WhatsApp</label>
            <input type="tel" name="phone" value={form.phone} onChange={handleChange}
              placeholder="08xxxxxxxxxx" maxLength={15} required />
          </div>
        </div>
        <div className={styles.field}>
          <label>🔒 Password</label>
          <div className={styles.passwordWrapper}>
            <input type={showPass ? 'text' : 'password'} name="password" value={form.password}
              onChange={handleChange} placeholder="Min. 6 karakter" required />
            <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(!showPass)}>
              {showPass ? '🙈' : '👁️'}
            </button>
          </div>
        </div>
        <div className={styles.field}>
          <label>🔒 Konfirmasi Password</label>
          <input type="password" name="confirmPassword" value={form.confirmPassword}
            onChange={handleChange} placeholder="Ulangi password" required />
        </div>
        {displayError && <div className={styles.errorMsg}>⚠️ {displayError}</div>}
        <button type="submit" className={styles.submitBtn} disabled={loading}>
          → Lanjut Upload KTP
        </button>
      </form>
      <div className={styles.switchText}>
        Sudah punya akun?{' '}
        <button onClick={() => onSwitch('login')} className={styles.switchBtn}>Masuk di sini</button>
      </div>
    </div>
  )

  // ── STEP 2: Upload KTP ─────────────────────────────────────────────────────
  if (step === 2) return (
    <div className={styles.formCard}>
      <div className={styles.formHeader}>
        <div className={styles.formIcon}>🪪</div>
        <h2>Foto KTP / Identitas</h2>
        <p>Upload foto KTP, SIM, atau Paspor yang masih berlaku</p>
      </div>
      <StepBar />

      <div className={styles.ktmUploadArea} onClick={() => document.getElementById('reg-ktp').click()}>
        {ktpPreview ? (
          <img src={ktpPreview} alt="KTP" className={styles.ktmPreviewImg} />
        ) : (
          <>
            <div className={styles.ktmUploadIcon}>🪪</div>
            <p>Klik untuk upload foto KTP / SIM / Paspor</p>
            <span>JPG / PNG · Maks 5MB · Pastikan terbaca jelas</span>
          </>
        )}
      </div>
      <input id="reg-ktp" type="file" accept="image/*" onChange={handleKtpChange} style={{ display: 'none' }} />

      <div className={styles.ktmTips}>
        ✅ Foto jelas &amp; tidak buram &nbsp;·&nbsp; ✅ Semua teks terbaca &nbsp;·&nbsp; ✅ Tidak terpotong
      </div>

      <div className={styles.infoBox}>
        🔒 Data identitas kamu aman dan hanya digunakan untuk verifikasi akun oleh Admin.
      </div>

      {displayError && <div className={styles.errorMsg}>⚠️ {displayError}</div>}

      <div className={styles.ktmActions}>
        <button type="button" className={styles.submitBtnOutline} onClick={() => setStep(1)}>← Kembali</button>
        <button type="button" className={styles.submitBtn} disabled={!ktpPreview} onClick={handleStep2}>
          → Lanjut Verifikasi Wajah
        </button>
      </div>
    </div>
  )

  // ── STEP 3: Verifikasi Wajah ───────────────────────────────────────────────
  return (
    <div className={styles.formCard}>
      <div className={styles.formHeader}>
        <div className={styles.formIcon}>🤳</div>
        <h2>Verifikasi Wajah</h2>
        <p>Ambil selfie untuk memastikan KTP sesuai pemilik</p>
      </div>
      <StepBar />

      <div className={styles.faceInstructions}>
        <div className={styles.faceInstructionItem}>💡 Pastikan wajah terlihat jelas</div>
        <div className={styles.faceInstructionItem}>☀️ Gunakan pencahayaan yang cukup</div>
        <div className={styles.faceInstructionItem}>😐 Tatap kamera langsung</div>
      </div>

      <FaceCapture onCapture={setSelfieData} captured={selfieData} />

      {displayError && <div className={styles.errorMsg}>⚠️ {displayError}</div>}

      <div className={styles.ktmActions} style={{ marginTop: 16 }}>
        <button type="button" className={styles.submitBtnOutline} onClick={() => setStep(2)}>← Kembali</button>
        <button
          type="button"
          className={styles.submitBtn}
          disabled={!selfieData || loading}
          onClick={doRegister}
        >
          {loading ? '⏳ Mendaftar...' : '✅ Selesai & Daftar'}
        </button>
      </div>

      <div className={styles.verifyNote}>
        <strong>ℹ️ Status Akun:</strong> Akun kamu aktif langsung setelah daftar.
        Admin akan memverifikasi data identitas dalam 1×24 jam.
      </div>
    </div>
  )
}

// ─── Re-Verify Form (for rejected users) ─────────────────────────────────────
function ReVerifyForm() {
  const { user, updateProfile, loading } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1=KTP, 2=selfie
  const [ktpPreview, setKtpPreview] = useState(null)
  const [selfieData, setSelfieData] = useState(null)
  const [localError, setLocalError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const handleKtpChange = (e) => {
    const f = e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = ev => setKtpPreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  const handleSubmit = async () => {
    if (!ktpPreview || !selfieData) { setLocalError('Upload KTP dan selfie terlebih dahulu'); return }
    setSubmitting(true)
    setLocalError('')
    try {
      await userAPI.reverify(user.id, { ktpPhoto: ktpPreview, selfiePhoto: selfieData })
      // Update session state
      await updateProfile({
        verificationStatus: 'pending',
        verified: false,
        rejectionNote: null,
      })
      setDone(true)
    } catch (err) {
      setLocalError(err.message?.includes('fetch')
        ? 'Tidak dapat terhubung ke server. Pastikan backend aktif.'
        : (err.message || 'Gagal mengirim dokumen'))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) return (
    <div className={styles.formCard}>
      <div className={styles.formHeader}>
        <div className={styles.formIcon}>✅</div>
        <h2>Dokumen Dikirim!</h2>
        <p>Admin akan memverifikasi ulang identitasmu dalam 1×24 jam.</p>
      </div>
      <div className={styles.infoBox}>
        🔒 Status akun kamu: <strong>Menunggu Verifikasi</strong><br/>
        Kamu akan mendapat notifikasi setelah admin memproses dokumenmu.
      </div>
      <button className={styles.submitBtn} onClick={() => navigate('/')}>
        Kembali ke Beranda
      </button>
    </div>
  )

  const StepBar = () => (
    <div className={styles.stepBar}>
      {['Foto KTP', 'Selfie'].map((label, i) => (
        <div key={i} className={`${styles.stepItem} ${step > i + 1 ? styles.stepDone : ''} ${step === i + 1 ? styles.stepActive : ''}`}>
          <div className={styles.stepCircle}>{step > i + 1 ? '✓' : i + 1}</div>
          <span className={styles.stepLabel}>{label}</span>
          {i < 1 && <div className={`${styles.stepLine} ${step > i + 1 ? styles.stepLineDone : ''}`} />}
        </div>
      ))}
    </div>
  )

  return (
    <div className={styles.formCard}>
      <div className={styles.formHeader}>
        <div className={styles.formIcon}>🔄</div>
        <h2>Verifikasi Ulang</h2>
        <p>Upload foto identitas dan selfie yang lebih jelas</p>
      </div>

      {user?.rejectionNote && (
        <div className={styles.rejectionAlert}>
          <strong>⚠️ Alasan penolakan sebelumnya:</strong><br/>
          {user.rejectionNote}
        </div>
      )}

      <StepBar />

      {step === 1 && (
        <>
          <div className={styles.ktmUploadArea} onClick={() => document.getElementById('reverify-ktp').click()}>
            {ktpPreview ? (
              <img src={ktpPreview} alt="KTP" className={styles.ktmPreviewImg} />
            ) : (
              <>
                <div className={styles.ktmUploadIcon}>🪪</div>
                <p>Klik untuk upload foto KTP / SIM / Paspor</p>
                <span>JPG / PNG · Maks 5MB · Pastikan terbaca jelas</span>
              </>
            )}
          </div>
          <input id="reverify-ktp" type="file" accept="image/*" onChange={handleKtpChange} style={{ display: 'none' }} />
          <div className={styles.ktmTips}>
            ✅ Foto jelas &amp; tidak buram &nbsp;·&nbsp; ✅ Pencahayaan cukup &nbsp;·&nbsp; ✅ Tidak terpotong
          </div>
          {localError && <div className={styles.errorMsg}>⚠️ {localError}</div>}
          <button className={styles.submitBtn} disabled={!ktpPreview} onClick={() => { setLocalError(''); setStep(2) }}>
            → Lanjut Foto Selfie
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <div className={styles.faceInstructions}>
            <div className={styles.faceInstructionItem}>💡 Wajah terlihat jelas</div>
            <div className={styles.faceInstructionItem}>☀️ Pencahayaan cukup</div>
            <div className={styles.faceInstructionItem}>😐 Tatap kamera langsung</div>
          </div>
          <FaceCapture onCapture={setSelfieData} captured={selfieData} />
          {localError && <div className={styles.errorMsg}>⚠️ {localError}</div>}
          <div className={styles.ktmActions} style={{ marginTop: 16 }}>
            <button className={styles.submitBtnOutline} onClick={() => setStep(1)}>← Kembali</button>
            <button className={styles.submitBtn} disabled={!selfieData || submitting} onClick={handleSubmit}>
              {submitting ? '⏳ Mengirim...' : '✅ Kirim Ulang'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AuthPage() {
  const location = useLocation()
  const { user } = useAuth()
  const initialMode = location.state?.mode || 'login'
  const [mode, setMode] = useState(initialMode)

  // Sync mode when navigating to /auth with different state
  // e.g. clicking "Masuk" then "Daftar" on Navbar
  useEffect(() => {
    const newMode = location.state?.mode || 'login'
    setMode(newMode)
  }, [location.state?.mode])

  // If logged-in user with rejected status comes here via re-verify
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
          <div className={styles.brandLogo}>
            <span>♻️</span>
            <span>Pre<strong>loved</strong></span>
          </div>
          <h1 className={styles.brandTitle}>
            Barang Bekas,<br /><span>Nilai Baru.</span>
          </h1>
          <p className={styles.brandDesc}>
            Marketplace jual beli barang preloved terpercaya untuk semua orang.
            Hemat lebih banyak, bantu sesama, dan jaga lingkungan tetap hijau. 🌱
          </p>
          <div className={styles.brandFeatures}>
            <div className={styles.brandFeature}>✅ Verifikasi KTP &amp; Wajah</div>
            <div className={styles.brandFeature}>📍 COD di Lokasi Aman</div>
            <div className={styles.brandFeature}>🔒 Sistem Escrow Terpercaya</div>
            <div className={styles.brandFeature}>⭐ Rating &amp; Ulasan Real</div>
          </div>
        </div>
        <div className={styles.formWrapper}>
          {isReverify
            ? <ReVerifyForm />
            : mode === 'login'
              ? <LoginForm onSwitch={setMode} />
              : <RegisterForm onSwitch={setMode} />
          }
        </div>
      </div>
    </div>
  )
}
