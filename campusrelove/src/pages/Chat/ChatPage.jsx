import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { chatAPI, isBackendAvailable } from '../../services/api'
import { MapEmbed } from '../../components/Map/GoogleMapsEmbed'
import styles from './ChatPage.module.css'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getOtherName(conv, userId) {
  if (!conv) return '?'
  return userId === conv.buyer_id ? (conv.seller_name || 'Penjual') : (conv.buyer_name || 'Pembeli')
}
function getOtherAvatar(conv, userId) {
  if (!conv) return null
  return userId === conv.buyer_id ? conv.seller_avatar : conv.buyer_avatar
}

// ─── Meetup Proposal Card ────────────────────────────────────────────────────
function MeetupProposalCard({ msg, conv, userId }) {
  let data = null
  try { data = JSON.parse(msg.text.replace('📍 [MEETUP_PROPOSAL] ', '')) } catch { return <div className={styles.bubble}>{msg.text}</div> }
  const isProposer = (data.proposedBy === userId) || (msg.sender_id === userId)
  const name = data.name || `${data.lat?.toFixed(4)}, ${data.lng?.toFixed(4)}`
  return (
    <div className={`${styles.msgRow} ${isProposer ? styles.msgRowMine : ''}`}>
      {!isProposer && <div className={styles.msgAvatar}>{getOtherName(conv, userId).charAt(0)}</div>}
      <div className={styles.meetupProposalCard}>
        <div className={styles.meetupProposalHeader}>📍 Usulan Titik Temu</div>
        {data.lat && <div style={{ marginBottom: 10 }}><MapEmbed lat={data.lat} lng={data.lng} name={name} height={130} /></div>}
        <div className={styles.meetupProposalName}>{name}</div>
        <div className={styles.meetupProposalBy}>{isProposer ? 'Diusulkan oleh: Kamu' : `Diusulkan oleh: ${getOtherName(conv, userId)}`}</div>
        <span className={styles.msgTime}>{new Date(msg.sent_at || msg.sentAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  )
}

// ─── Meetup Planner Modal ────────────────────────────────────────────────────
function MeetupPlannerModal({ onClose, onSend, userId }) {
  const [locationName, setLocationName] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [gmapsLink, setGmapsLink] = useState('')
  const PRESETS = [
    { name: 'Mall Terdekat', lat: -6.2146, lng: 106.8451 },
    { name: 'Alfamart/Indomaret', lat: -6.2088, lng: 106.8456 },
    { name: 'Stasiun Kereta', lat: -6.1944, lng: 106.8229 },
    { name: 'Halte Bus/Busway', lat: -6.2297, lng: 106.8298 },
  ]
  const parseGmapsLink = (link) => {
    try {
      const atMatch = link.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/); if (atMatch) return { lat: atMatch[1], lng: atMatch[2] }
      const qMatch = link.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/); if (qMatch) return { lat: qMatch[1], lng: qMatch[2] }
    } catch { } return null
  }
  const handleSend = () => {
    if (!lat || !lng || !locationName.trim()) return
    onSend(`📍 [MEETUP_PROPOSAL] ${JSON.stringify({ lat: parseFloat(lat), lng: parseFloat(lng), name: locationName.trim(), proposedBy: userId })}`)
    onClose()
  }
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><span className={styles.modalTitle}>📍 Usulkan Titik Temu</span><button className={styles.modalClose} onClick={onClose}>✕</button></div>
        <p className={styles.modalDesc}>Pilih preset atau paste link Google Maps</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {PRESETS.map(p => (
            <button key={p.name} onClick={() => { setLat(p.lat.toString()); setLng(p.lng.toString()); setLocationName(p.name) }}
              style={{ padding: '5px 11px', background: lat === p.lat.toString() ? '#ede9fe' : '#f3f4f6', color: lat === p.lat.toString() ? '#7C3AED' : '#374151', border: lat === p.lat.toString() ? '1px solid #7C3AED' : '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}>
              {p.name}
            </button>
          ))}
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 7 }}>
            <input value={gmapsLink} onChange={e => setGmapsLink(e.target.value)} placeholder="https://maps.google.com/..."
              style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #e5e7eb', borderRadius: 9, fontSize: '0.82rem', fontFamily: 'Poppins,sans-serif', outline: 'none' }} />
            <button onClick={() => { const c = parseGmapsLink(gmapsLink); if (c) { setLat(c.lat); setLng(c.lng) } else alert('Link tidak terbaca.') }}
              style={{ padding: '8px 13px', background: '#2563EB', color: 'white', border: 'none', borderRadius: 9, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}>Ambil</button>
          </div>
          <p style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 3 }}>💡 Di Google Maps → cari lokasi → Bagikan → copy link</p>
        </div>
        <input className={styles.modalInput} placeholder="Nama lokasi (wajib)..." value={locationName} onChange={e => setLocationName(e.target.value)} />
        {lat && lng && <div style={{ marginBottom: 14 }}><MapEmbed lat={parseFloat(lat)} lng={parseFloat(lng)} name={locationName} height={200} /></div>}
        <div className={styles.modalActions}>
          <button className={styles.btnPrimarySmall} onClick={handleSend} disabled={!lat || !lng || !locationName.trim()}>📤 Kirim Usul Lokasi</button>
          <button className={styles.btnOutlineSmall} onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  )
}

