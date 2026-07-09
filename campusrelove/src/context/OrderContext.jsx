import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { orderAPI, userAPI, chatAPI, isBackendAvailable } from '../services/api'
import { useAuth } from './AuthContext'

const OrderContext = createContext(null)

const CHATS_KEY        = 'cr_chats'
const ADMIN_WALLET_KEY = 'cr_admin_wallet'
const PLATFORM_FEE_PERCENT = 0  // Pemasukan dari biaya listing, bukan komisi transaksi

const loadLS  = (key, fallback = []) => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) }
  catch { return fallback }
}
const saveLS = (key, data) => localStorage.setItem(key, JSON.stringify(data))

const calcFundSplit = (price) => {
  const platformFee  = Math.round(price * PLATFORM_FEE_PERCENT / 100)
  const sellerAmount = price - platformFee
  return { platformFee, sellerAmount }
}

const mapOrder = (o) => ({
  orderId:            o.id            ?? o.orderId,
  buyerId:            o.buyer_id      ?? o.buyerId,
  buyerName:          o.buyer_name    ?? o.buyerName    ?? '',
  sellerId:           o.seller_id     ?? o.sellerId,
  productId:          o.product_id    ?? o.productId,
  productTitle:       o.product_title ?? o.productTitle ?? '',
  price:              Number(o.price) || 0,
  platformFeePercent: Number(o.platform_fee_percent ?? o.platformFeePercent ?? PLATFORM_FEE_PERCENT),
  platformFee:        Number(o.platform_fee  ?? o.platformFee  ?? 0),
  sellerAmount:       Number(o.seller_amount ?? o.sellerAmount ?? 0),
  escrowStatus:       o.escrow_status ?? o.escrowStatus ?? 'holding',
  status:             o.status,
  meetupPoint:        o.meetup_point  ?? o.meetupPoint  ?? null,
  paymentMethod:      o.payment_method ?? o.paymentMethod ?? 'transfer_escrow',
  isOfflinePayment:   Boolean(o.is_offline_payment ?? o.isOfflinePayment ?? false),
  resi:               o.resi          ?? null,
  codSchedule:        o.cod_schedule  ?? o.codSchedule  ?? null,
  cancelReason:       o.cancel_reason ?? o.cancelReason ?? null,
  cancelledBy:        o.cancelled_by  ?? o.cancelledBy  ?? null,
  createdAt:          o.created_at    ?? o.createdAt,
  paidAt:             o.paid_at       ?? o.paidAt       ?? null,
  processedAt:        o.processed_at  ?? o.processedAt  ?? null,
  shippedAt:          o.shipped_at    ?? o.shippedAt    ?? null,
  deliveredAt:        o.delivered_at  ?? o.deliveredAt  ?? null,
  completedAt:        o.completed_at  ?? o.completedAt  ?? null,
  cancelledAt:        o.cancelled_at  ?? o.cancelledAt  ?? null,
})

const mapNotif = (n) => ({
  notifId:     n.id           ?? n.notifId,
  recipientId: n.recipient_id ?? n.recipientId,
  type:        n.type,
  message:     n.message,
  orderId:     n.order_id     ?? n.orderId ?? null,
  isRead:      Boolean(n.is_read ?? n.isRead),
  createdAt:   n.created_at   ?? n.createdAt,
})

