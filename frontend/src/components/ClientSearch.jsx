import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchClients } from '../services/despachoService'
import Icon from './Icon'
import styles from '../pages/DespachoPage.module.css'

const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0)

/** Buscador corto: sin texto muestra a los que más deben; al elegir un cliente abre su ficha. */
export default function ClientSearch({ date }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
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
      <button className={styles.searchBar} onClick={() => setOpen(o => !o)}>
        <Icon name="search" size={18} />{open ? 'Cerrar buscador' : 'Buscar cliente…'}
      </button>
      {open && (
        <div className={styles.searchBody}>
          <input className={styles.input} style={{ width: '100%', boxSizing: 'border-box' }} autoFocus
            placeholder="Nombre o sector…" value={q} onChange={e => setQ(e.target.value)} />
          <div className={styles.small} style={{ margin: '6px 0' }}>
            {q.trim() ? 'Resultados · toca uno para abrir su ficha' : 'Los que más deben'}
          </div>
          {error && <div className={styles.debt}>{error}</div>}
          {results && results.length === 0 && <div className={styles.small}>Sin resultados</div>}
          {results && results.map(c => (
            <div key={c.id} className={styles.result}>
              <button className={styles.resultHead} onClick={() => navigate(`/despacho/cliente/${c.id}`)}>
                <span><strong>{c.name}</strong><div className={styles.small}>{c.sector}</div></span>
                <span style={{ textAlign: 'right' }}>
                  <span className={Number(c.balance) > 0 ? styles.debt : Number(c.balance) < 0 ? styles.credit : ''}>
                    {money(c.balance)}{Number(c.balance) < 0 ? ' a favor' : ''}</span>
                  <div className={styles.small}>Ver ficha</div>
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
