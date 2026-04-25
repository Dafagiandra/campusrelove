import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOrders } from '../../context/OrderContext'
import styles from './ChatPage.module.css'

function getSellerInfo(sellerId) {
  try {
    const users = JSON.parse(localStorage.getItem('cr_users') || '[]')
    return users.find(u => u.id === sellerId) || null
  } catch { return null }
}
function getBuyerInfo(buyerId) {
  try {
    const users = JSON.parse(localStorage.getItem('cr_users') || '[]')
    return users.find(u => u.id === buyerId) || null
  } catch { return null }
}

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
        const otherName = userId === conv.buyerId
          ? (getSellerInfo(conv.sellerId)?.name || 'Penjual')
          : (getBuyerInfo(conv.buyerId)?.name || 'Pembeli')
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
                  {last.senderId === 'system' ? '🔔 ' : ''}{last.text.slice(0, 40)}{last.text.length > 40 ? '...' : ''}
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

function ChatWindow({ conversationId, userId, userName }) {
  const { getConversation, sendMessage, markChatRead } = useOrders()
  const [text, setText] = useState('')
  const bottomRef = useRef(null)
  const [conv, setConv] = useState(null)

  useEffect(() => {
    const c = getConversation(conversationId)
    setConv(c)
    if (c) markChatRead(conversationId, userId)
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conv?.messages?.length])

  const handleSend = () => {
    if (!text.trim()) return
    sendMessage(conversationId, userId, text.trim())
    setText('')
    // Refresh conv
    setTimeout(() => {
      const c = getConversation(conversationId)
      setConv(c)
    }, 50)
  }

  if (!conv) return <div className={styles.chatEmpty}>Pilih percakapan</div>

  const otherName = userId === conv.buyerId
    ? (getSellerInfo(conv.sellerId)?.name || 'Penjual')
    : (getBuyerInfo(conv.buyerId)?.name || 'Pembeli')

  return (
    <div className={styles.chatWindow}>
      {/* Header */}
      <div className={styles.chatHeader}>
        <div className={styles.chatHeaderAvatar}>{otherName.charAt(0).toUpperCase()}</div>
        <div>
          <div className={styles.chatHeaderName}>{otherName}</div>
          <div className={styles.chatHeaderProduct}>📦 {conv.productTitle}</div>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {conv.messages.map(msg => {
          if (msg.senderId === 'system') {
            return (
              <div key={msg.messageId} className={styles.systemMsg}>
                {msg.text}
              </div>
            )
          }
          const isMine = msg.senderId === userId
          return (
            <div key={msg.messageId} className={`${styles.msgRow} ${isMine ? styles.msgRowMine : ''}`}>
              {!isMine && (
                <div className={styles.msgAvatar}>{otherName.charAt(0).toUpperCase()}</div>
              )}
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

      {/* Input */}
      <div className={styles.chatInputRow}>
        <input
          className={styles.chatInput}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Tulis pesan... (Enter untuk kirim)"
        />
        <button className={styles.sendBtn} onClick={handleSend} disabled={!text.trim()}>
          ➤
        </button>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const { user } = useAuth()
  const { getSellerConversations, getBuyerConversations } = useOrders()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initConv = searchParams.get('conv')
  const [activeConv, setActiveConv] = useState(initConv || null)

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

  const conversations = user.role === 'seller'
    ? getSellerConversations(user.id)
    : getBuyerConversations(user.id)

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.pageTitle}>💬 Pesan</h1>
        <div className={styles.layout}>
          <ConversationList
            conversations={conversations}
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
                userName={user.name}
              />
            ) : (
              <div className={styles.chatEmpty}>
                <div className={styles.chatEmptyIcon}>💬</div>
                <p>Pilih percakapan di sebelah kiri</p>
                {conversations.length === 0 && (
                  <p className={styles.chatEmptyHint}>
                    Chat akan muncul saat kamu klik "Chat Penjual" di halaman produk
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
