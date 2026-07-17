import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import api from '../services/api'
import { statusColor } from './TimelineList'
import styles from './FollowUpModal.module.css'

function Md({ children }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p:      (props) => <p style={{ margin: '0 0 6px 0', lineHeight: 1.55, fontSize: 12 }} {...props} />,
        ul:     (props) => <ul style={{ margin: '0 0 6px 0', paddingLeft: 18, fontSize: 12 }} {...props} />,
        ol:     (props) => <ol style={{ margin: '0 0 6px 0', paddingLeft: 18, fontSize: 12 }} {...props} />,
        li:     (props) => <li style={{ marginBottom: 3 }} {...props} />,
        strong: (props) => <strong style={{ fontWeight: 700 }} {...props} />,
        h3:     (props) => <h3 style={{ fontSize: 13, fontWeight: 700, margin: '10px 0 4px 0', color: 'var(--text-primary)' }} {...props} />,
        h4:     (props) => <h4 style={{ fontSize: 12, fontWeight: 700, margin: '7px 0 3px 0' }} {...props} />,
        table:  (props) => <div style={{ overflowX: 'auto', marginBottom: 8 }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }} {...props} /></div>,
        th:     (props) => <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '2px solid rgba(255,68,31,0.4)', color: '#FF441F', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }} {...props} />,
        td:     (props) => <td style={{ padding: '4px 6px', borderBottom: '1px solid rgba(128,128,128,0.12)', fontSize: 11, verticalAlign: 'top' }} {...props} />,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

