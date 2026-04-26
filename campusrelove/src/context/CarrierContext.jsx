import { createContext, useContext, useState } from 'react'

const CarrierContext = createContext(null)

const CARRY_ORDERS_KEY   = 'cr_carry_orders'
const CARRY_ESCROW_KEY   = 'cr_carry_escrow'   // rekening penampung jasa angkut

// ── Status flow ───────────────────────────────────────────────────────────────
// available → claimed → heading_to_seller → loading → in_transit → arrived → completed | cancelled
export const CARRY_STATUS = {
  available:         { label: '🟢 Tersedia',         color: '#10B981', bg: '#D1FAE5' },
  claimed:           { label: '🚗 Driver Ditemukan', color: '#2563EB', bg: '#DBEAFE' },
  heading_to_seller: { label: '🛵 Menuju Penjual',   color: '#7C3AED', bg: '#EDE9FE' },
  loading:           { label: '📦 Proses Muat',      color: '#F59E0B', bg: '#FEF3C7' },
  in_transit:        { label: '🚚 Sedang Diantar',   color: '#059669', bg: '#D1FAE5' },
  arrived:           { label: '📍 Tiba di Tujuan',   color: '#065f46', bg: '#D1FAE5' },
  completed:         { label: '🎉 Selesai',          color: '#065f46', bg: '#D1FAE5' },
  cancelled:         { label: '❌ Dibatalkan',       color: '#DC2626', bg: '#FEE2E2' },
}

// Potongan admin dari ongkir jasa angkut (10%)
export const CARRIER_FEE_PERCENT = 10

// ── Helpers ───────────────────────────────────────────────────────────────────
const load = (key, fallback = []) => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) }
  catch { return fallback }
}
const save = (key, data) => localStorage.setItem(key, JSON.stringify(data))

