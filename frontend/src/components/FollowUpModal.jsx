import { useState, useEffect, useRef, useMemo } from 'react'
import { globalSearchStores } from '../services/storeService'
import api from '../services/api'
import GestionFlowModal from './GestionFlowModal'
import styles from './FollowUpModal.module.css'

const COUNTRY_MAP = {
  CO: { name: 'Colombia',           flag: '🇨🇴' },
  MX: { name: 'México',             flag: '🇲🇽' },
  BR: { name: 'Brasil',             flag: '🇧🇷' },
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

function HistoryBubble({ item }) {
  const rs = RESULT_LABEL[item.resultType] ?? { label: item.resultType, color: '#8B93A8' }
  const date = item.date ? new Date(item.date) : null
  const dateStr = date ? date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
  return (
    <div className={styles.histBubble}>
      <div className={styles.histMeta}>
        <span className={styles.histDate}>{dateStr}</span>
        <span className={styles.histTag} style={{ color: rs.color, background: rs.color + '18' }}>{rs.label}</span>
        {item.managementType && <span className={styles.histType}>{item.managementType}</span>}
        {item.farmerName && <span className={styles.histFarmer}>{item.farmerName}</span>}
      </div>
      {item.comments && <p className={styles.histComment}>{item.comments}</p>}
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
  const bottomRef = useRef(null)

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
      const errMsg = e?.response?.data?.error || e?.message || 'Error al conectar con la IA'
      setMessages([{ role: 'assistant', content: `⚠️ ${errMsg}\n\nPuedes revisar el historial de gestiones en la pestaña "Historial".` }])
    } finally { setLoading(false) }
  }

  const send = async () => {
    const text = input.trim()
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
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error al procesar — intenta de nuevo.' }])
    } finally { setLoading(false) }
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
          {histLoading && (
            <p className={styles.chatHint}>Cargando gestiones...</p>
          )}
          {!histLoading && historyLog.length === 0 && (
            <div className={styles.emptyChat}>
              <span className={styles.emptyChatIcon}>📋</span>
              <p>Sin gestiones registradas para esta tienda aún.</p>
            </div>
          )}
          {historyLog.map(item => <HistoryBubble key={item.id} item={item} />)}
        </div>
      ) : (
        <>
          <div className={styles.chatMessages}>
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? styles.msgUser : styles.msgAi}>
                {m.role === 'assistant' && <span className={styles.aiLabel}>IA</span>}
                <p className={styles.msgText}>{m.content}</p>
              </div>
            ))}
            {loading && (
              <div className={styles.msgAi}>
                <span className={styles.aiLabel}>IA</span>
                <p className={styles.msgText} style={{ color: 'var(--text-muted)' }}>Analizando...</p>
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
              disabled={loading}
            />
            <button className={styles.sendBtn} onClick={send} disabled={loading || !input.trim()}>
              ↑
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
  const inputRef  = useRef(null)
  const timerRef  = useRef(null)

  const availableCountries = useMemo(() => {
    const codes = new Set(results.map(s => getCountryCode(s.storeCode)).filter(Boolean))
    return [...codes].sort()
  }, [results])

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

          {/* Filtros de país */}
          {availableCountries.length > 0 && (
            <div className={styles.countryBar}>
              <button
                className={`${styles.countryChip} ${!countryFilter ? styles.countryChipActive : ''}`}
                onClick={() => setCountryFilter(null)}
              >
                🌎 Todos
              </button>
              {availableCountries.map(code => {
                const c = COUNTRY_MAP[code]
                return (
                  <button
                    key={code}
                    className={`${styles.countryChip} ${countryFilter === code ? styles.countryChipActive : ''}`}
                    onClick={() => setCountryFilter(countryFilter === code ? null : code)}
                    title={c.name}
                  >
                    {c.flag} {code}
                  </button>
                )
              })}
            </div>
          )}

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
