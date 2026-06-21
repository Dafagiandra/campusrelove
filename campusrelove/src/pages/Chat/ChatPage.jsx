import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOrders } from '../../context/OrderContext'
import styles from './ChatPage.module.css'
import { SafeMap, TileLayer, Marker, useMapEvents } from '../../components/Map/LeafletMap'

function getOtherUser(conv, userId) {
  try {
    const users = JSON.parse(localStorage.getItem('cr_users') || '[]')
    const otherId = userId === conv.buyerId ? conv.sellerId : conv.buyerId
    const found = users.find(u => u.id === otherId)
    if (found) return found
    // Fallback: check session storage for current user info stored during this session
    return null
  } catch { return null }
}

// Get display name for the other party — prefer real name from users store
function getOtherName(conv, userId) {
  const other = getOtherUser(conv, userId)
  if (other?.name) return other.name
  // Fallback to stored names in conversation if available
  if (userId === conv.buyerId) return conv.sellerName || 'Penjual'
  return conv.buyerName || 'Pembeli'
}

const ORDER_STATUS = {
  pending_payment: { label: '⏳ Menunggu Validasi', color: '#F59E0B', bg: '#FEF3C7' },
  paid:            { label: '🔒 Escrow Aktif',      color: '#2563EB', bg: '#DBEAFE' },
  processing:      { label: '📦 Diproses',          color: '#7C3AED', bg: '#EDE9FE' },
  shipped:         { label: '🚚 Dikirim',           color: '#059669', bg: '#D1FAE5' },
  delivered:       { label: '📬 Diterima',          color: '#10B981', bg: '#D1FAE5' },
  completed:       { label: '🎉 Selesai',           color: '#065f46', bg: '#D1FAE5' },
  cancelled:       { label: '❌ Dibatalkan',        color: '#DC2626', bg: '#FEE2E2' },
}

// ── Map click handler ──────────────────────────────────────────────────────────
function MapClickHandler({ onMapClick }) {
  useMapEvents({ click(e) { onMapClick(e.latlng.lat, e.latlng.lng) } })
  return null
}

