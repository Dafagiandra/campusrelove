import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCarrier } from '../../context/CarrierContext'
import styles from './ReloveCarry.module.css'

// ── Ambil semua carrier dari localStorage ────────────────────────────────────
function getRegisteredCarriers() {
  try {
    const users = JSON.parse(localStorage.getItem('cr_users') || '[]')
    return users.filter(u => u.role === 'carrier')
  } catch { return [] }
}

const itemTypes = [
  { id: 'small',  label: '📦 Barang Kecil',  desc: 'Buku, alat tulis, aksesoris',   weight: '0-5 kg',    multiplier: 1 },
  { id: 'medium', label: '🪑 Barang Sedang', desc: 'Kipas, rice cooker, tas besar',  weight: '5-20 kg',   multiplier: 1.5 },
  { id: 'large',  label: '🛏️ Barang Besar',  desc: 'Lemari, kasur, meja',           weight: '20-100 kg', multiplier: 2.5 },
]

// ── Kalkulator Harga ─────────────────────────────────────────────────────────
function PriceCalculator({ onEstimate }) {
  const [distance, setDistance] = useState(2)
  const [itemType, setItemType] = useState('small')
  const [floor, setFloor]       = useState(0)
  const [result, setResult]     = useState(null)

  const calculate = () => {
    const item         = itemTypes.find(i => i.id === itemType)
    const basePrice    = 10000
    const distPrice    = distance * 2500
    const itemPrice    = basePrice * item.multiplier
    const floorPrice   = floor * 5000
    const total        = Math.round(basePrice + distPrice + itemPrice + floorPrice)
    const res = { total, breakdown: { base: basePrice, distance: distPrice, item: itemPrice, floor: floorPrice } }
    setResult(res)
    if (onEstimate) onEstimate(total)
  }

  return (
    <div className={styles.calculator}>
      <h3 className={styles.calcTitle}>🧮 Estimasi Biaya Angkut</h3>
      <div className={styles.calcGrid}>
        <div className={styles.calcField}>
          <label>📏 Jarak (km)</label>
          <div className={styles.sliderWrapper}>
            <input type="range" min="0.5" max="15" step="0.5" value={distance}
              onChange={e => setDistance(Number(e.target.value))} className={styles.slider} />
            <span className={styles.sliderValue}>{distance} km</span>
          </div>
        </div>
        <div className={styles.calcField}>
          <label>📦 Jenis Barang</label>
          <div className={styles.itemTypes}>
            {itemTypes.map(item => (
              <button key={item.id}
                className={`${styles.itemTypeBtn} ${itemType === item.id ? styles.itemTypeBtnActive : ''}`}
                onClick={() => setItemType(item.id)}>
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
            <input type="range" min="0" max="10" step="1" value={floor}
              onChange={e => setFloor(Number(e.target.value))} className={styles.slider} />
            <span className={styles.sliderValue}>Lantai {floor}</span>
          </div>
        </div>
      </div>
      <button className={styles.calcBtn} onClick={calculate}>🧮 Hitung Estimasi</button>
      {result && (
        <div className={styles.calcResult}>
          <div className={styles.calcResultHeader}>
            <span>Estimasi Total</span>
            <span className={styles.calcTotal}>Rp {result.total.toLocaleString('id-ID')}</span>
          </div>
          <div className={styles.calcBreakdown}>
            <div className={styles.calcBreakdownItem}><span>Biaya dasar</span><span>Rp {result.breakdown.base.toLocaleString('id-ID')}</span></div>
            <div className={styles.calcBreakdownItem}><span>Jarak ({distance} km)</span><span>Rp {result.breakdown.distance.toLocaleString('id-ID')}</span></div>
            <div className={styles.calcBreakdownItem}><span>Jenis barang</span><span>Rp {result.breakdown.item.toLocaleString('id-ID')}</span></div>
            {result.breakdown.floor > 0 && (
              <div className={styles.calcBreakdownItem}><span>Biaya lantai</span><span>Rp {result.breakdown.floor.toLocaleString('id-ID')}</span></div>
            )}
          </div>
          <p className={styles.calcNote}>* Harga estimasi, bisa berubah sesuai kondisi aktual</p>
        </div>
      )}
    </div>
  )
}

// ── Form Pesan Jasa Angkut ───────────────────────────────────────────────────
function BookingForm({ carrier, estimatedFee, onClose, onSuccess }) {
  const { user } = useAuth()
  const { createCarryOrder } = useCarrier()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    pickupPoint:     '',
    dropoffPoint:    '',
    itemDescription: '',
    scheduledDate:   '',
    scheduledTime:   '',
    buyerWhatsapp:   '',
    agreedFee:       estimatedFee > 0 ? estimatedFee : '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  if (!user) {
    return (
      <div className={styles.bookingModal}>
        <div className={styles.bookingCard}>
          <div className={styles.bookingHeader}>
            <h3>🔐 Login Dulu</h3>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
          <p style={{ color:'#6b7280', marginBottom:20 }}>Kamu perlu login untuk memesan jasa angkut.</p>
          <button className={styles.bookSubmitBtn} onClick={() => navigate('/auth', { state: { mode:'login' } })}>
            Login Sekarang
          </button>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className={styles.bookingModal}>
        <div className={styles.bookingCard}>
          <div className={styles.bookingSuccess}>
            <div className={styles.bookingSuccessIcon}>🎉</div>
            <h3>Pesanan Jasa Angkut Dibuat!</h3>
            <p>Carrier <strong>{carrier.name}</strong> akan segera melihat pesananmu di dashboard mereka.</p>
            <p className={styles.bookingSuccessNote}>
              Pantau status di halaman <strong>Pesanan Saya</strong> atau notifikasi.
            </p>
            <div className={styles.bookingSuccessActions}>
              <button className={styles.bookSubmitBtn} onClick={() => { onSuccess(); onClose() }}>
                ✅ Oke, Mengerti
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!form.pickupPoint || !form.dropoffPoint || !form.itemDescription || !form.scheduledDate || !form.scheduledTime) {
      setError('Lengkapi semua field yang wajib diisi!')
      return
    }
    const finalFee = Number(form.agreedFee) || estimatedFee || 0
    if (finalFee <= 0) {
      setError('Masukkan biaya ongkir yang disepakati!')
      return
    }

    createCarryOrder({
      buyerId:         user.id,
      buyerName:       user.name,
      buyerWhatsapp:   form.buyerWhatsapp || user.whatsappNumber || '',
      sellerId:        carrier.id,
      sellerName:      carrier.name,
      sellerWhatsapp:  carrier.whatsappNumber || '',
      pickupPoint:     form.pickupPoint,
      dropoffPoint:    form.dropoffPoint,
      itemDescription: form.itemDescription,
      scheduledDate:   form.scheduledDate,
      scheduledTime:   form.scheduledTime,
      estimatedFee:    finalFee,
    })
    setSubmitted(true)
  }

  return (
    <div className={styles.bookingModal}>
      <div className={styles.bookingCard}>
        <div className={styles.bookingHeader}>
          <div>
            <h3>🚚 Pesan Jasa Angkut</h3>
            <p>Carrier: <strong>{carrier.name}</strong> · {carrier.vehicleType}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.bookingForm}>
          <div className={styles.bookingField}>
            <label>📍 Titik Jemput (Alamat Penjual/Lokasi Barang) *</label>
            <input type="text" value={form.pickupPoint}
              onChange={e => setForm({...form, pickupPoint: e.target.value})}
              placeholder="Contoh: Kos Jl. Margonda No. 12, Depok" required />
          </div>
          <div className={styles.bookingField}>
            <label>🏠 Titik Antar (Alamat Kamu) *</label>
            <input type="text" value={form.dropoffPoint}
              onChange={e => setForm({...form, dropoffPoint: e.target.value})}
              placeholder="Contoh: Kos Jl. Kukusan No. 5, Depok" required />
          </div>
          <div className={styles.bookingField}>
            <label>📦 Deskripsi Barang *</label>
            <input type="text" value={form.itemDescription}
              onChange={e => setForm({...form, itemDescription: e.target.value})}
              placeholder="Contoh: Lemari kecil 2 pintu, Kursi lipat, 5 kardus buku" required />
          </div>
          <div className={styles.bookingRow}>
            <div className={styles.bookingField}>
              <label>📅 Tanggal Jemput *</label>
              <input type="date" value={form.scheduledDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setForm({...form, scheduledDate: e.target.value})} required />
            </div>
            <div className={styles.bookingField}>
              <label>⏰ Jam Jemput *</label>
              <input type="time" value={form.scheduledTime}
                onChange={e => setForm({...form, scheduledTime: e.target.value})} required />
            </div>
          </div>
          <div className={styles.bookingField}>
            <label>📱 Nomor WhatsApp Kamu</label>
            <input type="tel" value={form.buyerWhatsapp}
              onChange={e => setForm({...form, buyerWhatsapp: e.target.value})}
              placeholder="Contoh: 08123456789" />
          </div>

          {/* Fee field — wajib diisi */}
          <div className={styles.bookingField}>
            <label>💰 Biaya Ongkir yang Disepakati (Rp) *</label>
            <input
              type="number"
              min="1000"
              value={form.agreedFee}
              onChange={e => setForm({...form, agreedFee: e.target.value})}
              placeholder="Contoh: 25000"
              required
            />
            {estimatedFee > 0 && (
              <span style={{ fontSize:'0.72rem', color:'#10B981', marginTop:4 }}>
                ✅ Estimasi dari kalkulator: Rp {estimatedFee.toLocaleString('id-ID')}
              </span>
            )}
          </div>

          {estimatedFee > 0 && (
            <div className={styles.bookingFeeInfo}>
              <div className={styles.bookingFeeRow}>
                <span>💰 Estimasi ongkir:</span>
                <strong>Rp {estimatedFee.toLocaleString('id-ID')}</strong>
              </div>
              <div className={styles.bookingEscrowNote}>
                🔒 <strong>Sistem Escrow:</strong> Ongkir ditahan oleh Admin saat kamu pesan.
                Carrier baru menerima uang <strong>setelah kamu konfirmasi barang diterima</strong>.
                Jika dibatalkan, ongkir dikembalikan ke saldo kamu.
              </div>
            </div>
          )}

          {error && <div className={styles.bookingError}>⚠️ {error}</div>}

          <button type="submit" className={styles.bookSubmitBtn}>
            🚚 Buat Pesanan Jasa Angkut
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Carrier Card ─────────────────────────────────────────────────────────────
function CarrierCard({ carrier, estimatedFee }) {
  const { isCarrierBusy } = useCarrier()
  const [showForm, setShowForm] = useState(false)
  const [booked, setBooked] = useState(false)

  const busy = isCarrierBusy(carrier.id)
  const available = !busy

  const vehicleIcon = carrier.vehicleType?.includes('Mobil') ? '🚗' : '🛵'
  // Tombol pesan hanya aktif jika estimasi sudah dihitung (fee > 0)
  const canBook = available && estimatedFee > 0

  return (
    <>
      <div className={`${styles.carrierCard} ${!available ? styles.carrierUnavailable : ''}`}>
        <div className={styles.carrierHeader}>
          <img
            src={carrier.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(carrier.name)}`}
            alt={carrier.name}
            className={styles.carrierAvatar}
          />
          <div className={styles.carrierInfo}>
            <div className={styles.carrierNameRow}>
              <h3 className={styles.carrierName}>{carrier.name}</h3>
              {carrier.totalTrips > 50 && <span className={styles.carrierBadge}>⭐ Top Carrier</span>}
              {carrier.vehicleType?.includes('Pickup') && <span className={styles.carrierBadge}>🚗 Barang Besar</span>}
            </div>
            <div className={styles.carrierStats}>
              <span>⭐ {carrier.carrierRating || carrier.rating || '5.0'}</span>
              <span>·</span>
              <span>{carrier.totalTrips || 0} perjalanan</span>
            </div>
          </div>
          <div className={`${styles.availBadge} ${available ? styles.availBadgeOn : styles.availBadgeOff}`}>
            {available ? '🟢 Tersedia' : '🔴 Sibuk'}
          </div>
        </div>

        <div className={styles.carrierDetails}>
          <div className={styles.carrierDetail}>
            <span className={styles.carrierDetailIcon}>{vehicleIcon}</span>
            <span>{carrier.vehicleType || 'Motor'}</span>
          </div>
          <div className={styles.carrierDetail}>
            <span className={styles.carrierDetailIcon}>📍</span>
            <span>{carrier.serviceArea || 'Sekitar Kampus'}</span>
          </div>
          {carrier.whatsappNumber && (
            <div className={styles.carrierDetail}>
              <span className={styles.carrierDetailIcon}>📱</span>
              <span>{carrier.whatsappNumber}</span>
            </div>
          )}
        </div>

        <div className={styles.carrierPricing}>
          <div className={styles.carrierPrice}>
            <span className={styles.carrierPriceNum}>
              {estimatedFee > 0 ? `Rp ${estimatedFee.toLocaleString('id-ID')}` : 'Hitung dulu ↑'}
            </span>
            <span className={styles.carrierPriceLabel}>estimasi biaya</span>
          </div>
        </div>

        {!available && (
          <button className={styles.bookBtn} disabled>Sedang Tidak Tersedia</button>
        )}
        {available && estimatedFee === 0 && (
          <button className={styles.bookBtnDisabled} disabled>
            🧮 Hitung Estimasi Dulu
          </button>
        )}
        {available && estimatedFee > 0 && (
          <button className={styles.bookBtn} onClick={() => setShowForm(true)}>
            🚚 Pesan Sekarang
          </button>
        )}
      </div>

      {showForm && (
        <BookingForm
          carrier={carrier}
          estimatedFee={estimatedFee}
          onClose={() => setShowForm(false)}
          onSuccess={() => setBooked(true)}
        />
      )}
    </>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ReloveCarry() {
  const [estimatedFee, setEstimatedFee] = useState(0)

  // Gabungkan carrier dari localStorage + carrier statis sebagai fallback
  const registeredCarriers = getRegisteredCarriers()

  // Carrier statis sebagai demo jika belum ada yang daftar
  const staticCarriers = [
    {
      id: 'static_c1',
      name: 'Budi Santoso',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Budi',
      carrierRating: 4.9,
      totalTrips: 156,
      vehicleType: 'Motor + Carrier Box',
      serviceArea: 'Sekitar UI Depok',
      whatsappNumber: '081234567890',
      role: 'carrier',
    },
    {
      id: 'static_c2',
      name: 'Andi Wijaya',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Andi',
      carrierRating: 4.7,
      totalTrips: 89,
      vehicleType: 'Mobil Pickup',
      serviceArea: 'Depok & Jakarta Selatan',
      whatsappNumber: '081234567891',
      role: 'carrier',
    },
  ]

  // Tampilkan carrier terdaftar dulu, lalu statis sebagai pelengkap
  const allCarriers = registeredCarriers.length > 0
    ? registeredCarriers
    : staticCarriers

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
            <span>✅ Real-time Tracking</span>
            <span>✅ Komisi Langsung Cair</span>
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
              { num:'1', icon:'🧮', title:'Hitung Estimasi', desc:'Gunakan kalkulator untuk estimasi biaya angkut' },
              { num:'2', icon:'🤝', title:'Pilih Carrier',   desc:'Pilih carrier yang tersedia sesuai kebutuhan' },
              { num:'3', icon:'📋', title:'Isi Form Pesanan', desc:'Masukkan titik jemput, titik antar, dan jadwal' },
              { num:'4', icon:'🚚', title:'Barang Diantar',  desc:'Carrier menjemput dan mengantarkan barang kamu' },
            ].map(step => (
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
          <PriceCalculator onEstimate={setEstimatedFee} />
        </section>

        {/* Carriers */}
        <section className={styles.carriersSection}>
          <h2 className="section-title">Carrier Tersedia</h2>
          <p className="section-subtitle">
            {registeredCarriers.length > 0
              ? `${registeredCarriers.length} carrier terdaftar siap melayani kamu`
              : 'Pilih carrier yang sesuai dengan kebutuhan kamu'}
          </p>

          {registeredCarriers.length === 0 && (
            <div className={styles.noCarrierBanner}>
              💡 Belum ada carrier yang mendaftar. Tampil carrier demo. Daftar sebagai carrier di halaman <strong>Daftar → Carrier</strong>.
            </div>
          )}

          <div className={styles.carriersGrid}>
            {allCarriers.map(carrier => (
              <CarrierCard
                key={carrier.id}
                carrier={carrier}
                estimatedFee={estimatedFee}
              />
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
              <p>Pantau status pengiriman langsung dari dashboard</p>
            </div>
            <div className={styles.infoCard} style={{ '--color': '#F59E0B' }}>
              <span className={styles.infoIcon}>⭐</span>
              <h3>Carrier Terverifikasi</h3>
              <p>Semua carrier sudah terdaftar dan terverifikasi</p>
            </div>
            <div className={styles.infoCard} style={{ '--color': '#EC4899' }}>
              <span className={styles.infoIcon}>💬</span>
              <h3>Chat Langsung</h3>
              <p>Hubungi carrier via WhatsApp setelah pesanan dikonfirmasi</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
