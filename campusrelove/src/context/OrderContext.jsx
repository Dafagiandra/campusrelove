import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { orderAPI, userAPI } from '../services/api'
import { useAuth } from './AuthContext'

const OrderContext = createContext(null)

// ── localStorage keys (chat still uses localStorage) ─────────────────────────
const CHATS_KEY        = 'cr_chats'
const ADMIN_WALLET_KEY = 'cr_admin_wallet'

// ── Platform fee constant ─────────────────────────────────────────────────────
const PLATFORM_FEE_PERCENT = 2

// ── helpers ───────────────────────────────────────────────────────────────────
const loadLS  = (key, fallback = []) => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) }
  catch { return fallback }
}
const saveLS = (key, data) => localStorage.setItem(key, JSON.stringify(data))

/** Calculate fund split (kept for UI display) */
const calcFundSplit = (price) => {
  const platformFee  = Math.round(price * PLATFORM_FEE_PERCENT / 100)
  const sellerAmount = price - platformFee
  return { platformFee, sellerAmount }
}

/** Map snake_case order row → camelCase */
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

/** Map snake_case notification row → camelCase */
const mapNotif = (n) => ({
  notifId:     n.id           ?? n.notifId,
  recipientId: n.recipient_id ?? n.recipientId,
  type:        n.type,
  message:     n.message,
  orderId:     n.order_id     ?? n.orderId ?? null,
  isRead:      Boolean(n.is_read ?? n.isRead),
  createdAt:   n.created_at   ?? n.createdAt,
})

