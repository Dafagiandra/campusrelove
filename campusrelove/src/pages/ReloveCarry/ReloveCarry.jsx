import { useState } from 'react'
import styles from './ReloveCarry.module.css'

const carriers = [
  {
    id: 'c1',
    name: 'Budi Santoso',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Budi',
    rating: 4.9,
    trips: 156,
    vehicle: '🛵 Motor + Carrier Box',
    maxWeight: '20 kg',
    area: 'Sekitar UI Depok',
    price: 15000,
    pricePerKm: 3000,
    available: true,
    badge: '⭐ Top Carrier',
  },
  {
    id: 'c2',
    name: 'Andi Wijaya',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Andi',
    rating: 4.7,
    trips: 89,
    vehicle: '🚗 Mobil Pickup',
    maxWeight: '100 kg',
    area: 'Depok & Jakarta Selatan',
    price: 35000,
    pricePerKm: 5000,
    available: true,
    badge: '🚗 Barang Besar',
  },
  {
    id: 'c3',
    name: 'Siti Rahayu',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Siti',
    rating: 4.8,
    trips: 203,
    vehicle: '🛵 Motor',
    maxWeight: '10 kg',
    area: 'Sekitar Kampus UI',
    price: 10000,
    pricePerKm: 2000,
    available: false,
    badge: '⚡ Tercepat',
  },
]

const itemTypes = [
  { id: 'small', label: '📦 Barang Kecil', desc: 'Buku, alat tulis, aksesoris', weight: '0-5 kg', multiplier: 1 },
  { id: 'medium', label: '🪑 Barang Sedang', desc: 'Kipas, rice cooker, tas besar', weight: '5-20 kg', multiplier: 1.5 },
  { id: 'large', label: '🛏️ Barang Besar', desc: 'Lemari, kasur, meja', weight: '20-100 kg', multiplier: 2.5 },
]

