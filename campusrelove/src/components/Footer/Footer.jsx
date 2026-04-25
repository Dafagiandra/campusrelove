import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.grid}>
          <div className={styles.brand}>
            <div className={styles.logo}>
              <span>♻️</span>
              <span className={styles.logoText}>Campus<span className={styles.accent}>Relove</span></span>
            </div>
            <p className={styles.slogan}>"Dari Kakak Tingkat,<br />Untuk Adik Tingkat."</p>
            <p className={styles.desc}>Marketplace thrifting dan furniture antar mahasiswa. Hemat, ramah lingkungan, dan mempererat komunitas kampus.</p>
          </div>

          <div className={styles.links}>
            <h4>Navigasi</h4>
            <Link to="/">Home</Link>
            <Link to="/browse">Browse Barang</Link>
            <Link to="/relove-carry">Relove-Carry</Link>
            <Link to="/dashboard">Dashboard Penjual</Link>
          </div>

          <div className={styles.links}>
            <h4>Kategori</h4>
            <Link to="/browse?cat=furniture">🪑 Furniture</Link>
            <Link to="/browse?cat=electronic">💻 Electronic</Link>
            <Link to="/browse?cat=academic">📚 Academic Supplies</Link>
          </div>

          <div className={styles.links}>
            <h4>Info</h4>
            <a href="#">Cara Berjualan</a>
            <a href="#">Panduan Keamanan</a>
            <a href="#">Titik Temu Aman</a>
            <a href="#">Hubungi Kami</a>
          </div>
        </div>

        <div className={styles.bottom}>
          <p>© 2024 CampusRelove. Made with 💜 untuk mahasiswa Indonesia.</p>
          <div className={styles.badges}>
            <span className={styles.badge}>🌱 Eco-Friendly</span>
            <span className={styles.badge}>🔒 Verified KTM</span>
            <span className={styles.badge}>🤝 Komunitas Kampus</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
