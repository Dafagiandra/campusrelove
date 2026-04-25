import { createContext, useContext, useState } from 'react'

const CarrierContext = createContext(null)

const CARRY_ORDERS_KEY = 'cr_carry_orders'

const load = (key, fallback = []) => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) }
  catch { return fallback }
}
const save = (key, data) => localStorage.setItem(key, JSON.stringify(data))

// Status flow: available → claimed → heading_to_seller → loading → in_transit → arrived → completed | cancelled
export const CARRY_STATUS = {
  available:        { label: '🟢 Tersedia',          color: '#10B981', bg: '#D1FAE5' },
  claimed:          { label: '🚗 Driver Ditemukan',  color: '#2563EB', bg: '#DBEAFE' },
  heading_to_seller:{ label: '🛵 Menuju Penjual',    color: '#7C3AED', bg: '#EDE9FE' },
  loading:          { label: '📦 Proses Muat',       color: '#F59E0B', bg: '#FEF3C7' },
  in_transit:       { label: '🚚 Sedang Diantar',    color: '#059669', bg: '#D1FAE5' },
  arrived:          { label: '📍 Tiba di Tujuan',    color: '#065f46', bg: '#D1FAE5' },
  completed:        { label: '🎉 Selesai',           color: '#065f46', bg: '#D1FAE5' },
  cancelled:        { label: '❌ Dibatalkan',        color: '#DC2626', bg: '#FEE2E2' },
}

const CARRIER_FEE_PERCENT = 10 // 10% potongan admin dari biaya jasa

