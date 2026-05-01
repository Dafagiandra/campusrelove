import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import styles from './AuthPage.module.css'

function LoginForm({ onSwitch }) {
  const { login, loading, error, setError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)

  const handleChange = (e) => {
    setError('')
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const result = login(form.email, form.password)
    if (result.success) {
      if (result.role === 'admin') {
        navigate('/admin')
      } else if (result.role === 'carrier') {
        navigate('/carrier')
      } else {
        navigate(from)
      }
    }
  }

  return (
    <div className={styles.formCard}>
      <div className={styles.formHeader}>
        <div className={styles.formIcon}>🔐</div>
        <h2>Masuk ke Preloved</h2>
        <p>Selamat datang kembali!</p>
      </div>

      {/* Demo credentials hint */}
      <div className={styles.demoHint}>
        <strong>🔑 Demo Admin:</strong> admin@preloved.id / admin123
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label>📧 Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="email@kampus.ac.id"
            required
            autoComplete="email"
          />
        </div>

        <div className={styles.field}>
          <label>🔒 Password</label>
          <div className={styles.passwordWrapper}>
            <input
              type={showPass ? 'text' : 'password'}
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Masukkan password"
              required
              autoComplete="current-password"
            />
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
        <button onClick={() => onSwitch('register')} className={styles.switchBtn}>
          Daftar sekarang
        </button>
      </div>
    </div>
  )
}

function RegisterForm({ onSwitch }) {
  const { register, loading, error, setError } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1) // 1=data, 2=ktm/vehicle (seller/carrier)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'buyer',
    university: 'Universitas Indonesia',
    faculty: '',
    angkatan: '',
    // carrier fields
    vehicleType: '',
    serviceArea: '',
    whatsappNumber: '',
  })
  const [ktmFile, setKtmFile] = useState(null)
  const [ktmPreview, setKtmPreview] = useState(null)
  const [showPass, setShowPass] = useState(false)
  const [localError, setLocalError] = useState('')

  const handleChange = (e) => {
    setError('')
    setLocalError('')
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleKtmChange = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setKtmFile(f)
    const reader = new FileReader()
    reader.onload = ev => setKtmPreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  const handleNextStep = (e) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) { setLocalError('Password tidak cocok!'); return }
    if (form.password.length < 6) { setLocalError('Password minimal 6 karakter'); return }
    if (form.role === 'seller' || form.role === 'carrier') {
      setStep(2)
    } else {
      doRegister()
    }
  }

  const doRegister = () => {
    const result = register(form)
    if (result.success) {
      if (result.role === 'seller')  navigate('/dashboard')
      else if (result.role === 'carrier') navigate('/carrier')
      else navigate('/')
    }
  }

  const displayError = localError || error

  // Step 2: KTM for seller, vehicle info for carrier
  if (step === 2 && form.role === 'carrier') {
    return (
      <div className={styles.formCard}>
        <div className={styles.formHeader}>
          <div className={styles.formIcon}>🚚</div>
          <h2>Info Kendaraan</h2>
          <p>Lengkapi data kendaraan kamu sebagai carrier</p>
        </div>

        <div className={styles.form}>
          <div className={styles.field}>
            <label>🚗 Jenis Kendaraan</label>
            <select name="vehicleType" value={form.vehicleType} onChange={handleChange} required
              style={{ padding:'11px 14px', border:'2px solid #e5e7eb', borderRadius:12, fontFamily:'Poppins,sans-serif', fontSize:'0.88rem', outline:'none' }}>
              <option value="">Pilih kendaraan...</option>
              <option value="Motor">🛵 Motor</option>
              <option value="Motor + Carrier Box">🛵 Motor + Carrier Box</option>
              <option value="Mobil Pickup">🚗 Mobil Pickup</option>
              <option value="Mobil Minivan">🚐 Mobil Minivan</option>
            </select>
          </div>

          <div className={styles.field}>
            <label>📍 Area Layanan</label>
            <input
              type="text"
              name="serviceArea"
              value={form.serviceArea}
              onChange={handleChange}
              placeholder="Contoh: Jakarta Selatan, Depok, Bekasi"
              required
            />
          </div>

          <div className={styles.field}>
            <label>📱 Nomor WhatsApp</label>
            <input
              type="tel"
              name="whatsappNumber"
              value={form.whatsappNumber}
              onChange={handleChange}
              placeholder="Contoh: 08123456789"
              required
            />
          </div>

          <div className={styles.ktmTips} style={{ marginTop: 4 }}>
            📋 Data ini akan ditampilkan ke pembeli setelah kamu mengambil tugas angkut
          </div>

          {displayError && <div className={styles.errorMsg}>⚠️ {displayError}</div>}

          <div className={styles.ktmActions}>
            <button type="button" className={styles.submitBtnOutline} onClick={() => setStep(1)}>← Kembali</button>
            <button
              type="button"
              className={styles.submitBtn}
              disabled={!form.vehicleType || !form.serviceArea || !form.whatsappNumber || loading}
              onClick={doRegister}
            >
              {loading ? '⏳ Mendaftar...' : '🚚 Daftar sebagai Carrier'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 2 && form.role === 'seller') {
    return (
      <div className={styles.formCard}>
        <div className={styles.formHeader}>
          <div className={styles.formIcon}>🪪</div>
          <h2>Verifikasi Identitas</h2>
          <p>Upload foto KTP/SIM/Paspor — hanya sekali saat daftar</p>
        </div>

        <div className={styles.ktmUploadArea} onClick={() => document.getElementById('reg-ktm').click()}>
          {ktmPreview ? (
            <img src={ktmPreview} alt="ID" className={styles.ktmPreviewImg} />
          ) : (
            <>
              <div className={styles.ktmUploadIcon}>📷</div>
              <p>Klik untuk upload foto KTP/SIM/Paspor</p>
              <span>JPG / PNG, max 5MB</span>
            </>
          )}
        </div>
        <input id="reg-ktm" type="file" accept="image/*" onChange={handleKtmChange} style={{ display: 'none' }} />

        <div className={styles.ktmTips}>
          ✅ Foto jelas · ✅ Semua teks terbaca · ✅ Tidak terpotong
        </div>

        <div className={styles.ktmActions}>
          <button type="button" className={styles.submitBtnOutline} onClick={() => setStep(1)}>← Kembali</button>
          <button
            type="button"
            className={styles.submitBtn}
            disabled={!ktmFile || loading}
            onClick={doRegister}
          >
            {loading ? '⏳ Mendaftar...' : '✅ Selesai & Daftar'}
          </button>
        </div>

        {displayError && <div className={styles.errorMsg}>⚠️ {displayError}</div>}
      </div>
    )
  }

  return (
    <div className={styles.formCard}>
      <div className={styles.formHeader}>
        <div className={styles.formIcon}>🎉</div>
        <h2>Daftar Preloved</h2>
        <p>Bergabung dengan jutaan pengguna Preloved</p>
      </div>

      {/* Role selector — 3 pilihan */}
      <div className={styles.roleSelector}>
        <button
          type="button"
          className={`${styles.roleBtn} ${form.role === 'buyer' ? styles.roleBtnActive : ''}`}
          onClick={() => setForm({ ...form, role: 'buyer' })}
        >
          🛍️ Pembeli
        </button>
        <button
          type="button"
          className={`${styles.roleBtn} ${form.role === 'seller' ? styles.roleBtnActive : ''}`}
          onClick={() => setForm({ ...form, role: 'seller' })}
        >
          📦 Penjual
        </button>
        <button
          type="button"
          className={`${styles.roleBtn} ${form.role === 'carrier' ? styles.roleBtnActive : ''}`}
          onClick={() => setForm({ ...form, role: 'carrier' })}
        >
          🚚 Carrier
        </button>
      </div>

      {/* Role description */}
      {form.role === 'carrier' && (
        <div className={styles.roleDesc}>
          🚚 Sebagai <strong>Carrier</strong>, kamu bisa mengambil tugas angkut barang dan mendapatkan komisi dari setiap pengiriman.
        </div>
      )}

      <form onSubmit={handleNextStep} className={styles.form}>
        <div className={styles.field}>
          <label>👤 Nama Lengkap</label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Nama lengkap kamu"
            required
          />
        </div>

        <div className={styles.field}>
          <label>📧 Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="email@contoh.com"
            required
          />
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label>🏙️ Kota</label>
            <input
              type="text"
              name="university"
              value={form.university}
              onChange={handleChange}
              placeholder="Jakarta, Bandung, dll"
            />
          </div>
          <div className={styles.field}>
            <label>📱 No. WhatsApp</label>
            <input
              type="tel"
              name="angkatan"
              value={form.angkatan}
              onChange={handleChange}
              placeholder="08xxxxxxxxxx"
              maxLength={15}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label>🔒 Password</label>
          <div className={styles.passwordWrapper}>
            <input
              type={showPass ? 'text' : 'password'}
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Min. 6 karakter"
              required
            />
            <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(!showPass)}>
              {showPass ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <label>🔒 Konfirmasi Password</label>
          <input
            type="password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            placeholder="Ulangi password"
            required
          />
        </div>

        {displayError && <div className={styles.errorMsg}>⚠️ {displayError}</div>}

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? '⏳ Mendaftar...' : form.role === 'seller' ? '→ Lanjut Upload KTM' : form.role === 'carrier' ? '→ Lanjut Info Kendaraan' : `✅ Daftar sebagai Pembeli`}
        </button>
      </form>

      <div className={styles.switchText}>
        Sudah punya akun?{' '}
        <button onClick={() => onSwitch('login')} className={styles.switchBtn}>
          Masuk di sini
        </button>
      </div>
    </div>
  )
}