/** Tambah notifikasi ke cr_notifications */
const pushNotif = (recipientId, message) => {
  try {
    const notifs = JSON.parse(localStorage.getItem('cr_notifications') || '[]')
    notifs.unshift({
      notifId:   `n${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
      recipientId,
      type:      'carry',
      message,
      orderId:   null,
      isRead:    false,
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem('cr_notifications', JSON.stringify(notifs))
  } catch {}
}

/**
 * Escrow carry: { balance: number, history: [] }
 * balance = total ongkir yang sedang ditahan (belum cair ke carrier)
 */
const loadEscrow = () => load(CARRY_ESCROW_KEY, { balance: 0, history: [] })
const saveEscrow = (data) => save(CARRY_ESCROW_KEY, data)

/** Masukkan ongkir ke escrow saat pembeli pesan */
const creditEscrow = (amount, carryOrderId, itemDescription, buyerName) => {
  const escrow = loadEscrow()
  escrow.balance = (escrow.balance || 0) + amount
  escrow.history = [
    {
      id:              `ce_${Date.now()}`,
      carryOrderId,
      itemDescription,
      buyerName,
      amount,
      type:            'hold',       // 'hold' | 'release' | 'refund'
      createdAt:       new Date().toISOString(),
    },
    ...(escrow.history || []),
  ]
  saveEscrow(escrow)
}

/** Lepaskan ongkir dari escrow ke carrier saat selesai */
const releaseEscrow = (amount, carryOrderId, itemDescription, carrierName) => {
  const escrow = loadEscrow()
  escrow.balance = Math.max(0, (escrow.balance || 0) - amount)
  escrow.history = [
    {
      id:              `ce_${Date.now()}`,
      carryOrderId,
      itemDescription,
      carrierName,
      amount,
      type:            'release',
      createdAt:       new Date().toISOString(),
    },
    ...(escrow.history || []),
  ]
  saveEscrow(escrow)
}

/** Refund ongkir ke pembeli saat dibatalkan */
const refundEscrow = (amount, carryOrderId, itemDescription, buyerName) => {
  const escrow = loadEscrow()
  escrow.balance = Math.max(0, (escrow.balance || 0) - amount)
  escrow.history = [
    {
      id:              `ce_${Date.now()}`,
      carryOrderId,
      itemDescription,
      buyerName,
      amount,
      type:            'refund',
      createdAt:       new Date().toISOString(),
    },
    ...(escrow.history || []),
  ]
  saveEscrow(escrow)
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function CarrierProvider({ children }) {
  const [carryOrders, setCarryOrders] = useState(() => {
    // Load dan perbaiki data lama yang mungkin punya estimatedFee = 0
    const raw = load(CARRY_ORDERS_KEY)
    return raw
  })

  const persist = (list) => { setCarryOrders(list); save(CARRY_ORDERS_KEY, list) }

  // ── 1. BUAT PESANAN (Checkout) ─────────────────────────────────────────────
  // Ongkir langsung masuk ke Escrow Admin — carrier & penjual belum terima apa-apa
  const createCarryOrder = ({
    buyerId, buyerName, buyerWhatsapp,
    sellerId, sellerName, sellerWhatsapp,
    pickupPoint, dropoffPoint,
    itemDescription, scheduledDate, scheduledTime,
    estimatedFee,
    linkedOrderId = null,
  }) => {
    const fee = Number(estimatedFee) || 0
    const adminCut  = Math.round(fee * CARRIER_FEE_PERCENT / 100)
    const carrierNet = fee - adminCut

    const order = {
      carryOrderId:    `carry_${Date.now()}`,
      linkedOrderId,
      buyerId,
      buyerName,
      buyerWhatsapp:   buyerWhatsapp || '',
      sellerId,
      sellerName,
      sellerWhatsapp:  sellerWhatsapp || '',
      pickupPoint,
      dropoffPoint,
      itemDescription,
      scheduledDate,
      scheduledTime,
      estimatedFee:    fee,
      adminFeePercent: CARRIER_FEE_PERCENT,
      adminCut,        // komisi admin (Rp)
      carrierNet,      // yang akan diterima carrier setelah selesai (Rp)
      escrowStatus:    'holding',   // 'holding' | 'released' | 'refunded'
      status:          'available',
      carrierId:       null,
      carrierName:     null,
      claimedAt:       null,
      proofPhotoUrl:   null,
      carrierRating:   null,
      completedAt:     null,
      createdAt:       new Date().toISOString(),
    }

    const updated = [order, ...load(CARRY_ORDERS_KEY)]
    persist(updated)

    // ── Masukkan ongkir ke Escrow Admin ──────────────────────────────────────
    creditEscrow(fee, order.carryOrderId, itemDescription, buyerName)

    // ── Notifikasi ────────────────────────────────────────────────────────────
    // Ke semua carrier
    try {
      const users = JSON.parse(localStorage.getItem('cr_users') || '[]')
      users.filter(u => u.role === 'carrier').forEach(c => {
        pushNotif(c.id,
          `🚚 Tugas baru tersedia! "${itemDescription}" dari ${sellerName} ke ${buyerName}. ` +
          `Jadwal: ${scheduledDate} ${scheduledTime}. Ongkir: Rp ${fee.toLocaleString('id-ID')}`)
      })
    } catch {}

    // Ke admin
    pushNotif('admin1',
      `🔒 Escrow Carry: Rp ${fee.toLocaleString('id-ID')} dari ${buyerName} untuk ` +
      `"${itemDescription}" masuk ke rekening penampung. Carrier belum menerima.`)

    // Ke pembeli
    pushNotif(buyerId,
      `✅ Pesanan jasa angkut "${itemDescription}" berhasil dibuat! ` +
      `Ongkir Rp ${fee.toLocaleString('id-ID')} ditahan di Escrow — aman sampai barang kamu terima.`)

    return order
  }

  // ── 2. CARRIER AMBIL TUGAS ────────────────────────────────────────────────
  // Status berubah, tapi saldo carrier BELUM bertambah
  const claimOrder = (carryOrderId, carrierId, carrierName) => {
    const current = load(CARRY_ORDERS_KEY)
    const idx = current.findIndex(o => o.carryOrderId === carryOrderId)
    if (idx === -1) return false
    if (current[idx].status !== 'available') return false

    current[idx].status      = 'claimed'
    current[idx].carrierId   = carrierId
    current[idx].carrierName = carrierName
    current[idx].claimedAt   = new Date().toISOString()
    persist(current)

    const o = current[idx]
    pushNotif(o.buyerId,
      `🚗 Driver ditemukan! ${carrierName} akan mengangkut "${o.itemDescription}". ` +
      `Jadwal: ${o.scheduledDate} ${o.scheduledTime}`)
    pushNotif(o.sellerId,
      `🚗 Carrier ${carrierName} akan menjemput barang "${o.itemDescription}" ` +
      `pada ${o.scheduledDate} ${o.scheduledTime}`)
    pushNotif('admin1',
      `✅ Tugas angkut "${o.itemDescription}" diambil oleh ${carrierName}. ` +
      `Escrow Rp ${o.estimatedFee.toLocaleString('id-ID')} masih ditahan.`)
    return true
  }

  // ── 3. UPDATE STATUS PENGIRIMAN ───────────────────────────────────────────
  // Carrier update progress — saldo masih 0
  const updateCarryStatus = (carryOrderId, newStatus) => {
    const current = load(CARRY_ORDERS_KEY)
    const idx = current.findIndex(o => o.carryOrderId === carryOrderId)
    if (idx === -1) return

    current[idx].status = newStatus
    persist(current)

    const o = current[idx]
    const statusMsg = {
      heading_to_seller:
        `🛵 Carrier ${o.carrierName} sedang menuju lokasi penjual untuk menjemput "${o.itemDescription}"`,
      loading:
        `📦 Carrier ${o.carrierName} sedang memuat barang "${o.itemDescription}" ke kendaraan`,
      in_transit:
        `🚚 Barang "${o.itemDescription}" sedang dalam perjalanan ke lokasi kamu!`,
      arrived:
        `📍 Carrier ${o.carrierName} sudah tiba di tujuan dengan "${o.itemDescription}". ` +
        `Tunggu foto bukti dari carrier, lalu konfirmasi penerimaan!`,
    }
    if (statusMsg[newStatus]) {
      pushNotif(o.buyerId,  statusMsg[newStatus])
      pushNotif(o.sellerId, statusMsg[newStatus])
    }
  }

  // ── 4. UPLOAD FOTO BUKTI ──────────────────────────────────────────────────
  // Carrier upload foto — saldo masih 0, menunggu konfirmasi pembeli
  const uploadProofPhoto = (carryOrderId, photoDataUrl) => {
    const current = load(CARRY_ORDERS_KEY)
    const idx = current.findIndex(o => o.carryOrderId === carryOrderId)
    if (idx === -1) return
    current[idx].proofPhotoUrl = photoDataUrl
    persist(current)

    const o = current[idx]
    pushNotif(o.buyerId,
      `📸 Carrier ${o.carrierName} sudah upload foto bukti pengiriman "${o.itemDescription}". ` +
      `Silakan konfirmasi penerimaan agar ongkir cair ke carrier!`)
    pushNotif('admin1',
      `📸 Foto bukti pengiriman "${o.itemDescription}" sudah diupload oleh ${o.carrierName}. ` +
      `Menunggu konfirmasi pembeli ${o.buyerName}.`)
  }

  // ── 5. PEMBELI KONFIRMASI SELESAI → ESCROW CAIR ───────────────────────────
  // INILAH trigger utama: baru di sini saldo carrier & admin bertambah
  const confirmCarryReceived = (carryOrderId, rating = null) => {
    const current = load(CARRY_ORDERS_KEY)
    const idx = current.findIndex(o => o.carryOrderId === carryOrderId)
    if (idx === -1) return

    const o = current[idx]
    const fee        = o.estimatedFee || 0
    const adminCut   = o.adminCut  ?? Math.round(fee * CARRIER_FEE_PERCENT / 100)
    const carrierNet = o.carrierNet ?? (fee - adminCut)

    current[idx].status        = 'completed'
    current[idx].completedAt   = new Date().toISOString()
    current[idx].escrowStatus  = 'released'
    if (rating) current[idx].carrierRating = rating
    persist(current)

    // ── Lepaskan dari Escrow ──────────────────────────────────────────────────
    releaseEscrow(fee, carryOrderId, o.itemDescription, o.carrierName)

    // ── Cair ke saldo Carrier (carrierNet) ────────────────────────────────────
    try {
      const users = JSON.parse(localStorage.getItem('cr_users') || '[]')
      const ci = users.findIndex(u => u.id === o.carrierId)
      if (ci !== -1) {
        users[ci].balance    = (users[ci].balance    || 0) + carrierNet
        users[ci].totalTrips = (users[ci].totalTrips || 0) + 1
        if (rating) {
          const allDone = load(CARRY_ORDERS_KEY)
            .filter(co => co.carrierId === o.carrierId && co.carrierRating)
          const avg = allDone.reduce((s, co) => s + co.carrierRating, 0) / allDone.length
          users[ci].carrierRating = Math.round(avg * 10) / 10
        }
        localStorage.setItem('cr_users', JSON.stringify(users))
      }
    } catch {}

    // ── Cair ke saldo Admin (adminCut) ────────────────────────────────────────
    try {
      const adminWallet = JSON.parse(localStorage.getItem('cr_admin_wallet') ||
        JSON.stringify({ balance: 0, history: [] }))
      adminWallet.balance = (adminWallet.balance || 0) + adminCut
      adminWallet.history = [
        {
          id:           `aw_${Date.now()}`,
          orderId:      carryOrderId,
          productTitle: o.itemDescription,
          amount:       adminCut,
          type:         'carry_fee',
          createdAt:    new Date().toISOString(),
        },
        ...(adminWallet.history || []),
      ]
      localStorage.setItem('cr_admin_wallet', JSON.stringify(adminWallet))
    } catch {}

    // ── Notifikasi ────────────────────────────────────────────────────────────
    pushNotif(o.carrierId,
      `💰 Ongkir Rp ${carrierNet.toLocaleString('id-ID')} dari tugas "${o.itemDescription}" ` +
      `sudah masuk ke saldo kamu! (Dipotong admin ${CARRIER_FEE_PERCENT}% = Rp ${adminCut.toLocaleString('id-ID')})`)

    pushNotif(o.buyerId,
      `🎉 Jasa angkut "${o.itemDescription}" selesai! ` +
      `Ongkir Rp ${fee.toLocaleString('id-ID')} sudah dicairkan ke carrier. Terima kasih!`)

    pushNotif('admin1',
      `✅ Escrow Carry cair: "${o.itemDescription}" — ` +
      `Carrier ${o.carrierName} terima Rp ${carrierNet.toLocaleString('id-ID')}, ` +
      `komisi admin Rp ${adminCut.toLocaleString('id-ID')} masuk ke saldo Admin.`)
  }

  // ── 6. BATALKAN PESANAN → REFUND KE PEMBELI ───────────────────────────────
  const cancelCarryOrder = (carryOrderId, reason = 'Dibatalkan') => {
    const current = load(CARRY_ORDERS_KEY)
    const idx = current.findIndex(o => o.carryOrderId === carryOrderId)
    if (idx === -1) return

    const o = current[idx]
    current[idx].status       = 'cancelled'
    current[idx].escrowStatus = 'refunded'
    current[idx].cancelReason = reason
    persist(current)

    // Refund escrow ke pembeli (simulasi — saldo pembeli bertambah)
    if (o.estimatedFee > 0) {
      refundEscrow(o.estimatedFee, carryOrderId, o.itemDescription, o.buyerName)
      try {
        const users = JSON.parse(localStorage.getItem('cr_users') || '[]')
        const bi = users.findIndex(u => u.id === o.buyerId)
        if (bi !== -1) {
          users[bi].balance = (users[bi].balance || 0) + o.estimatedFee
          localStorage.setItem('cr_users', JSON.stringify(users))
        }
      } catch {}
    }

    pushNotif(o.buyerId,
      `↩️ Pesanan jasa angkut "${o.itemDescription}" dibatalkan. ` +
      `Ongkir Rp ${(o.estimatedFee||0).toLocaleString('id-ID')} dikembalikan ke saldo kamu.`)
    if (o.carrierId) {
      pushNotif(o.carrierId,
        `❌ Pesanan "${o.itemDescription}" dibatalkan. Alasan: ${reason}`)
    }
    pushNotif('admin1',
      `↩️ Refund Carry: Rp ${(o.estimatedFee||0).toLocaleString('id-ID')} ` +
      `dikembalikan ke ${o.buyerName} untuk "${o.itemDescription}". Alasan: ${reason}`)
  }

  // ── QUERIES ───────────────────────────────────────────────────────────────
  const getAvailableOrders  = ()          => carryOrders.filter(o => o.status === 'available')
  const getCarrierOrders    = (carrierId) => carryOrders.filter(o => o.carrierId === carrierId)
  const getBuyerCarryOrders = (buyerId)   => carryOrders.filter(o => o.buyerId  === buyerId)
  const getAllCarryOrders    = ()          =>
    [...carryOrders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const isCarrierBusy = (carrierId) =>
    carryOrders.some(o =>
      o.carrierId === carrierId &&
      ['claimed','heading_to_seller','loading','in_transit','arrived'].includes(o.status))

  /** Total ongkir yang sedang ditahan di escrow carry */
  const getCarryEscrowBalance = () => loadEscrow().balance || 0

  /** Riwayat escrow carry */
  const getCarryEscrowHistory = () => (loadEscrow().history || []).slice(0, 20)

  return (
    <CarrierContext.Provider value={{
      carryOrders,
      CARRIER_FEE_PERCENT,
      // actions
      createCarryOrder,
      claimOrder,
      updateCarryStatus,
      uploadProofPhoto,
      confirmCarryReceived,
      cancelCarryOrder,
      // queries
      getAvailableOrders,
      getCarrierOrders,
      getBuyerCarryOrders,
      getAllCarryOrders,
      isCarrierBusy,
      getCarryEscrowBalance,
      getCarryEscrowHistory,
    }}>
      {children}
    </CarrierContext.Provider>
  )
}

export function useCarrier() {
  return useContext(CarrierContext)
}
