import { useState, useEffect, useRef } from 'react'
import { getStores } from '../services/storeService'
import GestionFlowModal from './GestionFlowModal'
import styles from './FollowUpModal.module.css'

export default function FollowUpModal({ onClose }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const inputRef  = useRef(null)
  const timerRef  = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!query.trim()) { setResults([]); return }
    setLoading(true)
    timerRef.current = setTimeout(() => {
      getStores({ q: query.trim() })
        .then(r => setResults(r.data ?? []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [query])

  if (selected) {
    return (
      <GestionFlowModal
        store={selected}
        onClose={() => setSelected(null)}
        onSaved={() => { setSelected(null); onClose() }}
      />
    )
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <p className={styles.title}>Follow up</p>
            <p className={styles.sub}>Busca la tienda y registra la gestión</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            ref={inputRef}
            className={styles.searchInput}
            type="text"
            placeholder="Nombre, código, Brand ID o teléfono..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && <button className={styles.clearBtn} onClick={() => setQuery('')}>✕</button>}
        </div>

        <div className={styles.body}>
          {loading && <p className={styles.hint}>Cargando tiendas...</p>}
          {!loading && !query.trim() && (
            <p className={styles.hint}>Escribe el nombre, código, Brand ID o teléfono</p>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <p className={styles.hint}>Sin resultados para "{query}"</p>
          )}
          {results.map(s => {
            const isBrandSync = s.todayManagementResult === 'BRAND_SYNC'
            const yaGestionada = !!s.todayManagementResult
            return (
              <button
                key={s.id}
                className={styles.resultRow}
                onClick={() => !yaGestionada && setSelected(s)}
                disabled={yaGestionada}
                style={yaGestionada ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                <div className={styles.rowMain}>
                  <span className={styles.storeName}>{s.storeName}</span>
                  <span className={styles.storeCode}>{s.storeCode}</span>
                  {isBrandSync && (
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: '99px', marginLeft: '6px' }}>
                      ⚡ Asociada al follow up de su brand
                    </span>
                  )}
                  {yaGestionada && !isBrandSync && (
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#22C55E', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: '99px', marginLeft: '6px' }}>
                      ✓ Gestionada hoy
                    </span>
                  )}
                </div>
                <div className={styles.rowMeta}>
                  {s.brandId && <span className={styles.metaTag}>Brand: {s.brandId}</span>}
                  {s.phoneNumber && <span className={styles.metaTag}>📞 {s.phoneNumber}</span>}
                  {s.agingStage && <span className={styles.metaTag}>{s.agingStage}</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