export function OrderProvider({ children }) {
  const { user } = useAuth()

  const [orders,        setOrders]        = useState([])
  const [notifications, setNotifications] = useState([])
  const [chats,         setChats]         = useState(() => loadLS(CHATS_KEY))
  const loadedRef = useRef(false)

  const fetchOrders = useCallback(async () => {
    if (!user) return
    try {
      const data = user.role === 'admin' ? await orderAPI.getAll() : await orderAPI.getMy()
      if (data.success) setOrders(data.orders.map(mapOrder))
    } catch { /* offline mode */ }
  }, [user])

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    try {
      const data = await userAPI.getNotifications()
      if (data.success) setNotifications(data.notifications.map(mapNotif))
    } catch { /* offline */ }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchOrders()
      fetchNotifications()
      loadedRef.current = true
    } else {
      setOrders([])
      setNotifications([])
      loadedRef.current = false
    }
  }, [user, fetchOrders, fetchNotifications])

  const persistChats = (list) => { setChats(list); saveLS(CHATS_KEY, list) }

  const addSystemChatMsg = (conversationId, text) => {
    const current = loadLS(CHATS_KEY)
    const idx = current.findIndex(c => c.conversationId === conversationId)
    if (idx === -1) return
    current[idx].messages.push({
      messageId: `m${Date.now()}`,
      senderId:  'system',
      text,
      sentAt:    new Date().toISOString(),
      isRead:    true,
    })
    persistChats(current)
  }

  // ── ORDER ACTIONS ──────────────────────────────────────────────────────────

  const createOrder = async ({ buyerId, buyerName, sellerId, productId, productTitle, price, meetupPoint, paymentMethod, isOfflinePayment }) => {
    try {
      const data = await orderAPI.create({
        productId,
        meetupPoint: meetupPoint || null,
        paymentMethod: paymentMethod || 'transfer_escrow',
        isOfflinePayment: Boolean(isOfflinePayment),
      })
      if (data.success) {
        const mapped = {
          ...mapOrder(data.order),
          paymentMethod: paymentMethod || 'transfer_escrow',
          isOfflinePayment: Boolean(isOfflinePayment),
        }
        setOrders(prev => [mapped, ...prev])
        await fetchNotifications()

        // ── Auto-create conversation via API ─────────────────────────────────
        try {
          if (isBackendAvailable()) {
            await chatAPI.getOrCreate({ buyerId, sellerId, productId, productTitle })
          } else {
            const current = loadLS(CHATS_KEY)
            const existing = current.find(c => c.buyerId === buyerId && c.sellerId === sellerId && c.productId === productId)
            if (!existing) {
              const storedUsers = (() => { try { return JSON.parse(localStorage.getItem('cr_users') || '[]') } catch { return [] } })()
              const buyerUser  = storedUsers.find(u => u.id === buyerId)
              const sellerUser = storedUsers.find(u => u.id === sellerId)
              const conv = { conversationId: `conv_${Date.now()}`, buyerId, sellerId, productId, productTitle, buyerName: buyerUser?.name || buyerName || 'Pembeli', sellerName: sellerUser?.name || 'Penjual', messages: [{ messageId: `m${Date.now()}`, senderId: 'system', text: `🛍️ Pesanan dibuat untuk "${productTitle}" — Rp ${price.toLocaleString('id-ID')}.`, sentAt: new Date().toISOString(), isRead: false }], createdAt: new Date().toISOString() }
              persistChats([conv, ...current])
            }
          }
        } catch { /* ignore */ }

        return mapped
      }
      throw new Error(data.message || 'Gagal membuat pesanan')
    } catch (err) { throw err }
  }

  const confirmPayment = async (orderId) => {
    try { await orderAPI.confirmPayment(orderId); await fetchOrders(); await fetchNotifications() }
    catch (err) { throw err }
  }

  const rejectPayment = async (orderId, reason = 'Pembayaran tidak valid') => {
    try { await orderAPI.cancel(orderId, reason); await fetchOrders(); await fetchNotifications() }
    catch (err) { throw err }
  }

  const processOrder = async (orderId) => {
    try {
      await orderAPI.process(orderId)
      await fetchOrders()
      await fetchNotifications()
      const o = orders.find(x => x.orderId === orderId)
      if (o) {
        const conv = loadLS(CHATS_KEY).find(c => c.productId === o.productId && c.buyerId === o.buyerId)
        if (conv) addSystemChatMsg(conv.conversationId, '📦 Penjual sedang memproses pesanan.')
      }
    } catch (err) { throw err }
  }

  const rejectOrder = async (orderId, reason = 'Stok habis') => {
    try { await orderAPI.cancel(orderId, reason); await fetchOrders(); await fetchNotifications() }
    catch (err) { throw err }
  }

  const shipOrder = async (orderId, { method, resi, codSchedule } = {}) => {
    try {
      await orderAPI.ship(orderId, { resi: resi || null, codSchedule: codSchedule || null })
      await fetchOrders()
      await fetchNotifications()
      const o = orders.find(x => x.orderId === orderId)
      if (o) {
        const detail = method === 'cod' ? `COD dijadwalkan: ${codSchedule}` : `No. Resi: ${resi}`
        const conv = loadLS(CHATS_KEY).find(c => c.productId === o.productId && c.buyerId === o.buyerId)
        if (conv) addSystemChatMsg(conv.conversationId, `🚚 Barang dikirim. ${detail}`)
      }
    } catch (err) { throw err }
  }

  const confirmDelivery = async (orderId) => {
    try {
      await orderAPI.confirmDelivery(orderId)
      await fetchOrders()
      await fetchNotifications()
      const o = orders.find(x => x.orderId === orderId)
      if (o) {
        const conv = loadLS(CHATS_KEY).find(c => c.productId === o.productId && c.buyerId === o.buyerId)
        if (conv) addSystemChatMsg(conv.conversationId, `🎉 Transaksi selesai! Dana sudah dicairkan ke penjual.`)
      }
    } catch (err) { throw err }
  }

  const releaseFund = (orderId) => confirmDelivery(orderId)

  const confirmCOD = async (orderId) => {
    try {
      await orderAPI.confirmDelivery(orderId)
      await fetchOrders()
      await fetchNotifications()
      const o = orders.find(x => x.orderId === orderId)
      if (o) {
        const conv = loadLS(CHATS_KEY).find(c => c.productId === o.productId && c.buyerId === o.buyerId)
        if (conv) addSystemChatMsg(conv.conversationId, `🎉 COD selesai! Transaksi berhasil. Komisi platform 2% tercatat.`)
      }
    } catch (err) { throw err }
  }

  const updateOrderMeetup = (orderId, meetupPoint) => {
    setOrders(prev => prev.map(o => o.orderId === orderId ? { ...o, meetupPoint } : o))
  }

  const submitComplaint = async (orderId, reason, description) => {
    try {
      await orderAPI.complain(orderId, { reason, description })
      await fetchNotifications()
      return true
    } catch (err) { throw err }
  }

  const cancelOrder = async (orderId, reason, cancelledBy = 'buyer') => {
    try {
      await orderAPI.cancel(orderId, reason)
      await fetchOrders()
      await fetchNotifications()
      const o = orders.find(x => x.orderId === orderId)
      if (o) {
        const conv = loadLS(CHATS_KEY).find(c => c.productId === o.productId && c.buyerId === o.buyerId)
        const byLabel = cancelledBy === 'seller' ? 'Penjual' : 'Pembeli'
        if (conv) addSystemChatMsg(conv.conversationId, `❌ Pesanan dibatalkan oleh ${byLabel}. Alasan: ${reason || 'Tidak disebutkan'}`)
      }
      return true
    } catch { return false }
  }

  // ── NOTIFICATIONS ──────────────────────────────────────────────────────────

  const addNotif = async () => { await fetchNotifications() }

  const markNotifRead = async (notifId) => {
    setNotifications(prev => prev.map(n => n.notifId === notifId ? { ...n, isRead: true } : n))
    try { await userAPI.markRead(notifId) } catch { /* ignore */ }
  }

  const markAllRead = async (userId) => {
    setNotifications(prev => prev.map(n => n.recipientId === userId ? { ...n, isRead: true } : n))
    const unread = notifications.filter(n => n.recipientId === userId && !n.isRead)
    await Promise.allSettled(unread.map(n => userAPI.markRead(n.notifId)))
  }

  const getUserNotifs = (userId) =>
    notifications.filter(n => n.recipientId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const getUnreadCount = (userId) =>
    notifications.filter(n => n.recipientId === userId && !n.isRead).length

  // ── CHAT (localStorage) ────────────────────────────────────────────────────

  const getOrCreateConversation = (buyerId, sellerId, productId, productTitle) => {
    const current = loadLS(CHATS_KEY)
    const existing = current.find(c => c.buyerId === buyerId && c.sellerId === sellerId && c.productId === productId)
    if (existing) return existing

    const storedUsers = (() => { try { return JSON.parse(localStorage.getItem('cr_users') || '[]') } catch { return [] } })()
    const buyerUser  = storedUsers.find(u => u.id === buyerId)
    const sellerUser = storedUsers.find(u => u.id === sellerId)

    const conv = {
      conversationId: `conv_${Date.now()}`,
      buyerId, sellerId, productId, productTitle,
      buyerName:  buyerUser?.name  || 'Pembeli',
      sellerName: sellerUser?.name || 'Penjual',
      messages: [{
        messageId: `m${Date.now()}`,
        senderId:  'system',
        text:      `💬 Percakapan dimulai untuk produk "${productTitle}"`,
        sentAt:    new Date().toISOString(),
        isRead:    true,
      }],
      createdAt: new Date().toISOString(),
    }
    persistChats([conv, ...current])
    return conv
  }

  const sendMessage = (conversationId, senderId, text) => {
    const current = loadLS(CHATS_KEY)
    const idx = current.findIndex(c => c.conversationId === conversationId)
    if (idx === -1) return
    const msg = {
      messageId: `m${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
      senderId, text,
      sentAt: new Date().toISOString(),
      isRead: false,
    }
    current[idx].messages.push(msg)
    current[idx].lastMessageAt = msg.sentAt
    persistChats(current)

    // ── Analisis pesan & tambah pengingat halus ────────────────────────────
    const lc = text.toLowerCase()
    const hasPhone     = /(\b08\d{8,11}\b|\+62\d{8,11}\b|08[0-9]{8,11})/i.test(text)
    const hasPlatform  = /(whatsapp|wa\.me|telegram|instagram|tiktok|facebook|line|wa\s|tele\s|ig\s|\bfb\b|shopee|tokopedia)/i.test(lc)
    const hasMeetup    = /(ketemu|janjian|ketemuan|jemput|antar|cod|titik temu|lokasi|jam berapa|ketemunya|kesini|kesana)/i.test(lc)

    if ((hasPhone || hasPlatform) && senderId !== 'system') {
      setTimeout(() => {
        addSystemChatMsg(conversationId, '🔔 Untuk keamanan transaksi, kami menyarankan semua komunikasi tetap di dalam aplikasi. Nomor HP & kontak platform lain tidak perlu dibagikan di sini.')
      }, 300)
    } else if (hasMeetup && senderId !== 'system') {
      setTimeout(() => {
        addSystemChatMsg(conversationId, '📋 Pengingat: Pastikan pembayaran sudah diselesaikan lewat sistem aplikasi sebelum bertemu. Ini melindungi kamu dan penjual jika ada masalah.')
      }, 300)
    }

    return msg
  }

  const getConversation = (id) => loadLS(CHATS_KEY).find(c => c.conversationId === id) || null
  const getSellerConversations = (sellerId) =>
    loadLS(CHATS_KEY).filter(c => c.sellerId === sellerId)
      .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt))
  const getBuyerConversations = (buyerId) =>
    loadLS(CHATS_KEY).filter(c => c.buyerId === buyerId)
      .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt))

  const markChatRead = (conversationId, userId) => {
    const current = loadLS(CHATS_KEY)
    const idx = current.findIndex(c => c.conversationId === conversationId)
    if (idx === -1) return
    current[idx].messages = current[idx].messages.map(m =>
      m.senderId !== userId ? { ...m, isRead: true } : m
    )
    persistChats(current)
    setChats([...current])
  }

  const getUnreadChatCount = (userId) => {
    const convs = loadLS(CHATS_KEY).filter(c => c.buyerId === userId || c.sellerId === userId)
    return convs.reduce((sum, c) =>
      sum + c.messages.filter(m => m.senderId !== userId && !m.isRead).length, 0)
  }

  // ── QUERIES ────────────────────────────────────────────────────────────────

  const getOrdersByBuyer  = (buyerId)  => orders.filter(o => o.buyerId  === buyerId)
  const getOrdersBySeller = (sellerId) => orders.filter(o => o.sellerId === sellerId)
  const getAllOrders       = ()         => [...orders].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
  const getOrderById      = (id)       => orders.find(o => o.orderId === id) || null
  const isOverdue = (order) => order.status === 'paid' && (new Date() - new Date(order.paidAt)) > 48*60*60*1000
  const isProductSold = (productId) =>
    orders.some(o => o.productId === productId && ['paid','processing','shipped','delivered','completed'].includes(o.status))

  const isEscrowFlow = (pm) => pm === 'transfer_escrow' || pm === 'cod_escrow'

  const getEscrowBalance = () =>
    orders.filter(o => ['paid','processing','shipped'].includes(o.status) && isEscrowFlow(o.paymentMethod))
      .reduce((sum, o) => sum + (o.price || 0), 0)

  const getAdminWalletBalance = () => loadLS(ADMIN_WALLET_KEY, { balance: 0 }).balance || 0
  const getAdminWalletHistory = () => loadLS(ADMIN_WALLET_KEY, { history: [] }).history || []

  return (
    <OrderContext.Provider value={{
      orders, notifications, chats,
      PLATFORM_FEE_PERCENT, calcFundSplit,
      createOrder, confirmPayment, rejectPayment,
      processOrder, rejectOrder, shipOrder, cancelOrder, submitComplaint,
      confirmDelivery, releaseFund, confirmCOD, updateOrderMeetup,
      addNotif, markNotifRead, markAllRead,
      getUserNotifs, getUnreadCount,
      getOrCreateConversation, sendMessage,
      getConversation, getSellerConversations,
      getBuyerConversations, markChatRead, getUnreadChatCount,
      getOrdersByBuyer, getOrdersBySeller,
      getAllOrders, getOrderById, isOverdue, isProductSold,
      getEscrowBalance, getAdminWalletBalance, getAdminWalletHistory,
      refreshOrders: fetchOrders,
      refreshNotifications: fetchNotifications,
    }}>
      {children}
    </OrderContext.Provider>
  )
}

export function useOrders() {
  return useContext(OrderContext)
}
