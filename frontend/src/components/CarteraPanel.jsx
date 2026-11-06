import { useState, useEffect, useCallback } from 'react'
import Icon from './Icon'
import { useNavigate } from 'react-router-dom'
import { getPortfolio, addPayment, deletePayment } from '../services/despachoService'
import styles from '../pages/DespachoPage.module.css'

const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0)
const TYPES = [['ABONO', 'Abono'], ['CONSIGNACION', 'Consignación'], ['DESCUENTO', 'Descuento']]

// Saldo positivo = el cliente debe; negativo = saldo a favor
function Balance({ value }) {
  const n = Number(value)
  return <span className={n > 0 ? styles.debt : n < 0 ? styles.credit : ''}>{money(n)}{n < 0 ? ' a favor' : ''}</span>
}

function PaymentForm({ clientId, date, run }) {
  const [type, setType] = useState('ABONO')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  return (
    <form className={styles.payForm} onSubmit={e => {
      e.preventDefault()
      run(async () => { const d = await addPayment({ date, clientId, type, amount: Number(amount), note }); setAmount(''); setNote(''); return d })
    }}>
      <select className={styles.input} value={type} onChange={e => setType(e.target.value)}>
        {TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <input className={styles.input} type="number" inputMode="numeric" min="1" placeholder="Valor ($)"
        value={amount} onChange={e => setAmount(e.target.value)} required />
      <input className={styles.input} placeholder="Nota (cuenta, quién entregó…)" value={note}
        onChange={e => setNote(e.target.value)} />
      <button className={styles.btn} type="submit">Registrar</button>
    </form>
  )
}

/** Cartera: lo vendido, lo cobrado y el saldo de cada cliente a la fecha elegida. */
export default function CarteraPanel({ date, onError }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [open, setOpen] = useState({})
  const load = useCallback(() => getPortfolio(date).then(setData).catch(() => onError('No se pudo cargar la cartera')), [date, onError])
  useEffect(() => { load() }, [load])

  const run = async (fn) => {
    onError('')
    try { setData(await fn()) } catch (e) { onError(e.response?.data?.message || 'Error inesperado'); load() }
  }
  if (!data) return <div className={styles.small}>Cargando cartera…</div>
  const s = data.summary

  return (
    <div>
      <div className={styles.cards}>
        <div className={styles.card}><div className={styles.cardLabel}>Vendido hoy</div><div className={styles.cardValue}>{money(s.salesToday)}</div></div>
        <div className={styles.card}><div className={styles.cardLabel}>Cobrado hoy</div><div className={styles.cardValue}>{money(s.collectedToday)}</div></div>
        <div className={styles.card}><div className={styles.cardLabel}>Descuentos hoy</div><div className={styles.cardValue}>{money(s.discountsToday)}</div></div>
        <div className={styles.card}><div className={styles.cardLabel}>Por cobrar total</div><div className={styles.cardValue}>{money(s.receivable)}</div></div>
      </div>

      {data.sectors.length === 0 && <div className={styles.small}>Aún no hay clientes.</div>}
      {data.sectors.map(sec => (
        <div key={sec.id} className={styles.sector}>
          <button className={styles.sectorHead} onClick={() => setOpen(o => ({ ...o, [`s${sec.id}`]: !o[`s${sec.id}`] }))}>
            <span>{sec.name}<div className={styles.small}>{sec.clients.length} cliente{sec.clients.length !== 1 ? 's' : ''}</div></span>
            <span className={styles.meta}>Debe <Balance value={sec.balance} /> <Icon name={open[`s${sec.id}`] ? 'up' : 'down'} size={14} /></span>
          </button>
          {open[`s${sec.id}`] && sec.clients.map(c => (
            <div key={c.id}>
              <button className={styles.clientHead} onClick={() => setOpen(o => ({ ...o, [c.id]: !o[c.id] }))}>
                <strong>{c.name}</strong>
                <span className={styles.meta}><Balance value={c.balance} /> <Icon name={open[c.id] ? 'up' : 'down'} size={14} /></span>
              </button>
              {open[c.id] && (
                <>
                  <div className={styles.breakdown}>
                    <span>Saldo anterior</span><span>{money(c.openingBalance)}</span>
                    <span>+ Facturado</span><span>{money(c.billed)}</span>
                    <span>− Descuentos</span><span>{money(c.discounts)}</span>
                    <span>− Abonos</span><span>{money(c.payments)}</span>
                    <span>− Consignaciones</span><span>{money(c.deposits)}</span>
                    <strong>Saldo actual</strong><strong><Balance value={c.balance} /></strong>
                  </div>
                  {c.todayPayments.map(p => (
                    <div key={p.id} className={styles.payRow}>
                      <span>{p.label} · {money(p.amount)}{p.note ? ` · ${p.note}` : ''}</span>
                      <button className={`${styles.btn} ${styles.btnGhost}`}
                        onClick={() => run(() => deletePayment(p.id, date))}>Quitar</button>
                    </div>
                  ))}
                  <PaymentForm clientId={c.id} date={date} run={run} />
                  <div style={{ padding: '0 14px 12px' }}>
                    <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => navigate(`/despacho/cliente/${c.id}`)}>Abrir ficha del cliente ›</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
