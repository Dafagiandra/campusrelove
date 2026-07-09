/**
 * api.js — Frontend API service
 * Semua request ke backend melalui file ini.
 * Base URL diambil dari VITE_API_URL di .env
 */

const BASE_URL = import.meta.env.VITE_API_URL || ''

// Jika tidak ada API URL (GitHub Pages demo), return mock success
export const isBackendAvailable = () => Boolean(BASE_URL && BASE_URL.trim() !== '')

// ── Helper: fetch dengan token ────────────────────────────────────────────────
const getToken = () => localStorage.getItem('cr_token')

const request = async (method, endpoint, body = null) => {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const config = { method, headers }
  if (body) config.body = JSON.stringify(body)

  const res = await fetch(`${BASE_URL}${endpoint}`, config)
  const data = await res.json()

  // Handle 402 Payment Required (listing fee)
  if (res.status === 402 && data.requiresPayment) {
    const payErr = new Error(data.message || 'Biaya listing diperlukan')
    payErr.requiresPayment = true
    payErr.fee      = data.fee
    payErr.duration = data.duration || 30
    payErr.category = data.category
    throw payErr
  }

  if (!res.ok) {
    throw new Error(data.message || `HTTP error ${res.status}`)
  }
  return data
}

const get    = (endpoint)        => request('GET',    endpoint)
const post   = (endpoint, body)  => request('POST',   endpoint, body)
const put    = (endpoint, body)  => request('PUT',    endpoint, body)
const del    = (endpoint)        => request('DELETE', endpoint)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data)  => post('/auth/register', data),
  login:    (data)  => post('/auth/login', data),
  me:       ()      => get('/auth/me'),
  update:   (data)  => put('/auth/profile', data),
}

// ── Products ──────────────────────────────────────────────────────────────────
export const productAPI = {
  getAll:      (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return get(`/products${qs ? '?' + qs : ''}`)
  },
  getById:     (id)    => get(`/products/${id}`),
  getBySeller: (id, includeSold = false) => get(`/products/seller/${id}${includeSold ? '?includeSold=true' : ''}`),
  create:      (data)  => post('/products', data),
  delete:      (id)    => del(`/products/${id}`),
}

// ── Orders ────────────────────────────────────────────────────────────────────
export const orderAPI = {
  create:           (data)        => post('/orders', data),
  getMy:            ()            => get('/orders/my'),
  getAll:           ()            => get('/orders/all'),
  confirmPayment:   (id)          => put(`/orders/${id}/confirm-payment`),
  process:          (id)          => put(`/orders/${id}/process`),
  ship:             (id, data)    => put(`/orders/${id}/ship`, data),
  confirmDelivery:  (id)          => put(`/orders/${id}/confirm-delivery`),
  cancel:           (id, reason)  => put(`/orders/${id}/cancel`, { reason }),
  reject:           (id, reason)  => put(`/orders/${id}/cancel`, { reason, cancelledBy: 'seller' }),
  complain:         (id, data)    => post(`/orders/${id}/complain`, data),
  getAllComplaints:  ()            => get('/orders/complaints/all'),
  resolveComplaint: (id, data)    => put(`/orders/complaints/${id}/resolve`, data),
}

// ── Users / Admin ─────────────────────────────────────────────────────────────
export const userAPI = {
  getAll:         ()         => get('/users'),
  getPendingVerif:()         => get('/users/pending-verif'),
  approve:        (id)       => put(`/users/${id}/approve`),
  reject:         (id, note) => put(`/users/${id}/reject`, { note }),
  reverify:       (id, data) => put(`/users/${id}/reverify`, data),
  getNotifications: ()       => get('/users/notifications'),
  markRead:       (id)       => put(`/users/notifications/${id}/read`),
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export const chatAPI = {
  getConversations:  ()                      => get('/chat/conversations'),
  getOrCreate:       (data)                  => post('/chat/conversations', data),
  getMessages:       (convId)                => get(`/chat/conversations/${convId}/messages`),
  sendMessage:       (convId, text)          => post(`/chat/conversations/${convId}/messages`, { text }),
  getUnreadCount:    ()                      => get('/chat/unread-count'),
  sendSystemMessage: (convId, text)          => post('/chat/system-message', { conversationId: convId, text }),
}

// ── Listing Fees ──────────────────────────────────────────────────────────────
export const listingAPI = {
  getFees:        ()                    => get('/listing/fees'),
  getFeeFor:      (category)            => get(`/listing/fee-for/${category}`),
  getQuota:       ()                    => get('/listing/quota'),
  submitPayment:  (data)                => post('/listing/pay', data),
  renewListing:   (productId)           => post(`/listing/renew/${productId}`),
  checkExpiry:    ()                    => post('/listing/check-expiry', {}),
  // Admin
  updateFee:      (category, data)      => put(`/listing/fees/${category}`, data),
  getAllPayments:  ()                    => get('/listing/payments'),
  confirmPayment: (id)                  => put(`/listing/pay/${id}/confirm`),
  rejectPayment:  (id, note)            => put(`/listing/pay/${id}/reject`, { note }),
}

// ── Withdrawals ───────────────────────────────────────────────────────────────
export const withdrawalAPI = {
  getMy:     ()           => get('/withdrawals/my'),
  request:   (data)       => post('/withdrawals', data),
  // Admin
  getAll:    ()           => get('/withdrawals/all'),
  complete:  (id)         => put(`/withdrawals/${id}/complete`),
  reject:    (id, reason) => put(`/withdrawals/${id}/reject`, { reason }),
}

// ── Health Check ──────────────────────────────────────────────────────────────
export const checkHealth = () => get('/health')

export default { authAPI, productAPI, orderAPI, userAPI, listingAPI, checkHealth }
