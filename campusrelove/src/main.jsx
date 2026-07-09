import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)

// Global error handler for uncaught module errors
window.addEventListener('error', (e) => {
  const root = document.getElementById('root')
  if (root && !root.innerHTML.trim()) {
    root.innerHTML = `<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;font-family:sans-serif;background:#f8fafc">
      <div style="font-size:3rem">⚠️</div>
      <h2 style="color:#1a1a2e;margin:0">Terjadi Kesalahan</h2>
      <p style="color:#6b7280;font-size:0.9rem;max-width:400px;text-align:center;background:#fee2e2;padding:12px;border-radius:8px">${e.message || 'Unknown error'}</p>
      <button onclick="window.location.reload()" style="padding:12px 24px;background:#7C3AED;color:white;border:none;border-radius:12px;font-size:0.9rem;cursor:pointer">🔄 Muat Ulang</button>
    </div>`
  }
})