export function CarrierProvider({ children }) {
  const [carryOrders, setCarryOrders] = useState(() => load(CARRY_ORDERS_KEY))

  const persist = (list) => { setCarryOrders(list); save(CARRY_ORDERS_KEY, list) }

  // ── Notif helper (reuse cr_notifications) ────────────────────────────────
  const addNotif = (recipientId, message) => {
    try {
      const notifs = JSON.parse(localStorage.getItem('cr_notifications') || '[]')
      notifs.unshift({
        notifId:     `n${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
        recipientId,
        type:        'carry',
        message,
        orderId:     null,
        isRead:      false,
        createdAt:   new Date().toISOString(),
      })
      localStorage.setItem('cr_notifications', JSON.stringify(notifs))
    } catch {}
  }

  // ── CREATE carry order (from checkout) ───────────────────────────────────
  const createCarryOrder = ({
    buyerId, buyerName, buyerWhatsapp,
    sellerId, sellerName, sellerWhatsapp,
    pickupPoint, dropoffPoint,
    itemDescription, scheduledDate, scheduledTime,
    estimatedFee,
    linkedOrderId = null,
  }) => {
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
      estimatedFee:    Number(estimatedFee) || 0,
      adminFeePercent: CARRIER_FEE_PERCENT,
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

    // Notif ke semua carrier
    try {
      const users = JSON.parse(localStorage.getItem('cr_users') || '[]')
      users.filter(u => u.role === 'carrier').forEach(c => {
        addNotif(c.id, `🚚 Tugas baru tersedia! "${itemDescription}" dari ${sellerName} ke ${buyerName}. Jadwal: ${scheduledDate} ${scheduledTime}`)
      })
    } catch {}

    addNotif('admin1', `🚚 Pesanan jasa angkut baru: "${itemDescription}" dari ${buyerName}. Estimasi Rp ${Number(estimatedFee).toLocaleString('id-ID')}`)

    return order
  }

  // ── CLAIM order (carrier ambil tugas) ────────────────────────────────────
  const claimOrder = (carryOrderId, carrierId, carrierName) => {
    const current = load(CARRY_ORDERS_KEY)
    const idx = current.findIndex(o => o.carryOrderId === carryOrderId)
    if (idx === -1) return false
    if (current[idx].status !== 'available') return false // sudah diambil

    current[idx].status      = 'claimed'
    current[idx].carrierId   = carrierId
    current[idx].carrierName = carrierName
    current[idx].claimedAt   = new Date().toISOString()
    persist(current)

    const o = current[idx]
    addNotif(o.buyerId,  `🚗 Driver ditemukan! ${carrierName} akan mengangkut "${o.itemDescription}". Jadwal: ${o.scheduledDate} ${o.scheduledTime}`)
    addNotif(o.sellerId, `🚗 Carrier ${carrierName} akan menjemput barang "${o.itemDescription}" pada ${o.scheduledDate} ${o.scheduledTime}`)
    addNotif('admin1',   `✅ Tugas angkut "${o.itemDescription}" diambil oleh ${carrierName}`)
    return true
  }

  // ── UPDATE status (carrier update progress) ──────────────────────────────
  const updateCarryStatus = (carryOrderId, newStatus) => {
    const current = load(CARRY_ORDERS_KEY)
    const idx = current.findIndex(o => o.carryOrderId === carryOrderId)
    if (idx === -1) return

    current[idx].status = newStatus
    if (newStatus === 'completed') current[idx].completedAt = new Date().toISOString()
    persist(current)

    const o = current[idx]
    const statusMsg = {
      heading_to_seller: `🛵 Carrier ${o.carrierName} sedang menuju lokasi penjual untuk menjemput "${o.itemDescription}"`,
      loading:           `📦 Carrier ${o.carrierName} sedang memuat barang "${o.itemDescription}" ke kendaraan`,
      in_transit:        `🚚 Barang "${o.itemDescription}" sedang dalam perjalanan ke lokasi kamu!`,
      arrived:           `📍 Carrier ${o.carrierName} sudah tiba di tujuan dengan barang "${o.itemDescription}". Segera konfirmasi!`,
    }
    if (statusMsg[newStatus]) {
      addNotif(o.buyerId,  statusMsg[newStatus])
      addNotif(o.sellerId, statusMsg[newStatus])
    }
  }

  // ── UPLOAD proof photo ────────────────────────────────────────────────────
  const uploadProofPhoto = (carryOrderId, photoDataUrl) => {
    const current = load(CARRY_ORDERS_KEY)
    const idx = current.findIndex(o => o.carryOrderId === carryOrderId)
    if (idx === -1) return
    current[idx].proofPhotoUrl = photoDataUrl
    persist(current)

    const o = current[idx]
    addNotif(o.buyerId, `📸 Carrier ${o.carrierName} sudah upload foto bukti pengiriman "${o.itemDescription}". Silakan konfirmasi penerimaan!`)
  }

  // ── BUYER confirm received → complete + release fund ─────────────────────
  const confirmCarryReceived = (carryOrderId, rating = null) => {
    const current = load(CARRY_ORDERS_KEY)
    const idx = current.findIndex(o => o.carryOrderId === carryOrderId)
    if (idx === -1) return

    current[idx].status        = 'completed'
    current[idx].completedAt   = new Date().toISOString()
    if (rating) current[idx].carrierRating = rating
    persist(current)

    const o = current[idx]
    const netFee = Math.round(o.estimatedFee * (1 - o.adminFeePercent / 100))

    // Cair ke saldo carrier
    try {
      const users = JSON.parse(localStorage.getItem('cr_users') || '[]')
      const ci = users.findIndex(u => u.id === o.carrierId)
      if (ci !== -1) {
        users[ci].balance    = (users[ci].balance    || 0) + netFee
        users[ci].totalTrips = (users[ci].totalTrips || 0) + 1
        // Update rating carrier
        if (rating) {
          const allDone = load(CARRY_ORDERS_KEY).filter(co => co.carrierId === o.carrierId && co.carrierRating)
          const avgRating = allDone.reduce((s, co) => s + co.carrierRating, 0) / allDone.length
          users[ci].carrierRating = Math.round(avgRating * 10) / 10
        }
        localStorage.setItem('cr_users', JSON.stringify(users))
      }
    } catch {}

    addNotif(o.carrierId, `💰 Komisi Rp ${netFee.toLocaleString('id-ID')} dari tugas "${o.itemDescription}" sudah masuk ke saldo kamu! (Dipotong admin ${o.adminFeePercent}%)`)
    addNotif(o.buyerId,   `🎉 Jasa angkut "${o.itemDescription}" selesai! Terima kasih sudah menggunakan Relove-Carry.`)
    addNotif('admin1',    `✅ Jasa angkut selesai: "${o.itemDescription}". Komisi carrier Rp ${netFee.toLocaleString('id-ID')} sudah cair.`)
  }

  // ── QUERIES ───────────────────────────────────────────────────────────────
  const getAvailableOrders  = ()          => carryOrders.filter(o => o.status === 'available')
  const getCarrierOrders    = (carrierId) => carryOrders.filter(o => o.carrierId === carrierId)
  const getBuyerCarryOrders = (buyerId)   => carryOrders.filter(o => o.buyerId  === buyerId)
  const getAllCarryOrders    = ()          => [...carryOrders].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt))

  const isCarrierBusy = (carrierId) =>
    carryOrders.some(o => o.carrierId === carrierId &&
      ['claimed','heading_to_seller','loading','in_transit','arrived'].includes(o.status))

  return (
    <CarrierContext.Provider value={{
      carryOrders,
      CARRIER_FEE_PERCENT,
      createCarryOrder,
      claimOrder,
      updateCarryStatus,
      uploadProofPhoto,
      confirmCarryReceived,
      getAvailableOrders,
      getCarrierOrders,
      getBuyerCarryOrders,
      getAllCarryOrders,
      isCarrierBusy,
    }}>
      {children}
    </CarrierContext.Provider>
  )
}

export function useCarrier() {
  return useContext(CarrierContext)
}
