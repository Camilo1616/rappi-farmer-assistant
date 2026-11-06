import { useState, useEffect, useRef } from 'react'
import { searchClients } from '../services/despachoService'
import styles from '../pages/DespachoPage.module.css'

const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0)
const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

/** Buscador corto: sin texto muestra a los que más deben; con texto filtra por cliente o sector. */
export default function ClientSearch({ date }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)
  const seq = useRef(0)

  // Espera 300 ms tras escribir y descarta respuestas viejas (evita que una búsqueda lenta pise a una nueva)
  useEffect(() => {
    if (!open) return undefined
    const id = ++seq.current
    const t = setTimeout(() => {
      searchClients(q, date)
        .then(r => { if (id === seq.current) { setResults(r); setError('') } })
        .catch(() => { if (id === seq.current) setError('No se pudo buscar') })
    }, 300)
    return () => clearTimeout(t)
  }, [open, q, date])

  return (
    <div className={styles.searchBox}>
      <button className={`${styles.btn} ${styles.btnGhost}`} style={{ width: '100%' }} onClick={() => setOpen(o => !o)}>
        🔍 {open ? 'Cerrar buscador' : 'Buscar cliente'}
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <input className={styles.input} style={{ width: '100%', boxSizing: 'border-box' }} autoFocus
            placeholder="Nombre o sector…" value={q} onChange={e => setQ(e.target.value)} />
          <div className={styles.small} style={{ margin: '6px 0' }}>
            {q.trim() ? 'Resultados' : 'Los que más deben'}
          </div>
          {error && <div className={styles.debt}>{error}</div>}
          {results && results.length === 0 && <div className={styles.small}>Sin resultados</div>}
          {results && results.map(c => (
            <div key={c.id} className={styles.result}>
              <button className={styles.resultHead} onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                <span><strong>{c.name}</strong><div className={styles.small}>{c.sector}</div></span>
                <span className={Number(c.balance) > 0 ? styles.debt : Number(c.balance) < 0 ? styles.credit : ''}>
                  {money(c.balance)}{Number(c.balance) < 0 ? ' a favor' : ''}</span>
              </button>
              {expanded === c.id && (
                <div className={styles.detail}>
                  <div>
                    Última compra:{' '}
                    {c.lastPurchase
                      ? `${fmtDate(c.lastPurchase.date)} · ${c.lastPurchase.boxes} cajas · ${money(c.lastPurchase.total)}` +
                        (c.daysSincePurchase > 0 ? ` (hace ${c.daysSincePurchase} día${c.daysSincePurchase !== 1 ? 's' : ''})` : ' (hoy)')
                      : 'sin compras'}
                  </div>
                  <div>Saldo anterior (arranque): {money(c.openingBalance)}</div>
                  <div>Últimos pagos:</div>
                  {c.lastPayments.length === 0 && <div>— ninguno —</div>}
                  {c.lastPayments.map((p, i) => (
                    <div key={i}>• {fmtDate(p.date)} · {p.label} · {money(p.amount)}{p.note ? ` · ${p.note}` : ''}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
