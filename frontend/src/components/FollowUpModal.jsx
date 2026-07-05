import { useState, useEffect, useRef, useMemo } from 'react'
import { globalSearchStores } from '../services/storeService'
import api from '../services/api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import GestionFlowModal from './GestionFlowModal'
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

const COUNTRY_MAP = {
  CO: { name: 'Colombia',           flag: '🇨🇴' },
  MX: { name: 'México',             flag: '🇲🇽' },
  AR: { name: 'Argentina',          flag: '🇦🇷' },
  CL: { name: 'Chile',              flag: '🇨🇱' },
  PE: { name: 'Perú',               flag: '🇵🇪' },
  EC: { name: 'Ecuador',            flag: '🇪🇨' },
  UY: { name: 'Uruguay',            flag: '🇺🇾' },
  CR: { name: 'Costa Rica',         flag: '🇨🇷' },
  BO: { name: 'Bolivia',            flag: '🇧🇴' },
  PY: { name: 'Paraguay',           flag: '🇵🇾' },
  DO: { name: 'Rep. Dominicana',    flag: '🇩🇴' },
  PA: { name: 'Panamá',             flag: '🇵🇦' },
}

function getCountryCode(storeCode) {
  if (!storeCode) return null
  const prefix = storeCode.slice(0, 2).toUpperCase()
  return COUNTRY_MAP[prefix] ? prefix : null
}

const RESULT_LABEL = {
  EFECTIVA: { label: 'Efectiva', color: '#22C55E' },
  NO_CONTACTO: { label: 'No contacto', color: '#F97316' },
  NO_RESPONDE: { label: 'No responde', color: '#8B93A8' },
  PROBLEMA_TECNICO: { label: 'Problema técnico', color: '#EF4444' },
  REQUIERE_SEGUIMIENTO: { label: 'Seguimiento', color: '#3B82F6' },
  BRAND_SYNC: { label: 'Brand sync', color: '#F59E0B' },
}