// ── provider ──────────────────────────────────────────────────────────────────
export function OrderProvider({ children }) {
  const { user } = useAuth()

  const [orders,        setOrders]        = useState([])
  const [notifications, setNotifications] = useState([])
  const [chats,         setChats]         = useState(() => loadLS(CHATS_KEY))

  const loadedRef = useRef(false)

  // ── Fetch helpers ────────────────────────────────────────────────────────

  const fetchOrders = useCallback(async () => {
    if (!user) return
    try {
      let data
      if (user.role === 'admin') {
        data = await orderAPI.getAll()
      } else {
        data = await orderAPI.getMy()
      }
      if (data.success) setOrders(data.orders.map(mapOrder))
    } catch { /* silently ignore if backend offline */ }
  }, [user])

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    try {
      const data = await userAPI.getNotifications()
      if (data.success) setNotifications(data.notifications.map(mapNotif))
    } catch { /* silently ignore */ }
  }, [user])

  // Load on user change
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

  // ── Chat helpers (still localStorage) ───────────────────────────────────
  const persistChats = (list) => { setChats(list); saveLS(CHATS_KEY, list) }

  const addSystemChatMsg = (conversationId, text) => {
    const current = loadLS(CHATS_KEY)
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

  // ── ORDER ACTIONS ────────────────────────────────────────────────────────

  const createOrder = async ({ buyerId, buyerName, sellerId, productId, productTitle, price, meetupPoint }) => {
    try {
      const data = await orderAPI.create({ productId, meetupPoint: meetupPoint || null })
      if (data.success) {
        const mapped = mapOrder(data.order)
        setOrders((prev) => [mapped, ...prev])
        await fetchNotifications()
        return mapped
      }
      throw new Error(data.message || 'Gagal membuat pesanan')
    } catch (err) { throw err }
  }

  const confirmPayment = async (orderId) => {
    try {
      await orderAPI.confirmPayment(orderId)
      await fetchOrders()
      await fetchNotifications()
    } catch (err) { throw err }
  }

  const rejectPayment = async (orderId, reason = 'Pembayaran tidak valid') => {
    try {
      await orderAPI.cancel(orderId, reason)
      await fetchOrders()
      await fetchNotifications()
    } catch (err) { throw err }
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
    try {
      await orderAPI.cancel(orderId, reason)
      await fetchOrders()
      await fetchNotifications()
    } catch (err) { throw err }
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

  // ── NOTIFICATION ACTIONS ─────────────────────────────────────────────────

  const addNotif = async () => { await fetchNotifications() }

  const markNotifRead = async (notifId) => {
    setNotifications((prev) =>
      prev.map((n) => n.notifId === notifId ? { ...n, isRead: true } : n)
    )
    try { await userAPI.markRead(notifId) } catch { /* ignore */ }
  }

  const markAllRead = async (userId) => {
    setNotifications((prev) =>
      prev.map((n) => n.recipientId === userId ? { ...n, isRead: true } : n)
    )
    const unread = notifications.filter((n) => n.recipientId === userId && !n.isRead)
    await Promise.allSettled(unread.map((n) => userAPI.markRead(n.notifId)))
  }

  const getUserNotifs = (userId) =>
    notifications
      .filter((n) => n.recipientId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const getUnreadCount = (userId) =>
    notifications.filter((n) => n.recipientId === userId && !n.isRead).length

  // ── CHAT ACTIONS (localStorage) ──────────────────────────────────────────
  const getOrCreateConversation = (buyerId, sellerId, productId, productTitle) => {
    const current = loadLS(CHATS_KEY)
    const existing = current.find(
      (c) => c.buyerId === buyerId && c.sellerId === sellerId && c.productId === productId
    )
    if (existing) return existing
    const conv = {
      conversationId: `conv_${Date.now()}`,
      buyerId, sellerId, productId, productTitle,
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
    const idx = current.findIndex((c) => c.conversationId === conversationId)
    if (idx === -1) return
    const msg = {
      messageId: `m${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      senderId, text,
      sentAt:    new Date().toISOString(),
      isRead:    false,
    }
    current[idx].messages.push(msg)
    current[idx].lastMessageAt = msg.sentAt
    persistChats(current)
    return msg
  }

  const getConversation       = (id)       => loadLS(CHATS_KEY).find((c) => c.conversationId === id) || null
  const getSellerConversations = (sellerId) =>
    loadLS(CHATS_KEY).filter((c) => c.sellerId === sellerId)
      .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt))
  const getBuyerConversations = (buyerId) =>
    loadLS(CHATS_KEY).filter((c) => c.buyerId === buyerId)
      .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt))

  const markChatRead = (conversationId, userId) => {
    const current = loadLS(CHATS_KEY)
    const idx = current.findIndex((c) => c.conversationId === conversationId)
    if (idx === -1) return
    current[idx].messages = current[idx].messages.map((m) =>
      m.senderId !== userId ? { ...m, isRead: true } : m
    )
    persistChats(current)
    setChats([...current])
  }

  const getUnreadChatCount = (userId) => {
    const convs = loadLS(CHATS_KEY).filter((c) => c.buyerId === userId || c.sellerId === userId)
    return convs.reduce((sum, c) => sum + c.messages.filter((m) => m.senderId !== userId && !m.isRead).length, 0)
  }

  // ── ORDER QUERIES ────────────────────────────────────────────────────────
  const getOrdersByBuyer  = (buyerId)  => orders.filter((o) => o.buyerId  === buyerId)
  const getOrdersBySeller = (sellerId) => orders.filter((o) => o.sellerId === sellerId)
  const getAllOrders       = ()         => [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const getOrderById      = (id)       => orders.find((o) => o.orderId === id) || null

  const isOverdue = (order) => {
    if (order.status !== 'paid') return false
    return (new Date() - new Date(order.paidAt)) > 48 * 60 * 60 * 1000
  }

  const isProductSold = (productId) => {
    const SOLD_STATUSES = ['paid', 'processing', 'shipped', 'delivered', 'completed']
    return orders.some((o) => o.productId === productId && SOLD_STATUSES.includes(o.status))
  }

  // ── ESCROW / DANA QUERIES ────────────────────────────────────────────────
  const getEscrowBalance = () =>
    orders.filter((o) => ['paid','processing','shipped'].includes(o.status))
      .reduce((sum, o) => sum + (o.price || 0), 0)

  const getAdminWalletBalance = () => loadLS(ADMIN_WALLET_KEY, { balance: 0 }).balance || 0
  const getAdminWalletHistory = () => loadLS(ADMIN_WALLET_KEY, { history: [] }).history || []

  return (
    <OrderContext.Provider value={{
      orders, notifications, chats,
      PLATFORM_FEE_PERCENT,
      calcFundSplit,
      createOrder, confirmPayment, rejectPayment,
      processOrder, rejectOrder, shipOrder, cancelOrder,
      confirmDelivery, releaseFund,
      addNotif, markNotifRead, markAllRead,
      getUserNotifs, getUnreadCount,
      getOrCreateConversation, sendMessage,
      getConversation, getSellerConversations,
      getBuyerConversations, markChatRead,
      getUnreadChatCount,
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