// ── Meetup Proposal Card ───────────────────────────────────────────────────────
function MeetupProposalCard({ msg, conv, userId, onAccept, onReject }) {
  let data = null
  try {
    data = JSON.parse(msg.text.replace('📍 [MEETUP_PROPOSAL] ', ''))
  } catch { return <div className={styles.bubble}>{msg.text}</div> }

  const isProposer = data.proposedBy === userId
  const isMine = msg.senderId === userId
  const other = getOtherUser(conv, userId)

  return (
    <div className={`${styles.msgRow} ${isMine ? styles.msgRowMine : ''}`}>
      {!isMine && (
        <div className={styles.msgAvatar}>{(other?.name || 'P').charAt(0).toUpperCase()}</div>
      )}
      <div className={styles.meetupProposalCard}>
        <div className={styles.meetupProposalHeader}>📍 Usulan Titik Temu</div>
        {data.lat && (
          <div style={{ height: 130, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
            <SafeMap
              height={130}
              center={[data.lat, data.lng]} zoom={15}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[data.lat, data.lng]} />
            </SafeMap>
          </div>
        )}
        <div className={styles.meetupProposalName}>{data.name || `${data.lat?.toFixed(4)}, ${data.lng?.toFixed(4)}`}</div>
        <div className={styles.meetupProposalBy}>Diusulkan: <strong>{isProposer ? 'Kamu' : (other?.name || 'Lawan bicara')}</strong></div>
        {!isProposer ? (
          <div className={styles.meetupProposalActions}>
            <button className={styles.btnAccept} onClick={() => onAccept(data)}>✅ Setuju</button>
            <button className={styles.btnRejectSmall} onClick={() => onReject(data)}>❌ Tolak</button>
          </div>
        ) : (
          <div className={styles.meetupProposalWaiting}>⏳ Menunggu persetujuan...</div>
        )}
        <span className={styles.msgTime}>
          {new Date(msg.sentAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

// ── Meetup Planner Modal ───────────────────────────────────────────────────────
function MeetupPlannerModal({ onClose, onSend, userId }) {
  const [pinLat, setPinLat] = useState(null)
  const [pinLng, setPinLng] = useState(null)
  const [pinName, setPinName] = useState('')

  const handleMapClick = useCallback((lat, lng) => { setPinLat(lat); setPinLng(lng) }, [])

  const handleSend = () => {
    if (pinLat === null) return
    const name = pinName.trim() || `${pinLat.toFixed(4)}, ${pinLng.toFixed(4)}`
    onSend(`📍 [MEETUP_PROPOSAL] ${JSON.stringify({ lat: pinLat, lng: pinLng, name, proposedBy: userId })}`)
    onClose()
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>📍 Usulkan Titik Temu</span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <p className={styles.modalDesc}>Klik peta untuk pin lokasi, lalu kirim ke lawan bicara</p>

        <div style={{ height: 260, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
          <SafeMap height={260} center={[-6.2, 106.8]} zoom={12} interactive={true}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapClickHandler onMapClick={handleMapClick} />
            {pinLat !== null && <Marker position={[pinLat, pinLng]} />}
          </SafeMap>
        </div>

        {pinLat !== null && (
          <p className={styles.modalPinInfo}>
            📍 <strong>{pinLat.toFixed(5)}, {pinLng.toFixed(5)}</strong>
          </p>
        )}

        <input
          className={styles.modalInput}
          placeholder="Nama lokasi (misal: Indomaret Margonda)..."
          value={pinName}
          onChange={e => setPinName(e.target.value)}
        />

        <div className={styles.modalActions}>
          <button className={styles.btnPrimarySmall} onClick={handleSend} disabled={pinLat === null}>
            📤 Kirim Usul Lokasi
          </button>
          <button className={styles.btnOutlineSmall} onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  )
}

// ── Order Status Card in Chat ──────────────────────────────────────────────────
function OrderStatusCard({ conv, userId, userRole }) {
  const { orders, processOrder, confirmDelivery, confirmCOD } = useOrders()
  const order = orders.find(o =>
    o.productId === conv.productId &&
    ((o.buyerId === conv.buyerId && o.sellerId === conv.sellerId))
  )
  if (!order || order.status === 'completed' || order.status === 'cancelled') return null

  const st = ORDER_STATUS[order.status] || ORDER_STATUS.pending_payment
  const isCOD = order.paymentMethod === 'cod'

  let meetupName = null
  try {
    if (order.meetupPoint) {
      const p = JSON.parse(order.meetupPoint)
      meetupName = p.name
    }
  } catch { meetupName = order.meetupPoint }

  return (
    <div className={styles.orderStatusCard}>
      <div className={styles.orderStatusLeft}>
        <span className={styles.orderStatusBadge} style={{ color: st.color, background: st.bg }}>
          {st.label}
        </span>
        <span className={styles.orderStatusProduct}>📦 {order.productTitle}</span>
        {meetupName && <span className={styles.orderStatusMeetup}>📍 {meetupName}</span>}
        {isCOD && <span className={styles.codTag}>🤝 COD</span>}
      </div>
      <div className={styles.orderStatusActions}>
        {userRole === 'seller' && order.status === 'paid' && (
          <button className={styles.orderActionBtn} onClick={() => processOrder(order.orderId)}>
            ▶️ Proses
          </button>
        )}
        {userRole === 'seller' && isCOD && order.status === 'processing' && (
          <button className={styles.orderActionBtnGreen} onClick={() => confirmCOD(order.orderId)}>
            ✅ COD Selesai
          </button>
        )}
        {userRole === 'buyer' && !isCOD && order.status === 'shipped' && (
          <button className={styles.orderActionBtnGreen} onClick={() => confirmDelivery(order.orderId)}>
            ✅ Terima
          </button>
        )}
      </div>
    </div>
  )
}

// ── Conversation List ──────────────────────────────────────────────────────────
function ConversationList({ conversations, activeId, onSelect, userId }) {
  return (
    <div className={styles.convList}>
      <div className={styles.convListHeader}>💬 Percakapan</div>
      {conversations.length === 0 && (
        <div className={styles.convEmpty}>Belum ada percakapan</div>
      )}
      {conversations.map(conv => {
        const unread = conv.messages.filter(m => m.senderId !== userId && !m.isRead).length
        const last = conv.messages[conv.messages.length - 1]
        const other = getOtherUser(conv, userId)
        const otherName = getOtherName(conv, userId)

        return (
          <button
            key={conv.conversationId}
            className={`${styles.convItem} ${activeId === conv.conversationId ? styles.convItemActive : ''}`}
            onClick={() => onSelect(conv.conversationId)}
          >
            <div className={styles.convAvatar}>
              {otherName.charAt(0).toUpperCase()}
            </div>
            <div className={styles.convInfo}>
              <div className={styles.convName}>{otherName}</div>
              <div className={styles.convProduct}>{conv.productTitle}</div>
              {last && (
                <div className={styles.convLast}>
                  {last.senderId === 'system' ? '🔔 ' : ''}
                  {last.text.startsWith('📍 [MEETUP_PROPOSAL]') ? '📍 Usul titik temu...' : last.text.slice(0, 40)}
                  {last.text.length > 40 && !last.text.startsWith('📍 [MEETUP_PROPOSAL]') ? '...' : ''}
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

// ── Chat Window ────────────────────────────────────────────────────────────────
function ChatWindow({ conversationId, userId, userRole }) {
  const { getConversation, sendMessage, markChatRead, updateOrderMeetup, orders } = useOrders()
  const [text, setText] = useState('')
  const bottomRef = useRef(null)
  const [conv, setConv] = useState(null)
  const [showMeetupPlanner, setShowMeetupPlanner] = useState(false)

  const refreshConv = useCallback(() => {
    const c = getConversation(conversationId)
    setConv(c)
    if (c) markChatRead(conversationId, userId)
  }, [conversationId, userId, getConversation, markChatRead])

  useEffect(() => { refreshConv() }, [refreshConv])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [conv?.messages?.length])

  const handleSend = () => {
    if (!text.trim()) return
    sendMessage(conversationId, userId, text.trim())
    setText('')
    setTimeout(refreshConv, 50)
  }

  const handleMeetupSend = (proposalText) => {
    sendMessage(conversationId, userId, proposalText)
    setTimeout(refreshConv, 50)
  }

  const handleAcceptMeetup = (data) => {
    sendMessage(conversationId, 'system', `📍 Titik temu disepakati: ${data.name}`)
    if (conv) {
      const order = orders.find(o =>
        o.productId === conv.productId &&
        o.buyerId === conv.buyerId && o.sellerId === conv.sellerId
      )
      if (order) updateOrderMeetup(order.orderId, JSON.stringify({ lat: data.lat, lng: data.lng, name: data.name }))
    }
    setTimeout(refreshConv, 50)
  }

  const handleRejectMeetup = (data) => {
    sendMessage(conversationId, 'system', `❌ Usulan titik temu "${data.name}" ditolak.`)
    setTimeout(refreshConv, 50)
  }

  if (!conv) return <div className={styles.chatEmpty}>Pilih percakapan</div>

  const other = getOtherUser(conv, userId)
  const otherName = getOtherName(conv, userId)

  return (
    <div className={styles.chatWindow}>
      {/* Header */}
      <div className={styles.chatHeader}>
        <div className={styles.chatHeaderAvatar}>{otherName.charAt(0).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div className={styles.chatHeaderName}>{otherName}</div>
          <div className={styles.chatHeaderProduct}>📦 {conv.productTitle}</div>
        </div>
        <button className={styles.refreshBtn} onClick={refreshConv} title="Refresh">🔄</button>
      </div>

      {/* Order Status Card */}
      <OrderStatusCard conv={conv} userId={userId} userRole={userRole} />

      {/* Messages */}
      <div className={styles.messages}>
        {conv.messages.map(msg => {
          if (msg.senderId === 'system') {
            return <div key={msg.messageId} className={styles.systemMsg}>{msg.text}</div>
          }

          if (msg.text?.startsWith('📍 [MEETUP_PROPOSAL]')) {
            return (
              <MeetupProposalCard
                key={msg.messageId}
                msg={msg} conv={conv} userId={userId}
                onAccept={handleAcceptMeetup}
                onReject={handleRejectMeetup}
              />
            )
          }

          const isMine = msg.senderId === userId
          return (
            <div key={msg.messageId} className={`${styles.msgRow} ${isMine ? styles.msgRowMine : ''}`}>
              {!isMine && <div className={styles.msgAvatar}>{otherName.charAt(0).toUpperCase()}</div>}
              <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleOther}`}>
                {msg.text}
                <span className={styles.msgTime}>
                  {new Date(msg.sentAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Toolbar */}
      <div className={styles.chatToolbar}>
        <button className={styles.meetupPlannerBtn} onClick={() => setShowMeetupPlanner(true)}>
          📍 Usul Titik Temu
        </button>
      </div>

      {/* Input */}
      <div className={styles.chatInputRow}>
        <input
          className={styles.chatInput}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Tulis pesan... (Enter untuk kirim)"
        />
        <button className={styles.sendBtn} onClick={handleSend} disabled={!text.trim()}>➤</button>
      </div>

      {showMeetupPlanner && (
        <MeetupPlannerModal
          onClose={() => setShowMeetupPlanner(false)}
          onSend={handleMeetupSend}
          userId={userId}
        />
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { user } = useAuth()
  const { getSellerConversations, getBuyerConversations } = useOrders()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeConv, setActiveConv] = useState(searchParams.get('conv') || null)

  if (!user) {
    return (
      <div className={styles.center}>
        <div className={styles.centerIcon}>🔐</div>
        <h2>Login dulu yuk!</h2>
        <button className={styles.btnPrimary} onClick={() => navigate('/auth', { state: { mode: 'login' } })}>
          Login Sekarang
        </button>
      </div>
    )
  }

  // Get ALL conversations where user is buyer OR seller
  const allChats = (() => {
    try {
      const all = JSON.parse(localStorage.getItem('cr_chats') || '[]')
      const filtered = all.filter(c => c.buyerId === user.id || c.sellerId === user.id)
      return filtered.sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt))
    } catch { return [] }
  })()

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.pageTitle}>💬 Pesan</h1>
        <div className={styles.layout}>
          <ConversationList
            conversations={allChats}
            activeId={activeConv}
            onSelect={setActiveConv}
            userId={user.id}
          />
          <div className={styles.chatArea}>
            {activeConv ? (
              <ChatWindow
                key={activeConv}
                conversationId={activeConv}
                userId={user.id}
                userRole={user.role}
              />
            ) : (
              <div className={styles.chatEmpty}>
                <div className={styles.chatEmptyIcon}>💬</div>
                <p>Pilih percakapan di sebelah kiri</p>
                {allChats.length === 0 && (
                  <p className={styles.chatEmptyHint}>
                    Chat akan muncul setelah ada pesanan atau klik "Chat Penjual" di halaman produk
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
