/**
 * api.js — Frontend API service
 * Semua request ke backend melalui file ini.
 * Base URL diambil dari VITE_API_URL di .env
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

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
  getAll:     (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return get(`/products${qs ? '?' + qs : ''}`)
  },
  getById:    (id)    => get(`/products/${id}`),
  getBySeller:(id)    => get(`/products/seller/${id}`),
  create:     (data)  => post('/products', data),
  delete:     (id)    => del(`/products/${id}`),
}

// ── Orders ────────────────────────────────────────────────────────────────────
export const orderAPI = {
  create:          (data)        => post('/orders', data),
  getMy:           ()            => get('/orders/my'),
  getAll:          ()            => get('/orders/all'),
  confirmPayment:  (id)          => put(`/orders/${id}/confirm-payment`),
  process:         (id)          => put(`/orders/${id}/process`),
  ship:            (id, data)    => put(`/orders/${id}/ship`, data),
  confirmDelivery: (id)          => put(`/orders/${id}/confirm-delivery`),
  cancel:          (id, reason)  => put(`/orders/${id}/cancel`, { reason }),
  reject:          (id, reason)  => put(`/orders/${id}/cancel`, { reason, cancelledBy: 'seller' }),
}

// ── Users / Admin ─────────────────────────────────────────────────────────────
export const userAPI = {
  getAll:         ()         => get('/users'),
  getPendingVerif:()         => get('/users/pending-verif'),
  approve:        (id)       => put(`/users/${id}/approve`),
  reject:         (id, note) => put(`/users/${id}/reject`, { note }),
  getNotifications: ()       => get('/users/notifications'),
  markRead:       (id)       => put(`/users/notifications/${id}/read`),
}

// ── Health Check ──────────────────────────────────────────────────────────────
export const checkHealth = () => get('/health')

export default { authAPI, productAPI, orderAPI, userAPI, checkHealth }
