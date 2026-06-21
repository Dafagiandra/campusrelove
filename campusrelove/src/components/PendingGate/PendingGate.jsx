/**
 * PendingGate — Tampilkan halaman "Menunggu Verifikasi Admin"
 * jika user.verificationStatus === 'pending'
 *
 * Cara pakai:
 *   import { withPendingGate } from '../../components/PendingGate/PendingGate'
 *   export default withPendingGate(MyPage)
 *
 * Atau langsung pakai komponen:
 *   <PendingGate><MyContent /></PendingGate>
 */
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import styles from './PendingGate.module.css'

// ── Halaman menunggu verifikasi ───────────────────────────────────────────────
export function PendingVerificationPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <div className={styles.icon}>⏳</div>
          <div className={styles.iconRing}></div>
        </div>

        <h1 className={styles.title}>Akun Sedang Diverifikasi</h1>
        <p className={styles.subtitle}>
          Halo, <strong>{user?.name}</strong>! 👋
        </p>
        <p className={styles.desc}>
          Data identitasmu (KTP &amp; foto selfie) sudah kami terima dan sedang
          diperiksa oleh tim Admin Preloved.
        </p>

        <div className={styles.steps}>
          <div className={`${styles.step} ${styles.stepDone}`}>
            <div className={styles.stepDot}>✓</div>
            <div className={styles.stepText}>
              <strong>Pendaftaran Selesai</strong>
              <span>Data diri &amp; identitas sudah dikirim</span>
            </div>
          </div>
          <div className={styles.stepLine}></div>
          <div className={`${styles.step} ${styles.stepActive}`}>
            <div className={styles.stepDot}>🔍</div>
            <div className={styles.stepText}>
              <strong>Pemeriksaan Admin</strong>
              <span>Admin sedang memeriksa dokumenmu</span>
            </div>
          </div>
          <div className={styles.stepLine}></div>
          <div className={styles.step}>
            <div className={styles.stepDot}>🎉</div>
            <div className={styles.stepText}>
              <strong>Akun Aktif</strong>
              <span>Bisa jual &amp; beli setelah disetujui</span>
            </div>
          </div>
        </div>

        <div className={styles.infoBox}>
          <span>📬</span>
          <p>
            Proses verifikasi biasanya selesai dalam <strong>1×24 jam</strong>.
            Kamu akan mendapat notifikasi begitu akun diaktifkan.
          </p>
        </div>

        <div className={styles.actions}>
          <button className={styles.btnRefresh} onClick={() => window.location.reload()}>
            🔄 Cek Status
          </button>
          <button className={styles.btnLogout} onClick={handleLogout}>
            🚪 Keluar
          </button>
        </div>

        <p className={styles.note}>
          Ada pertanyaan? Hubungi admin di{' '}
          <a href="mailto:admin@preloved.id">admin@preloved.id</a>
        </p>
      </div>
    </div>
  )
}

// ── Gate wrapper ──────────────────────────────────────────────────────────────
export default function PendingGate({ children }) {
  const { user } = useAuth()

  // Admin & non-logged: tidak diblok di sini
  if (!user || user.role === 'admin') return children

  // Jika ditolak — sudah ditangani VerificationBanner + halaman khusus
  if (user.verificationStatus === 'rejected') return children

  // Jika pending → tampilkan halaman tunggu
  if (user.verificationStatus === 'pending' && !user.verified) {
    return <PendingVerificationPage />
  }

  return children
}

// ── HOC helper ────────────────────────────────────────────────────────────────
export function withPendingGate(Component) {
  return function GatedComponent(props) {
    return (
      <PendingGate>
        <Component {...props} />
      </PendingGate>
    )
  }
}
