import { useState, useEffect, useRef, useMemo } from 'react'
import { globalSearchStores } from '../services/storeService'
import GestionFlowModal from './GestionFlowModal'
import AgmStoreChat from './AgmStoreChat'
import styles from './FollowUpModal.module.css'

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

/** Chat IA + botón "Registrar gestión" (flujo genérico, guarda en daily_management). */
function AiChat({ store, onGestionar }) {
  const [gestion, setGestion] = useState(false)

  if (gestion) {
    return (
      <GestionFlowModal
        store={store}
        onClose={() => setGestion(false)}
        onSaved={() => { setGestion(false); onGestionar?.() }}
      />
    )
  }

  return <AgmStoreChat store={store} onGestionarDefault={() => setGestion(true)} />
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
