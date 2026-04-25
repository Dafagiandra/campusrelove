import { createContext, useContext, useState } from 'react'

const OrderContext = createContext(null)

const ORDERS_KEY = 'cr_orders'
const NOTIFS_KEY = 'cr_notifications'
const CHATS_KEY  = 'cr_chats'
const ADMIN_WALLET_KEY = 'cr_admin_wallet' // saldo & riwayat komisi admin

// ── Konfigurasi Komisi ────────────────────────────────────────────────────────
// Ubah nilai ini untuk mengatur biaya layanan platform
const PLATFORM_FEE_PERCENT = 2  // 2% komisi platform dari harga barang

// ── helpers ──────────────────────────────────────────────────────────────────
const load = (key, fallback = []) => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) }
  catch { return fallback }
}
const save = (key, data) => localStorage.setItem(key, JSON.stringify(data))

/** Hitung pembagian dana:
 *  - platformFee  = harga × PLATFORM_FEE_PERCENT / 100  (keuntungan admin)
 *  - sellerAmount = harga - platformFee                  (diterima penjual)
 */
const calcFundSplit = (price) => {
  const platformFee  = Math.round(price * PLATFORM_FEE_PERCENT / 100)
  const sellerAmount = price - platformFee
  return { platformFee, sellerAmount }
}

/** Tambah saldo & riwayat ke admin wallet di localStorage */
const creditAdminWallet = (amount, orderId, productTitle) => {
  const wallet = load(ADMIN_WALLET_KEY, { balance: 0, history: [] })
  wallet.balance = (wallet.balance || 0) + amount
  wallet.history = [
    {
      id:           `aw_${Date.now()}`,
      orderId,
      productTitle,
      amount,
      type:         'platform_fee',
      createdAt:    new Date().toISOString(),
    },
    ...(wallet.history || []),
  ]
  save(ADMIN_WALLET_KEY, wallet)
  return wallet
}

/** Baca saldo admin wallet */
export const getAdminWallet = () => load(ADMIN_WALLET_KEY, { balance: 0, history: [] })

