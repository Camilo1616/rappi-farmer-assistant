import { useState, useEffect, useCallback } from 'react'
import Icon from './Icon'
import { useNavigate } from 'react-router-dom'
import { getOpenOrders, getSuggestion, applySuggestion } from '../services/despachoService'
import styles from '../pages/DespachoPage.module.css'

const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0)

/** Pedidos abiertos del día contra lo disponible, con reparto sugerido cuando no alcanza. */
export default function PedidosPanel({ date, onError, onChanged }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [sug, setSug] = useState(null)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => getOpenOrders(date).then(setData).catch(() => onError('No se pudieron cargar los pedidos')), [date, onError])
  useEffect(() => { load() }, [load])

  const calc = async () => {
    onError(''); setConfirm(false)
    try { setSug(await getSuggestion(date)) } catch { onError('No se pudo calcular el reparto') }
  }
  const apply = async () => {
    setBusy(true); onError('')
    try {
      await applySuggestion(date)
      setSug(null); setConfirm(false)
      await load(); onChanged?.()
    } catch (e) { onError(e.response?.data?.message || 'No se pudo aplicar el reparto') }
    finally { setBusy(false) }
  }

  if (!data) return <div className={styles.small}>Cargando pedidos…</div>
  const s = data.summary
  const moraWithOrders = data.overdue.filter(o => o.pendingBoxes > 0)

  return (
    <div>
      <div className={styles.cards}>
        <div className={styles.card}><div className={styles.cardLabel}>Pedido total</div><div className={styles.cardValue}>{s.ordered}</div></div>
        <div className={styles.card}><div className={styles.cardLabel}>Entregado</div><div className={styles.cardValue}>{s.delivered}</div></div>
        <div className={styles.card}><div className={styles.cardLabel}>Pendiente</div><div className={styles.cardValue}>{s.pending}</div></div>
        <div className={styles.card}><div className={styles.cardLabel}>No alcanza</div>
          <div className={`${styles.cardValue} ${s.shortage > 0 ? styles.out : styles.in}`}>{s.shortage}</div></div>
      </div>

      {moraWithOrders.length > 0 && (
        <div className={styles.moraBox} style={{ margin: '0 0 14px' }}>
          <strong><Icon name="alert" size={16} style={{ verticalAlign: -3, marginRight: 6 }} />{moraWithOrders.length} cliente{moraWithOrders.length !== 1 ? 's' : ''} en mora con pedido abierto</strong>
          {moraWithOrders.map(o => (
            <div key={o.clientId} className={styles.payRow} style={{ padding: '6px 0', border: 'none' }}>
              <button className={styles.resultHead} onClick={() => navigate(`/despacho/cliente/${o.clientId}`)}>
                <span><strong>{o.name}</strong> <span className={styles.small}>· {o.sector}</span></span>
              </button>
              <span className={styles.small}>pide {o.pendingBoxes} · debe {money(o.balance)}{o.daysSincePayment != null ? ` · ${o.daysSincePayment} d sin pagar` : ''}</span>
            </div>
          ))}
        </div>
      )}

      <h2 className={styles.sectionTitle}>Pedido contra disponible</h2>
      <div className={styles.closeBox} style={{ marginBottom: 16 }}>
        <table className={styles.otbl}>
          <thead><tr><th>Categoría</th><th>Pedido</th><th>Entreg.</th><th>Pend.</th><th>Hay</th><th>Falta / sobra</th></tr></thead>
          <tbody>
            {data.categories.filter(c => c.ordered > 0 || c.free > 0).map(c => (
              <tr key={c.category}>
                <td>{c.label}</td><td>{c.ordered}</td><td>{c.delivered}</td><td>{c.pending}</td><td>{c.free}</td>
                <td>{c.shortage > 0 ? <span className={styles.short}>−{c.shortage}</span>
                  : c.surplus > 0 ? <span className={styles.spare}>+{c.surplus}</span> : <Icon name="check" size={14} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.categories.every(c => c.ordered === 0 && c.free === 0) && <div className={styles.small}>Sin pedidos ni existencias este día.</div>}
      </div>

      <h2 className={styles.sectionTitle}>Reparto sugerido</h2>
      <div className={styles.closeBox} style={{ marginBottom: 16 }}>
        <div className={styles.small} style={{ marginBottom: 8 }}>
          Reparte lo disponible entre los pedidos pendientes: primero los clientes al día (menor saldo primero) y al final los morosos.
        </div>
        <button className={styles.btn} onClick={calc} disabled={s.pending === 0}>
          {s.pending === 0 ? 'No hay pedidos pendientes' : 'Calcular reparto'}
        </button>
        {sug && (
          <div style={{ marginTop: 12 }}>
            {sug.rows.length === 0 && <div className={styles.small}>Nada que repartir.</div>}
            {sug.rows.map((r, i) => (
              <div key={i} className={styles.sugRow}>
                <span><strong>{r.name}</strong>{r.overdue && <span className={styles.moraTag}>En mora</span>}
                  <div className={styles.small}>{r.label} · pidió {r.ordered}, lleva {r.delivered}</div></span>
                <span className={r.give > 0 ? styles.sugGive : styles.sugNone}>
                  {r.give > 0 ? `+${r.give}` : 'sin existencias'}{r.uncovered > 0 && r.give > 0 ? ` (faltan ${r.uncovered})` : ''}
                </span>
              </div>
            ))}
            <div className={styles.small} style={{ margin: '10px 0' }}>
              Se entregarían <strong>{sug.totalToGive}</strong> cajas y quedarían <strong>{sug.totalUncovered}</strong> sin cubrir.
            </div>
            {sug.totalToGive > 0 && (confirm ? (
              <div className={styles.chips}>
                <button className={styles.btn} onClick={apply} disabled={busy}>Sí, aplicar reparto</button>
                <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setConfirm(false)}>Cancelar</button>
              </div>
            ) : <button className={styles.btn} onClick={() => setConfirm(true)}>Aplicar reparto…</button>)}
          </div>
        )}
      </div>

      <h2 className={styles.sectionTitle}>Pedidos abiertos por cliente</h2>
      {data.clients.length === 0 && <div className={styles.small}>No hay pedidos pendientes.</div>}
      {data.clients.map(c => (
        <div key={c.clientId} className={styles.sector} style={{ padding: '10px 14px' }}>
          <button className={styles.resultHead} onClick={() => navigate(`/despacho/cliente/${c.clientId}`)}>
            <span><strong>{c.name}</strong>{c.overdue && <span className={styles.moraTag}>En mora</span>}
              <div className={styles.small}>{c.sector}</div></span>
            <span className={styles.meta}>Pendiente {c.pending}</span>
          </button>
          <div>{c.lines.map(l => <span key={l.category} className={styles.pill}>{l.label} {l.pending}</span>)}</div>
        </div>
      ))}
    </div>
  )
}