function HistoryTable({ items }) {
  if (!items.length) return (
    <div className={styles.emptyChat}>
      <span className={styles.emptyChatIcon}>📋</span>
      <p>Sin gestiones registradas para esta tienda aún.</p>
    </div>
  )
  return (
    <div className={styles.histTableWrap}>
      <table className={styles.histTable}>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Resultado</th>
            <th>Farmer</th>
            <th>Comentario</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const rs = RESULT_LABEL[item.resultType] ?? { label: item.resultType, color: '#8B93A8' }
            const date = item.date ? new Date(item.date) : null
            const dateStr = date ? date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'
            return (
              <tr key={item.id}>
                <td className={styles.histTdDate}>{dateStr}</td>
                <td className={styles.histTdType}>{item.managementType ?? '—'}</td>
                <td>
                  <span className={styles.histTag} style={{ color: rs.color, background: rs.color + '18' }}>
                    {rs.label}
                  </span>
                </td>
                <td className={styles.histTdFarmer}>{item.farmerName ?? '—'}</td>
                <td className={styles.histTdComment}>{item.comments ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function AiChat({ store, onGestionar }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [gestion, setGestion] = useState(false)
  const [historyLog, setHistoryLog] = useState([])
  const [histLoading, setHistLoading] = useState(false)
  const [tab, setTab] = useState('log') // 'log' | 'chat'
  const [retryCountdown, setRetryCountdown] = useState(0) // segundos restantes rate limit
  const [pendingRetry, setPendingRetry] = useState(null)  // fn a ejecutar cuando expire
  const bottomRef = useRef(null)
  const countdownRef = useRef(null)

  useEffect(() => {
    setMessages([])
    setHistory([])
    setInput('')
    setLoading(false)
    setHistoryLog([])
    setTab('log')
    if (store) {
      loadHistory()
      loadSummary() // carga IA en background
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

  if (gestion) {
    return (
      <GestionFlowModal
        store={store}
        onClose={() => setGestion(false)}
        onSaved={() => { setGestion(false); onGestionar?.() }}
      />
    )
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
        <button className={styles.gestionarBtn} onClick={() => setGestion(true)}>
          Registrar gestión
        </button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'log' ? styles.tabActive : ''}`} onClick={() => setTab('log')}>
          Historial ({historyLog.length})
        </button>
        <button className={`${styles.tab} ${tab === 'chat' ? styles.tabActive : ''}`} onClick={() => setTab('chat')}>
          IA Asistente {loading ? '⏳' : messages.length > 0 ? '●' : ''}
        </button>
      </div>

      {tab === 'log' ? (
        <div className={styles.logPanel}>
          {histLoading
            ? <p className={styles.chatHint}>Cargando gestiones...</p>
            : <HistoryTable items={historyLog} />
          }
        </div>
      ) : (
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

export default function FollowUpModal({ onClose, onSaved, initialStore }) {
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [selected, setSelected]   = useState(initialStore ?? null)
  const [countryFilter, setCountryFilter] = useState(null)
  const [countryDropOpen, setCountryDropOpen] = useState(false)
  const inputRef      = useRef(null)
  const timerRef      = useRef(null)
  const countryBtnRef = useRef(null)

  const ALL_COUNTRIES = Object.keys(COUNTRY_MAP)

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    if (!countryDropOpen) return
    const handler = e => {
      if (countryBtnRef.current && !countryBtnRef.current.contains(e.target))
        setCountryDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [countryDropOpen])

  const filteredResults = useMemo(() => {
    if (!countryFilter) return results
    return results.filter(s => getCountryCode(s.storeCode) === countryFilter)
  }, [results, countryFilter])

  useEffect(() => {
    if (initialStore) {
      setSelected(initialStore)
      setResults([initialStore])
      setQuery(initialStore.storeName ?? '')
    } else {
      inputRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!query.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    timerRef.current = setTimeout(() => {
      globalSearchStores(query.trim())
        .then(r => setResults(r.data ?? []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [query])

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* Panel izquierdo — búsqueda */}
        <div className={styles.leftPanel}>
          <div className={styles.leftHeader}>
            <span className={styles.leftTitle}>Follow Up</span>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>

          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              ref={inputRef}
              className={styles.searchInput}
              type="text"
              placeholder="Busca cualquier tienda en Rappi Farmer..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && <button className={styles.clearBtn} onClick={() => setQuery('')}>✕</button>}
          </div>

          {/* Selector de país — dropdown */}
          <div className={styles.countryRow} ref={countryBtnRef}>
            <button
              className={styles.countryBtn}
              onClick={() => setCountryDropOpen(o => !o)}
            >
              <span>{countryFilter ? COUNTRY_MAP[countryFilter].flag : '🌎'}</span>
              <span className={styles.countryBtnLabel}>
                {countryFilter ? COUNTRY_MAP[countryFilter].name : 'Todos los países'}
              </span>
              <span className={styles.countryBtnArrow}>{countryDropOpen ? '▲' : '▼'}</span>
            </button>

            {countryDropOpen && (
              <div className={styles.countryDropdown}>
                <button
                  className={`${styles.countryOption} ${!countryFilter ? styles.countryOptionActive : ''}`}
                  onClick={() => { setCountryFilter(null); setCountryDropOpen(false) }}
                >
                  <span>🌎</span>
                  <span>Todos los países</span>
                </button>
                {ALL_COUNTRIES.map(code => {
                  const c = COUNTRY_MAP[code]
                  return (
                    <button
                      key={code}
                      className={`${styles.countryOption} ${countryFilter === code ? styles.countryOptionActive : ''}`}
                      onClick={() => { setCountryFilter(code); setCountryDropOpen(false) }}
                    >
                      <span>{c.flag}</span>
                      <span>{c.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className={styles.leftBody}>
            {loading && <p className={styles.hint}>Buscando...</p>}
            {!loading && !query.trim() && (
              <div className={styles.emptySearch}>
                <span style={{ fontSize: 28 }}>🌎</span>
                <p>Busca por nombre, código o Brand ID en cualquier país</p>
              </div>
            )}
            {!loading && query.trim() && filteredResults.length === 0 && (
              <p className={styles.hint}>Sin resultados para "{query}"</p>
            )}
            {filteredResults.map(s => {
              const isSelected = selected?.id === s.id
              const cc = getCountryCode(s.storeCode)
              const countryInfo = cc ? COUNTRY_MAP[cc] : null
              const lastFU = s.lastFollowUp
                ? new Date(s.lastFollowUp).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })
                : null
              return (
                <button
                  key={s.id}
                  className={`${styles.resultRow} ${isSelected ? styles.resultRowActive : ''} ${s.active === false ? styles.resultRowInactive : ''}`}
                  onClick={() => setSelected(s)}
                >
                  <div className={styles.rowMain}>
                    {countryInfo && <span className={styles.storeFlag} title={countryInfo.name}>{countryInfo.flag}</span>}
                    <span className={styles.storeName}>{s.storeName}</span>
                    {s.active === false && <span className={styles.inactiveBadge}>Inactiva</span>}
                  </div>
                  <div className={styles.rowMeta}>
                    {s.storeCode && <span className={styles.metaTag}>{s.storeCode}</span>}
                    {s.brandId && <span className={styles.metaTag}>Brand: {s.brandId}</span>}
                  </div>
                  <div className={styles.rowInfo}>
                    {s.farmerEmail && <span className={styles.farmerEmail} title="Farmer asignado">👤 {s.farmerEmail}</span>}
                    {lastFU && <span className={styles.lastFU}>Último FU: {lastFU}</span>}
                    {!lastFU && <span className={styles.lastFU} style={{ color: '#F97316' }}>Sin follow up</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Panel derecho — chat IA */}
        <div className={styles.rightPanel}>
          {!selected ? (
            <div className={styles.emptyChat}>
              <span className={styles.emptyChatIcon}>🔍</span>
              <p>Busca una tienda por nombre, código o Brand ID en el panel izquierdo</p>
            </div>
          ) : (
            <AiChat
              store={selected}
              onGestionar={() => { onSaved?.(); onClose() }}
            />
          )}
        </div>

      </div>
    </div>
  )
}