// ─── Chat Window ─────────────────────────────────────────────────────────────
function ChatWindow({ convId, userId, userRole }) {
  const [messages, setMessages] = useState([])
  const [conv, setConv] = useState(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showMeetupPlanner, setShowMeetupPlanner] = useState(false)
  const bottomRef = useRef(null)
  const lastCountRef = useRef(0)

  const fetchMessages = useCallback(async () => {
    if (!convId) return
    try {
      if (isBackendAvailable()) {
        const data = await chatAPI.getMessages(convId)
        if (data.success) {
          setMessages(data.messages)
          setConv(data.conversation)
          // Auto scroll only if new messages arrived
          if (data.messages.length !== lastCountRef.current) {
            lastCountRef.current = data.messages.length
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          }
        }
      } else {
        // Offline fallback: read from localStorage
        const all = JSON.parse(localStorage.getItem('cr_chats') || '[]')
        const c = all.find(x => x.conversationId === convId)
        if (c) {
          setConv({ buyer_id: c.buyerId, seller_id: c.sellerId, buyer_name: c.buyerName, seller_name: c.sellerName, product_title: c.productTitle })
          setMessages(c.messages.map(m => ({ ...m, id: m.messageId, sender_id: m.senderId, sent_at: m.sentAt, is_read: m.isRead })))
        }
      }
    } catch { /* ignore */ }
  }, [convId])

  // Initial load + auto-polling every 4 seconds
  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 4000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  const handleSend = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      if (isBackendAvailable()) {
        await chatAPI.sendMessage(convId, text.trim())
      } else {
        // Offline fallback: write to localStorage
        const all = JSON.parse(localStorage.getItem('cr_chats') || '[]')
        const idx = all.findIndex(x => x.conversationId === convId)
        if (idx !== -1) {
          all[idx].messages.push({ messageId: `m${Date.now()}`, senderId: userId, text: text.trim(), sentAt: new Date().toISOString(), isRead: false })
          all[idx].lastMessageAt = new Date().toISOString()
          localStorage.setItem('cr_chats', JSON.stringify(all))
        }
      }
      setText('')
      await fetchMessages()
    } catch { /* ignore */ }
    setSending(false)
  }

  const handleMeetupSend = async (proposalText) => {
    try {
      if (isBackendAvailable()) await chatAPI.sendMessage(convId, proposalText)
      else {
        const all = JSON.parse(localStorage.getItem('cr_chats') || '[]')
        const idx = all.findIndex(x => x.conversationId === convId)
        if (idx !== -1) {
          all[idx].messages.push({ messageId: `m${Date.now()}`, senderId: userId, text: proposalText, sentAt: new Date().toISOString(), isRead: false })
          localStorage.setItem('cr_chats', JSON.stringify(all))
        }
      }
      await fetchMessages()
    } catch { /* ignore */ }
  }

  if (!convId) return <div className={styles.chatEmpty}><div className={styles.chatEmptyIcon}>💬</div><p>Pilih percakapan di sebelah kiri</p></div>

  const otherName = conv ? getOtherName(conv, userId) : '...'

  return (
    <div className={styles.chatWindow}>
      {/* Header */}
      <div className={styles.chatHeader}>
        <div className={styles.chatHeaderAvatar}>{otherName.charAt(0).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div className={styles.chatHeaderName}>{otherName}</div>
          {conv && <div className={styles.chatHeaderProduct}>📦 {conv.product_title}</div>}
        </div>
        <button className={styles.refreshBtn} onClick={fetchMessages} title="Refresh">🔄</button>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.map(msg => {
          if (msg.sender_id === 'system') return <div key={msg.id || msg.messageId} className={styles.systemMsg}>{msg.text}</div>
          if (msg.text?.startsWith('📍 [MEETUP_PROPOSAL]')) {
            return <MeetupProposalCard key={msg.id || msg.messageId} msg={msg} conv={conv} userId={userId} />
          }
          // Meetup schedule message — display as formatted card
          if (msg.text?.startsWith('📅 [MEETUP_SCHEDULE]')) {
            const lines = msg.text.replace('📅 [MEETUP_SCHEDULE] ', '').split('\n').filter(Boolean)
            const isMine = msg.sender_id === userId || msg.senderId === userId
            return (
              <div key={msg.id || msg.messageId} className={`${styles.msgRow} ${isMine ? styles.msgRowMine : ''}`}>
                {!isMine && <div className={styles.msgAvatar}>{otherName.charAt(0).toUpperCase()}</div>}
                <div style={{ background: '#eff6ff', border: '2px solid #bfdbfe', borderRadius: 14, padding: '12px 14px', maxWidth: 280 }}>
                  <div style={{ fontWeight: 700, color: '#1d4ed8', fontSize: '0.88rem', marginBottom: 6 }}>📅 Jadwal Meet-up Diusulkan</div>
                  {lines.map((l, i) => <div key={i} style={{ fontSize: '0.82rem', color: '#374151', marginBottom: 3 }}>{l}</div>)}
                  <span className={styles.msgTime}>{new Date(msg.sent_at || msg.sentAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            )
          }
          const isMine = msg.sender_id === userId || msg.senderId === userId
          return (
            <div key={msg.id || msg.messageId} className={`${styles.msgRow} ${isMine ? styles.msgRowMine : ''}`}>
              {!isMine && <div className={styles.msgAvatar}>{otherName.charAt(0).toUpperCase()}</div>}
              <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleOther}`}>
                {msg.text}
                <span className={styles.msgTime}>{new Date(msg.sent_at || msg.sentAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Toolbar */}
      <div className={styles.chatToolbar}>
        <button className={styles.meetupPlannerBtn} onClick={() => setShowMeetupPlanner(true)}>📍 Usul Titik Temu</button>
      </div>

      {/* Input */}
      <div className={styles.chatInputRow}>
        <input className={styles.chatInput} value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Tulis pesan... (Enter untuk kirim)" />
        <button className={styles.sendBtn} onClick={handleSend} disabled={!text.trim() || sending}>➤</button>
      </div>

      {showMeetupPlanner && <MeetupPlannerModal onClose={() => setShowMeetupPlanner(false)} onSend={handleMeetupSend} userId={userId} />}
    </div>
  )
}

// ─── Conversation List ────────────────────────────────────────────────────────
function ConversationList({ conversations, activeId, onSelect, userId }) {
  return (
    <div className={styles.convList}>
      <div className={styles.convListHeader}>💬 Percakapan</div>
      {conversations.length === 0 && <div className={styles.convEmpty}>Belum ada percakapan</div>}
      {conversations.map(conv => {
        const otherId = userId === conv.buyer_id ? conv.seller_id : conv.buyer_id
        const otherName = userId === conv.buyer_id ? (conv.seller_name || 'Penjual') : (conv.buyer_name || 'Pembeli')
        const unread = Number(conv.unread_count) || 0
        return (
          <button key={conv.id} className={`${styles.convItem} ${activeId === conv.id ? styles.convItemActive : ''}`} onClick={() => onSelect(conv.id)}>
            <div className={styles.convAvatar}>{otherName.charAt(0).toUpperCase()}</div>
            <div className={styles.convInfo}>
              <div className={styles.convName}>{otherName}</div>
              <div className={styles.convProduct}>{conv.product_title}</div>
              {conv.last_message && (
                <div className={styles.convLast}>
                  {conv.last_message.startsWith('📍 [MEETUP_PROPOSAL]') ? '📍 Usul titik temu...' : conv.last_message.slice(0, 40)}
                  {conv.last_message.length > 40 ? '...' : ''}
                </div>
              )}
            </div>
            {unread > 0 && <span className={styles.unreadBadge}>{unread}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initConv = searchParams.get('conv')
  const [activeConv, setActiveConv] = useState(initConv || null)
  const [conversations, setConversations] = useState([])

  const fetchConversations = useCallback(async () => {
    if (!user) return
    try {
      if (isBackendAvailable()) {
        const data = await chatAPI.getConversations()
        if (data.success) setConversations(data.conversations)
      } else {
        // Offline fallback: read from localStorage
        const all = JSON.parse(localStorage.getItem('cr_chats') || '[]')
        const mine = all.filter(c => c.buyerId === user.id || c.sellerId === user.id)
        setConversations(mine.map(c => ({
          id: c.conversationId,
          buyer_id: c.buyerId, seller_id: c.sellerId,
          buyer_name: c.buyerName, seller_name: c.sellerName,
          product_title: c.productTitle,
          last_message: c.messages?.[c.messages.length - 1]?.text,
          unread_count: c.messages?.filter(m => m.senderId !== user.id && !m.isRead).length || 0,
        })))
      }
    } catch { /* ignore */ }
  }, [user])

  useEffect(() => {
    fetchConversations()
    const interval = setInterval(fetchConversations, 8000)
    return () => clearInterval(interval)
  }, [fetchConversations])

  // Auto-select if conv param passed
  useEffect(() => {
    if (initConv && conversations.length > 0) {
      setActiveConv(initConv)
    }
  }, [initConv, conversations.length])

  if (!user) return (
    <div className={styles.center}>
      <div className={styles.centerIcon}>🔐</div>
      <h2>Login dulu yuk!</h2>
      <button className={styles.btnPrimary} onClick={() => navigate('/auth', { state: { mode: 'login' } })}>Login Sekarang</button>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.pageTitle}>💬 Pesan</h1>
        <div className={styles.layout}>
          <ConversationList conversations={conversations} activeId={activeConv} onSelect={setActiveConv} userId={user.id} />
          <div className={styles.chatArea}>
            {activeConv
              ? <ChatWindow key={activeConv} convId={activeConv} userId={user.id} userRole={user.role} />
              : (
                <div className={styles.chatEmpty}>
                  <div className={styles.chatEmptyIcon}>💬</div>
                  <p>Pilih percakapan di sebelah kiri</p>
                  {conversations.length === 0 && <p className={styles.chatEmptyHint}>Chat akan muncul setelah ada pesanan atau klik "Chat Penjual" di halaman produk</p>}
                </div>
              )
            }
          </div>
        </div>
      </div>
    </div>
  )
}