// ── provider ─────────────────────────────────────────────────────────────────
export function OrderProvider({ children }) {
  const [orders,        setOrders]        = useState(() => load(ORDERS_KEY))
  const [notifications, setNotifications] = useState(() => load(NOTIFS_KEY))
  const [chats,         setChats]         = useState(() => load(CHATS_KEY))

  // ── internal helpers ──────────────────────────────────────────────────────
  const persistOrders = (list) => { setOrders(list);        save(ORDERS_KEY, list) }
  const persistNotifs = (list) => { setNotifications(list); save(NOTIFS_KEY, list) }
  const persistChats  = (list) => { setChats(list);         save(CHATS_KEY,  list) }

  const addNotif = (recipientId, type, message, orderId = null) => {
    const notif = {
      notifId:     `n${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      recipientId,
      type,        // 'order_new' | 'order_paid' | 'order_processing' | 'order_shipped'
                   // | 'order_delivered' | 'order_completed' | 'order_cancelled'
                   // | 'payment_validated' | 'fund_released' | 'chat_new'
      message,
      orderId,
      isRead:      false,
      createdAt:   new Date().toISOString(),
    }
    const updated = [notif, ...load(NOTIFS_KEY)]
    persistNotifs(updated)
    return notif
  }

  const addSystemChatMsg = (conversationId, text) => {
    const current = load(CHATS_KEY)
    const idx = current.findIndex(c => c.conversationId === conversationId)
    if (idx === -1) return
    const msg = {
      messageId: `m${Date.now()}`,
      senderId:  'system',
      text,
      sentAt:    new Date().toISOString(),
      isRead:    true,
    }
    current[idx].messages.push(msg)
    persistChats(current)
  }

  // ── ORDER ACTIONS ─────────────────────────────────────────────────────────

  /** Pembeli checkout → buat order baru (status: pending_payment) */
  const createOrder = ({ buyerId, buyerName, sellerId, productId, productTitle, price, meetupPoint }) => {
    const { platformFee, sellerAmount } = calcFundSplit(price)
    const order = {
      orderId:       `ord_${Date.now()}`,
      buyerId,
      buyerName,
      sellerId,
      productId,
      productTitle,
      price,
      // ── Dana ──────────────────────────────────────────────────────────────
      platformFeePercent: PLATFORM_FEE_PERCENT,
      platformFee,        // komisi admin (Rp)
      sellerAmount,       // yang diterima penjual (Rp)
      escrowStatus:       'holding', // 'holding' | 'released' | 'refunded'
      // ─────────────────────────────────────────────────────────────────────
      meetupPoint:   meetupPoint || null,
      status:        'pending_payment',
      createdAt:     new Date().toISOString(),
      paidAt:        null,
      processedAt:   null,
      shippedAt:     null,
      deliveredAt:   null,
      completedAt:   null,
      resi:          null,
      codSchedule:   null,
      cancelReason:  null,
    }
    const updated = [order, ...orders]
    persistOrders(updated)

    // Notif ke admin
    addNotif('admin1', 'order_new',
      `📦 Pesanan baru dari ${buyerName} untuk "${productTitle}" — Rp ${price.toLocaleString('id-ID')}. Dana masuk ke Escrow, validasi pembayaran.`,
      order.orderId)

    // Notif ke pembeli
    addNotif(buyerId, 'order_new',
      `✅ Pesanan kamu untuk "${productTitle}" berhasil dibuat. Dana akan ditahan di Escrow hingga barang kamu terima.`,
      order.orderId)

    return order
  }

  /** Admin konfirmasi pembayaran → status: paid, dana masuk Escrow */
  const confirmPayment = (orderId) => {
    const current = load(ORDERS_KEY)
    const idx = current.findIndex(o => o.orderId === orderId)
    if (idx === -1) return
    current[idx].status = 'paid'
    current[idx].paidAt = new Date().toISOString()
    current[idx].escrowStatus = 'holding'
    persistOrders(current)

    const o = current[idx]
    const { platformFee, sellerAmount } = calcFundSplit(o.price)

    // Notif ke penjual
    addNotif(o.sellerId, 'order_paid',
      `🛒 Pesanan baru masuk! "${o.productTitle}" dari ${o.buyerName}. Pembayaran Rp ${o.price.toLocaleString('id-ID')} sudah masuk Escrow. Segera proses pesanan.`,
      orderId)
    // Notif ke pembeli
    addNotif(o.buyerId, 'payment_validated',
      `🔒 Pembayaran Rp ${o.price.toLocaleString('id-ID')} untuk "${o.productTitle}" sudah dikonfirmasi dan ditahan di Escrow. Aman sampai kamu terima barang!`,
      orderId)
    // Notif ke admin
    addNotif('admin1', 'escrow_holding',
      `🔒 Escrow: Rp ${o.price.toLocaleString('id-ID')} dari pesanan "${o.productTitle}" sedang ditahan. Akan cair ke penjual (Rp ${sellerAmount.toLocaleString('id-ID')}) + komisi admin (Rp ${platformFee.toLocaleString('id-ID')}) setelah pembeli konfirmasi.`,
      orderId)

    const conv = load(CHATS_KEY).find(c => c.productId === o.productId && c.buyerId === o.buyerId)
    if (conv) addSystemChatMsg(conv.conversationId, `🔒 Pembayaran dikonfirmasi & ditahan Escrow. Penjual sedang memproses pesanan.`)
  }

  /** Admin tolak pembayaran → status: cancelled */
  const rejectPayment = (orderId, reason = 'Pembayaran tidak valid') => {
    const current = load(ORDERS_KEY)
    const idx = current.findIndex(o => o.orderId === orderId)
    if (idx === -1) return
    current[idx].status = 'cancelled'
    current[idx].cancelReason = reason
    persistOrders(current)

    const o = current[idx]
    addNotif(o.buyerId, 'order_cancelled',
      `❌ Pembayaran kamu untuk "${o.productTitle}" ditolak Admin. Alasan: ${reason}.`,
      orderId)
  }

  /** Penjual proses pesanan → status: processing */
  const processOrder = (orderId) => {
    const current = load(ORDERS_KEY)
    const idx = current.findIndex(o => o.orderId === orderId)
    if (idx === -1) return
    current[idx].status = 'processing'
    current[idx].processedAt = new Date().toISOString()
    persistOrders(current)

    const o = current[idx]
    addNotif(o.buyerId, 'order_processing',
      `📦 Penjual sedang memproses pesananmu untuk "${o.productTitle}". Tunggu info pengiriman ya!`,
      orderId)

    const conv = load(CHATS_KEY).find(c => c.productId === o.productId && c.buyerId === o.buyerId)
    if (conv) addSystemChatMsg(conv.conversationId, '📦 Penjual sedang memproses pesanan.')
  }

  /** Penjual tolak pesanan → status: cancelled */
  const rejectOrder = (orderId, reason = 'Stok habis') => {
    const current = load(ORDERS_KEY)
    const idx = current.findIndex(o => o.orderId === orderId)
    if (idx === -1) return
    current[idx].status = 'cancelled'
    current[idx].cancelReason = reason
    persistOrders(current)

    const o = current[idx]
    addNotif(o.buyerId, 'order_cancelled',
      `❌ Pesananmu untuk "${o.productTitle}" ditolak penjual. Alasan: ${reason}.`,
      orderId)
    addNotif('admin1', 'order_cancelled',
      `⚠️ Penjual menolak pesanan "${o.productTitle}" dari ${o.buyerName}. Alasan: ${reason}.`,
      orderId)
  }

  /** Penjual input resi/COD → status: shipped */
  const shipOrder = (orderId, { method, resi, codSchedule }) => {
    const current = load(ORDERS_KEY)
    const idx = current.findIndex(o => o.orderId === orderId)
    if (idx === -1) return
    current[idx].status = 'shipped'
    current[idx].shippedAt = new Date().toISOString()
    current[idx].resi = resi || null
    current[idx].codSchedule = codSchedule || null
    persistOrders(current)

    const o = current[idx]
    const detail = method === 'cod'
      ? `COD dijadwalkan: ${codSchedule}`
      : `No. Resi: ${resi}`
    addNotif(o.buyerId, 'order_shipped',
      `🚚 Barang "${o.productTitle}" sedang dalam perjalanan! ${detail}`,
      orderId)

    const conv = load(CHATS_KEY).find(c => c.productId === o.productId && c.buyerId === o.buyerId)
    if (conv) addSystemChatMsg(conv.conversationId, `🚚 Barang dikirim. ${detail}`)
  }

  /**
   * Pembeli konfirmasi terima barang → status: completed
   * Dana langsung dibagi otomatis:
   *   - sellerAmount → saldo penjual
   *   - platformFee  → saldo admin (escrow profit)
   */
  const confirmDelivery = (orderId) => {
    const current = load(ORDERS_KEY)
    const idx = current.findIndex(o => o.orderId === orderId)
    if (idx === -1) return

    const o = current[idx]
    // Hitung ulang untuk memastikan konsisten (atau pakai yang tersimpan)
    const platformFee  = o.platformFee  ?? Math.round(o.price * PLATFORM_FEE_PERCENT / 100)
    const sellerAmount = o.sellerAmount ?? (o.price - platformFee)

    current[idx].status       = 'completed'
    current[idx].deliveredAt  = new Date().toISOString()
    current[idx].completedAt  = new Date().toISOString()
    current[idx].escrowStatus = 'released'
    persistOrders(current)

    // ── Cair ke saldo penjual ──────────────────────────────────────────────
    try {
      const users = JSON.parse(localStorage.getItem('cr_users') || '[]')
      const ui = users.findIndex(u => u.id === o.sellerId)
      if (ui !== -1) {
        users[ui].balance    = (users[ui].balance    || 0) + sellerAmount
        users[ui].totalSales = (users[ui].totalSales || 0) + 1
        localStorage.setItem('cr_users', JSON.stringify(users))
      }
    } catch {}

    // ── Cair ke saldo admin (komisi platform) ─────────────────────────────
    creditAdminWallet(platformFee, orderId, o.productTitle)

    // ── Notifikasi ────────────────────────────────────────────────────────
    addNotif(o.sellerId, 'fund_released',
      `💰 Dana Rp ${sellerAmount.toLocaleString('id-ID')} dari penjualan "${o.productTitle}" sudah masuk ke saldo kamu! (Harga Rp ${o.price.toLocaleString('id-ID')} − komisi platform Rp ${platformFee.toLocaleString('id-ID')})`,
      orderId)

    addNotif(o.buyerId, 'order_completed',
      `🎉 Transaksi "${o.productTitle}" selesai! Dana sudah dicairkan ke penjual. Terima kasih sudah berbelanja di CampusRelove!`,
      orderId)

    addNotif('admin1', 'fund_released',
      `✅ Escrow cair: "${o.productTitle}" — Penjual terima Rp ${sellerAmount.toLocaleString('id-ID')}, komisi platform Rp ${platformFee.toLocaleString('id-ID')} masuk ke saldo Admin.`,
      orderId)

    const conv = load(CHATS_KEY).find(c => c.productId === o.productId && c.buyerId === o.buyerId)
    if (conv) addSystemChatMsg(conv.conversationId, `🎉 Transaksi selesai! Dana sudah dicairkan ke penjual.`)
  }

  /**
   * releaseFund sekarang tidak dipakai untuk order produk biasa
   * (sudah otomatis di confirmDelivery), tapi tetap ada untuk kompatibilitas
   * atau kasus manual override oleh admin.
   */
  const releaseFund = (orderId) => {
    // Hanya jalankan jika status masih 'delivered' (belum auto-complete)
    const current = load(ORDERS_KEY)
    const idx = current.findIndex(o => o.orderId === orderId)
    if (idx === -1) return
    if (current[idx].status === 'completed') return // sudah selesai

    confirmDelivery(orderId)
  }

  // ── NOTIFICATION ACTIONS ──────────────────────────────────────────────────
  const markNotifRead = (notifId) => {
    const current = load(NOTIFS_KEY)
    const updated = current.map(n => n.notifId === notifId ? { ...n, isRead: true } : n)
    persistNotifs(updated)
  }

  const markAllRead = (userId) => {
    const current = load(NOTIFS_KEY)
    const updated = current.map(n => n.recipientId === userId ? { ...n, isRead: true } : n)
    persistNotifs(updated)
  }

  const getUserNotifs = (userId) =>
    notifications.filter(n => n.recipientId === userId || n.recipientId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const getUnreadCount = (userId) =>
    notifications.filter(n => n.recipientId === userId && !n.isRead).length

  // ── CHAT ACTIONS ──────────────────────────────────────────────────────────
  const getOrCreateConversation = (buyerId, sellerId, productId, productTitle) => {
    const current = load(CHATS_KEY)
    const existing = current.find(
      c => c.buyerId === buyerId && c.sellerId === sellerId && c.productId === productId
    )
    if (existing) return existing

    const conv = {
      conversationId: `conv_${Date.now()}`,
      buyerId,
      sellerId,
      productId,
      productTitle,
      messages: [{
        messageId: `m${Date.now()}`,
        senderId:  'system',
        text:      `💬 Percakapan dimulai untuk produk "${productTitle}"`,
        sentAt:    new Date().toISOString(),
        isRead:    true,
      }],
      createdAt: new Date().toISOString(),
    }
    const updated = [conv, ...current]
    persistChats(updated)
    return conv
  }

  const sendMessage = (conversationId, senderId, text) => {
    const current = load(CHATS_KEY)
    const idx = current.findIndex(c => c.conversationId === conversationId)
    if (idx === -1) return

    const msg = {
      messageId: `m${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
      senderId,
      text,
      sentAt:    new Date().toISOString(),
      isRead:    false,
    }
    current[idx].messages.push(msg)
    current[idx].lastMessageAt = msg.sentAt
    persistChats(current)

    // Notif ke pihak lain
    const conv = current[idx]
    const recipientId = senderId === conv.buyerId ? conv.sellerId : conv.buyerId
    addNotif(recipientId, 'chat_new',
      `💬 Pesan baru tentang "${conv.productTitle}"`,
      null)

    return msg
  }

  const getConversation = (conversationId) =>
    load(CHATS_KEY).find(c => c.conversationId === conversationId) || null

  const getSellerConversations = (sellerId) =>
    load(CHATS_KEY)
      .filter(c => c.sellerId === sellerId)
      .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt))

  const getBuyerConversations = (buyerId) =>
    load(CHATS_KEY)
      .filter(c => c.buyerId === buyerId)
      .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt))

  const markChatRead = (conversationId, userId) => {
    const current = load(CHATS_KEY)
    const idx = current.findIndex(c => c.conversationId === conversationId)
    if (idx === -1) return
    current[idx].messages = current[idx].messages.map(m =>
      m.senderId !== userId ? { ...m, isRead: true } : m
    )
    persistChats(current)
    setChats([...current])
  }

  const getUnreadChatCount = (userId) => {
    const convs = load(CHATS_KEY).filter(c => c.buyerId === userId || c.sellerId === userId)
    return convs.reduce((sum, c) => {
      return sum + c.messages.filter(m => m.senderId !== userId && !m.isRead).length
    }, 0)
  }

  // ── ORDER QUERIES ─────────────────────────────────────────────────────────
  const getOrdersByBuyer  = (buyerId)  => orders.filter(o => o.buyerId  === buyerId)
  const getOrdersBySeller = (sellerId) => orders.filter(o => o.sellerId === sellerId)
  const getAllOrders       = ()         => [...orders].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt))
  const getOrderById      = (id)       => orders.find(o => o.orderId === id) || null

  const isOverdue = (order) => {
    if (order.status !== 'paid') return false
    const paid = new Date(order.paidAt)
    const now  = new Date()
    return (now - paid) > 48 * 60 * 60 * 1000
  }

  /**
   * Cek apakah produk sudah terjual (ada order aktif atau selesai).
   * Status yang dianggap "terjual/tidak bisa dibeli lagi":
   *   paid | processing | shipped | delivered | completed
   * Status cancelled → produk bisa dibeli lagi.
   */
  const isProductSold = (productId) => {
    const SOLD_STATUSES = ['paid', 'processing', 'shipped', 'delivered', 'completed']
    return orders.some(o => o.productId === productId && SOLD_STATUSES.includes(o.status))
  }
  // ── ESCROW / DANA QUERIES ─────────────────────────────────────────────────
  /** Total dana yang sedang ditahan di escrow (status paid/processing/shipped) */
  const getEscrowBalance = () => {
    const HOLDING_STATUSES = ['paid', 'processing', 'shipped']
    return orders
      .filter(o => HOLDING_STATUSES.includes(o.status))
      .reduce((sum, o) => sum + (o.price || 0), 0)
  }

  /** Total komisi platform yang sudah terkumpul */
  const getAdminWalletBalance = () => {
    return load(ADMIN_WALLET_KEY, { balance: 0 }).balance || 0
  }

  /** Riwayat komisi admin */
  const getAdminWalletHistory = () => {
    return load(ADMIN_WALLET_KEY, { history: [] }).history || []
  }

  return (
    <OrderContext.Provider value={{
      orders, notifications, chats,
      PLATFORM_FEE_PERCENT,
      calcFundSplit,
      // order actions
      createOrder, confirmPayment, rejectPayment,
      processOrder, rejectOrder, shipOrder,
      confirmDelivery, releaseFund,
      // notif
      addNotif, markNotifRead, markAllRead,
      getUserNotifs, getUnreadCount,
      // chat
      getOrCreateConversation, sendMessage,
      getConversation, getSellerConversations,
      getBuyerConversations, markChatRead,
      getUnreadChatCount,
      // queries
      getOrdersByBuyer, getOrdersBySeller,
      getAllOrders, getOrderById, isOverdue, isProductSold,
      // escrow / dana
      getEscrowBalance, getAdminWalletBalance, getAdminWalletHistory,
    }}>
      {children}
    </OrderContext.Provider>
  )
}

export function useOrders() {
  return useContext(OrderContext)
}