export default function AuthPage() {
  const location = useLocation()
  const initialMode = location.state?.mode || 'login'
  const [mode, setMode] = useState(initialMode)

  return (
    <div className={styles.page}>
      <div className={styles.bg}>
        <div className={styles.bgCircle1}></div>
        <div className={styles.bgCircle2}></div>
        <div className={styles.bgCircle3}></div>
      </div>

      <div className={styles.container}>
        {/* Left side branding */}
        <div className={styles.branding}>
          <div className={styles.brandLogo}>
            <span>♻️</span>
            <span>Pre<strong>loved</strong></span>
          </div>
          <h1 className={styles.brandTitle}>
            Barang Bekas,<br />
            <span>Nilai Baru.</span>
          </h1>
          <p className={styles.brandDesc}>
            Marketplace jual beli barang preloved terpercaya untuk semua orang. Hemat lebih banyak, bantu sesama, dan jaga lingkungan tetap hijau. 🌱
          </p>
          <div className={styles.brandFeatures}>
            <div className={styles.brandFeature}>✅ Verifikasi Identitas</div>
            <div className={styles.brandFeature}>📍 Meet-up di Lokasi Aman</div>
            <div className={styles.brandFeature}>🚚 Preloved-Carry Tersedia</div>
            <div className={styles.brandFeature}>⭐ Rating & Ulasan Terpercaya</div>
          </div>
        </div>

        {/* Right side form */}
        <div className={styles.formWrapper}>
          {mode === 'login' ? (
            <LoginForm onSwitch={setMode} />
          ) : (
            <RegisterForm onSwitch={setMode} />
          )}
        </div>
      </div>
    </div>
  )
}