export function HistoryTable({ items }) {
  if (!items.length) return (
    <div className={styles.emptyChat}>
      <span className={styles.emptyChatIcon}>📋</span>
      <p>Sin historial de gestión AGM-IA para esta tienda aún.</p>
    </div>
  )
  return (
    <div className={styles.histTableWrap}>
      <table className={styles.histTable}>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Status</th>
            <th>Agente</th>
            <th>Comentario</th>
            <th>Ticket</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const color = statusColor(item.status)
            const comentario = [
              item.comentarioInterno && `Interno: ${item.comentarioInterno}`,
              item.comentarioAliado && `Aliado: ${item.comentarioAliado}`,
            ].filter(Boolean).join(' · ') || '—'
            return (
              <tr key={i}>
                <td className={styles.histTdDate}>{item.fechaHora ?? '—'}</td>
                <td>
                  <span className={styles.histTag} style={{ color, background: color + '18' }}>
                    {item.status || 'Sin status'}
                  </span>
                </td>
                <td className={styles.histTdFarmer}>{item.agente ?? '—'}</td>
                <td className={styles.histTdComment}>{comentario}</td>
                <td className={styles.histTdType}>{item.ticket ? `${item.ticket} (${item.statusTicket || 'sin status'})` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Panel de historial + chat IA de una tienda (usado por Follow Up y por Gestión AGM).
 * `store` necesita el id interno (DB) de la tienda, no el storeCode del Sheet.
 * `gestionSlot`: nodo opcional que reemplaza el botón "Registrar gestión" por defecto
 * (por ejemplo el formulario de una tarea AGM puntual).
 */
export default function AgmStoreChat({ store, gestionSlot, onGestionarDefault }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLog, setHistoryLog] = useState([])
  const [histLoading, setHistLoading] = useState(false)
  const [tab, setTab] = useState(gestionSlot ? 'gestion' : 'log') // 'log' | 'chat' | 'gestion'
  const [retryCountdown, setRetryCountdown] = useState(0)
  const [pendingRetry, setPendingRetry] = useState(null)
  const bottomRef = useRef(null)
  const countdownRef = useRef(null)

  useEffect(() => {
    setMessages([])
    setHistory([])
    setInput('')
    setLoading(false)
    setHistoryLog([])
    setTab(gestionSlot ? 'gestion' : 'log')
    if (store) {
      loadHistory()
      loadSummary()
    }
  }, [store?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const startRetry = (seconds, retryFn) => {
    clearInterval(countdownRef.current)
    setRetryCountdown(seconds)
    setPendingRetry(() => retryFn)
    countdownRef.current = setInterval(() => {
      setRetryCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current)
          setPendingRetry(fn => { if (fn) fn(); return null })
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const loadHistory = async () => {
    setHistLoading(true)
    try {
      const r = await api.get(`/ai/followup-history/${store.id}`)
      setHistoryLog(r.data ?? [])
    } catch { setHistoryLog([]) }
    finally { setHistLoading(false) }
  }

  const loadSummary = async () => {
    setLoading(true)
    try {
      const r = await api.post('/ai/followup-chat', { storeId: store.id, history: [], message: '' })
      const reply = r.data?.reply ?? r.data?.error ?? '—'
      const aiMsg = { role: 'assistant', content: reply }
      setMessages([aiMsg])
      setHistory([aiMsg])
    } catch (e) {
      const data = e?.response?.data
      const secs = (e?.response?.status === 429 && data?.rateLimited)
        ? (data.retryAfterSeconds ?? 30) : 20
      startRetry(secs, loadSummary)
    } finally { setLoading(false) }
  }

  const sendText = async (text) => {
    if (!text || loading) return
    const userMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    const newHistory = [...history, userMsg]
    try {
      const r = await api.post('/ai/followup-chat', { storeId: store.id, history: newHistory, message: text })
      const reply = r.data?.reply ?? '—'
      const aiMsg = { role: 'assistant', content: reply }
      setMessages(prev => [...prev, aiMsg])
      setHistory([...newHistory, aiMsg])
    } catch (e) {
      const data = e?.response?.data
      const secs = (e?.response?.status === 429 && data?.rateLimited)
        ? (data.retryAfterSeconds ?? 30) : 20
      setMessages(prev => prev.slice(0, -1))
      setInput(text)
      startRetry(secs, () => sendText(text))
    } finally { setLoading(false) }
  }

  const send = () => {
    const text = input.trim()
    if (!text || loading || retryCountdown > 0) return
    sendText(text)
  }

  return (
    <div className={styles.chatPanel}>
      {/* Store header */}
      <div className={styles.chatStoreHeader}>
        <div className={styles.chatStoreInitial}>{store.storeName?.charAt(0).toUpperCase() ?? '?'}</div>
        <div className={styles.chatStoreInfo}>
          <span className={styles.chatStoreName}>{store.storeName}</span>
          <span className={styles.chatStoreMeta}>
            {store.brandId && <b>Brand {store.brandId}</b>}
            {store.storeCode && <span> · {store.storeCode}</span>}
            {store.phoneNumber && <span> · {store.phoneNumber}</span>}
          </span>
        </div>
        {onGestionarDefault && !gestionSlot && (
          <button className={styles.gestionarBtn} onClick={onGestionarDefault}>
            Registrar gestión
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'log' ? styles.tabActive : ''}`} onClick={() => setTab('log')}>
          Historial ({historyLog.length})
        </button>
        <button className={`${styles.tab} ${tab === 'chat' ? styles.tabActive : ''}`} onClick={() => setTab('chat')}>
          IA Asistente {loading ? '⏳' : messages.length > 0 ? '●' : ''}
        </button>
        {gestionSlot && (
          <button className={`${styles.tab} ${tab === 'gestion' ? styles.tabActive : ''}`} onClick={() => setTab('gestion')}>
            Gestionar
          </button>
        )}
      </div>

      {tab === 'log' && (
        <div className={styles.logPanel}>
          {histLoading
            ? <p className={styles.chatHint}>Cargando gestiones...</p>
            : <HistoryTable items={historyLog} />
          }
        </div>
      )}

      {tab === 'gestion' && gestionSlot && (
        <div className={styles.logPanel}>
          {gestionSlot}
        </div>
      )}

      {tab === 'chat' && (
        <>
          {historyLog.length > 0 && (
            <div className={styles.aiHistorySection}>
              <p className={styles.aiHistoryLabel}>Gestiones registradas</p>
              <HistoryTable items={historyLog} />
            </div>
          )}
          <div className={styles.chatMessages}>
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? styles.msgUser : styles.msgAi}>
                {m.role === 'assistant' && <span className={styles.aiLabel}>IA</span>}
                <div className={styles.msgText}>
                  {m.role === 'assistant' ? <Md>{m.content}</Md> : m.content}
                </div>
              </div>
            ))}
            {loading && retryCountdown === 0 && (
              <div className={styles.msgAi}>
                <span className={styles.aiLabel}>IA</span>
                <p className={styles.msgText} style={{ color: 'var(--text-muted)' }}>Analizando...</p>
              </div>
            )}
            {retryCountdown > 0 && (
              <div className={styles.msgAi}>
                <span className={styles.aiLabel}>IA</span>
                <div className={styles.rateLimitMsg}>
                  <span className={styles.rateLimitIcon}>⏳</span>
                  <div>
                    <p className={styles.rateLimitText}>Muchas consultas simultáneas — reintentando automáticamente</p>
                    <p className={styles.rateLimitSecs}>en {retryCountdown}s</p>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className={styles.chatInput}>
            <input
              className={styles.chatInputField}
              type="text"
              placeholder="Pregúntame algo sobre esta tienda..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              disabled={loading || retryCountdown > 0}
            />
            <button className={styles.sendBtn} onClick={send} disabled={loading || retryCountdown > 0 || !input.trim()}>
              {retryCountdown > 0 ? retryCountdown : '↑'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