function PriceCalculator() {
  const [distance, setDistance] = useState(2)
  const [itemType, setItemType] = useState('small')
  const [floor, setFloor] = useState(0)
  const [result, setResult] = useState(null)

  const calculate = () => {
    const item = itemTypes.find((i) => i.id === itemType)
    const basePrice = 10000
    const distancePrice = distance * 2500
    const itemPrice = basePrice * item.multiplier
    const floorPrice = floor * 5000
    const total = Math.round(basePrice + distancePrice + itemPrice + floorPrice)
    setResult({ total, breakdown: { base: basePrice, distance: distancePrice, item: itemPrice, floor: floorPrice } })
  }

  return (
    <div className={styles.calculator}>
      <h3 className={styles.calcTitle}>🧮 Estimasi Biaya Angkut</h3>

      <div className={styles.calcGrid}>
        <div className={styles.calcField}>
          <label>📏 Jarak (km)</label>
          <div className={styles.sliderWrapper}>
            <input
              type="range"
              min="0.5"
              max="15"
              step="0.5"
              value={distance}
              onChange={(e) => setDistance(Number(e.target.value))}
              className={styles.slider}
            />
            <span className={styles.sliderValue}>{distance} km</span>
          </div>
        </div>

        <div className={styles.calcField}>
          <label>📦 Jenis Barang</label>
          <div className={styles.itemTypes}>
            {itemTypes.map((item) => (
              <button
                key={item.id}
                className={`${styles.itemTypeBtn} ${itemType === item.id ? styles.itemTypeBtnActive : ''}`}
                onClick={() => setItemType(item.id)}
              >
                <span>{item.label}</span>
                <span className={styles.itemTypeDesc}>{item.desc}</span>
                <span className={styles.itemTypeWeight}>{item.weight}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.calcField}>
          <label>🏢 Lantai Tujuan (0 = lantai dasar)</label>
          <div className={styles.sliderWrapper}>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={floor}
              onChange={(e) => setFloor(Number(e.target.value))}
              className={styles.slider}
            />
            <span className={styles.sliderValue}>Lantai {floor}</span>
          </div>
        </div>
      </div>

      <button className={styles.calcBtn} onClick={calculate}>
        🧮 Hitung Estimasi
      </button>

      {result && (
        <div className={styles.calcResult}>
          <div className={styles.calcResultHeader}>
            <span>Estimasi Total</span>
            <span className={styles.calcTotal}>Rp {result.total.toLocaleString('id-ID')}</span>
          </div>
          <div className={styles.calcBreakdown}>
            <div className={styles.calcBreakdownItem}>
              <span>Biaya dasar</span>
              <span>Rp {result.breakdown.base.toLocaleString('id-ID')}</span>
            </div>
            <div className={styles.calcBreakdownItem}>
              <span>Jarak ({distance} km)</span>
              <span>Rp {result.breakdown.distance.toLocaleString('id-ID')}</span>
            </div>
            <div className={styles.calcBreakdownItem}>
              <span>Jenis barang</span>
              <span>Rp {result.breakdown.item.toLocaleString('id-ID')}</span>
            </div>
            {result.breakdown.floor > 0 && (
              <div className={styles.calcBreakdownItem}>
                <span>Biaya lantai ({floor} lantai)</span>
                <span>Rp {result.breakdown.floor.toLocaleString('id-ID')}</span>
              </div>
            )}
          </div>
          <p className={styles.calcNote}>* Harga estimasi, bisa berubah sesuai kondisi aktual</p>
        </div>
      )}
    </div>
  )
}

function CarrierCard({ carrier }) {
  const [booked, setBooked] = useState(false)

  if (booked) {
    return (
      <div className={styles.bookedCard}>
        <div className={styles.bookedIcon}>🎉</div>
        <h3>Pesanan Dikirim!</h3>
        <p>Menunggu konfirmasi dari <strong>{carrier.name}</strong></p>
        <button className={styles.cancelBtn} onClick={() => setBooked(false)}>Batalkan</button>
      </div>
    )
  }

  return (
    <div className={`${styles.carrierCard} ${!carrier.available ? styles.carrierUnavailable : ''}`}>
      <div className={styles.carrierHeader}>
        <img src={carrier.avatar} alt={carrier.name} className={styles.carrierAvatar} />
        <div className={styles.carrierInfo}>
          <div className={styles.carrierNameRow}>
            <h3 className={styles.carrierName}>{carrier.name}</h3>
            <span className={styles.carrierBadge}>{carrier.badge}</span>
          </div>
          <div className={styles.carrierStats}>
            <span>⭐ {carrier.rating}</span>
            <span>·</span>
            <span>{carrier.trips} perjalanan</span>
          </div>
        </div>
        <div className={`${styles.availBadge} ${carrier.available ? styles.availBadgeOn : styles.availBadgeOff}`}>
          {carrier.available ? '🟢 Tersedia' : '🔴 Sibuk'}
        </div>
      </div>

      <div className={styles.carrierDetails}>
        <div className={styles.carrierDetail}>
          <span className={styles.carrierDetailIcon}>{carrier.vehicle.split(' ')[0]}</span>
          <span>{carrier.vehicle.split(' ').slice(1).join(' ')}</span>
        </div>
        <div className={styles.carrierDetail}>
          <span className={styles.carrierDetailIcon}>⚖️</span>
          <span>Maks. {carrier.maxWeight}</span>
        </div>
        <div className={styles.carrierDetail}>
          <span className={styles.carrierDetailIcon}>📍</span>
          <span>{carrier.area}</span>
        </div>
      </div>

      <div className={styles.carrierPricing}>
        <div className={styles.carrierPrice}>
          <span className={styles.carrierPriceNum}>Rp {carrier.price.toLocaleString('id-ID')}</span>
          <span className={styles.carrierPriceLabel}>mulai dari</span>
        </div>
        <div className={styles.carrierPriceKm}>
          + Rp {carrier.pricePerKm.toLocaleString('id-ID')}/km
        </div>
      </div>

      <button
        className={styles.bookBtn}
        onClick={() => carrier.available && setBooked(true)}
        disabled={!carrier.available}
      >
        {carrier.available ? '🚚 Pesan Sekarang' : 'Sedang Tidak Tersedia'}
      </button>
    </div>
  )
}

export default function ReloveCarry() {
  return (
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className="container">
          <div className={styles.heroBadge}>🚚 Jasa Angkut Lokal Kampus</div>
          <h1 className={styles.heroTitle}>
            Relove<span className={styles.heroAccent}>-Carry</span>
          </h1>
          <p className={styles.heroDesc}>
            Jasa angkut barang lokal antar kos di sekitar kampus. Aman, terpercaya, dan harga transparan. Dikelola oleh sesama mahasiswa!
          </p>
          <div className={styles.heroFeatures}>
            <span>✅ Harga Transparan</span>
            <span>✅ Carrier Terverifikasi</span>
            <span>✅ Asuransi Barang</span>
            <span>✅ Real-time Tracking</span>
          </div>
        </div>
      </div>

      <div className="container">
        {/* How it works */}
        <section className={styles.howItWorks}>
          <h2 className="section-title">Cara Kerja Relove-Carry</h2>
          <p className="section-subtitle">Mudah, cepat, dan aman dalam 4 langkah</p>
          <div className={styles.steps}>
            {[
              { num: '1', icon: '📦', title: 'Pilih Barang', desc: 'Tentukan barang yang mau diangkut dan masukkan detail ukuran & berat' },
              { num: '2', icon: '🧮', title: 'Hitung Estimasi', desc: 'Gunakan kalkulator kami untuk estimasi biaya yang transparan' },
              { num: '3', icon: '🤝', title: 'Pilih Carrier', desc: 'Pilih carrier yang tersedia sesuai kebutuhan dan budget kamu' },
              { num: '4', icon: '🚚', title: 'Barang Diantar', desc: 'Carrier akan menjemput dan mengantarkan barang ke tujuan' },
            ].map((step) => (
              <div key={step.num} className={styles.step}>
                <div className={styles.stepNum}>{step.num}</div>
                <div className={styles.stepIcon}>{step.icon}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Price Calculator */}
        <section className={styles.calcSection}>
          <PriceCalculator />
        </section>

        {/* Carriers */}
        <section className={styles.carriersSection}>
          <h2 className="section-title">Carrier Tersedia</h2>
          <p className="section-subtitle">Pilih carrier yang sesuai dengan kebutuhan kamu</p>
          <div className={styles.carriersGrid}>
            {carriers.map((carrier) => (
              <CarrierCard key={carrier.id} carrier={carrier} />
            ))}
          </div>
        </section>

        {/* Info Banner */}
        <section className={styles.infoBanner}>
          <div className={styles.infoGrid}>
            <div className={styles.infoCard} style={{ '--color': '#7C3AED' }}>
              <span className={styles.infoIcon}>🛡️</span>
              <h3>Asuransi Barang</h3>
              <p>Semua pengiriman dilindungi asuransi hingga Rp 500.000</p>
            </div>
            <div className={styles.infoCard} style={{ '--color': '#10B981' }}>
              <span className={styles.infoIcon}>📍</span>
              <h3>Real-time Tracking</h3>
              <p>Pantau posisi carrier secara real-time lewat aplikasi</p>
            </div>
            <div className={styles.infoCard} style={{ '--color': '#F59E0B' }}>
              <span className={styles.infoIcon}>⭐</span>
              <h3>Carrier Terverifikasi</h3>
              <p>Semua carrier sudah diverifikasi KTM dan identitas</p>
            </div>
            <div className={styles.infoCard} style={{ '--color': '#EC4899' }}>
              <span className={styles.infoIcon}>💬</span>
              <h3>Chat Langsung</h3>
              <p>Komunikasi langsung dengan carrier sebelum & saat pengiriman</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
