import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getClientProfile, updateClient, addClientNote, deleteClientNote, addPayment, getDay,
} from '../services/despachoService'
import styles from './ClienteFichaPage.module.css'
import Icon from '../components/Icon'
import '../styles/app-theme.css'

const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0)
const todayStr = () => new Date().toLocaleDateString('en-CA')
const fmtDay = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtShort = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
const ago = (n) => n == null ? '' : n === 0 ? 'hoy' : `hace ${n} día${n !== 1 ? 's' : ''}`
const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
// Celulares colombianos de 10 dígitos llevan el prefijo 57 para WhatsApp
const waNumber = (phone = '') => { const d = phone.replace(/\D/g, ''); return d.length === 10 ? '57' + d : d }

const KIND = {
  COMPRA: { icon: <Icon name="cart" size={15} />, dot: styles.dotCompra, sign: '+', cls: styles.warn },
  PAGO: { icon: <Icon name="dollar" size={15} />, dot: styles.dotPago, sign: '−', cls: styles.good },
  AJUSTE: { icon: <Icon name="percent" size={15} />, dot: styles.dotAjuste, sign: '−', cls: styles.warn },
  VACIAS: { icon: <Icon name="box" size={15} />, dot: styles.dotVacias, sign: '', cls: styles.info },
}
const PAY_TYPES = [['ABONO', 'Abono'], ['CONSIGNACION', 'Consignación'], ['DESCUENTO', 'Descuento']]
const METHODS = [['EFECTIVO', 'Efectivo'], ['NEQUI', 'Nequi'], ['CONSIGNACION', 'Consignación']]
const RECEIVERS = ['Angela', 'Lorena', 'Conductor']

function statusOf(p) {
  const b = Number(p.balance)
  if (p.overdue) return ['En mora', styles.tagDanger]
  if (b > 0) return ['Debe', styles.tagWarn]
  if (b < 0) return ['Saldo a favor', styles.tagInfo]
  return ['Al día', styles.tagOk]
}

function statementText(p) {
  const lines = [`Estado de cuenta — ${p.name}`, `Saldo actual: ${money(p.balance)}`]
  if (p.packaging > 0) lines.push(`Vacías pendientes: ${p.packaging}`)
  lines.push('', 'Últimos movimientos:')
  p.timeline.slice(0, 8).forEach(m => {
    const v = m.kind === 'VACIAS' ? `${m.boxes} vacías` : `${m.kind === 'COMPRA' ? '+' : '−'}${money(m.amount)}`
    lines.push(`• ${fmtShort(m.date)} · ${m.title}${m.detail && m.kind !== 'VACIAS' ? ` (${m.detail})` : ''} · ${v}`)
  })
  return lines.join('\n')
}

function Timeline({ items }) {
  if (items.length === 0) return <div className={styles.empty}>Aún no hay movimientos.</div>
  const out = []
  let last = null
  items.forEach((m, i) => {
    if (m.date !== last) { last = m.date; out.push(<div key={`d-${m.date}-${i}`} className={styles.dayLabel}>{fmtDay(m.date)}</div>) }
    const k = KIND[m.kind]
    out.push(
      <div key={i} className={styles.item}>
        <div className={`${styles.dot} ${k.dot}`}>{k.icon}</div>
        <div>
          <div className={styles.itemTitle}>{m.title}</div>
          {m.detail && <div className={styles.itemDetail}>{m.detail}</div>}
        </div>
        <div className={`${styles.amount} ${k.cls}`}>
          {m.kind === 'VACIAS' ? `−${m.boxes}` : `${k.sign}${money(m.amount)}`}
        </div>
      </div>
    )
  })
  return <div className={styles.timeline}>{out}</div>
}

function PaymentForm({ profile, reload, fail }) {
  const [type, setType] = useState('ABONO')
  const [method, setMethod] = useState('EFECTIVO')
  const [by, setBy] = useState('Angela')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const isDiscount = type === 'DESCUENTO'
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await addPayment({
        date: todayStr(), clientId: profile.id, type, amount: Number(amount), note,
        method: isDiscount ? null : (type === 'CONSIGNACION' ? 'CONSIGNACION' : method),
        receivedBy: isDiscount ? null : by,
      })
      setAmount(''); setNote('')
      await reload()
    } catch (err) { fail(err.response?.data?.message || 'No se pudo registrar') }
    finally { setBusy(false) }
  }
  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.label}>Tipo</div>
      <div className={styles.chips}>
        {PAY_TYPES.map(([k, l]) => (
          <button type="button" key={k} className={`${styles.chip} ${type === k ? styles.chipOn : ''}`} onClick={() => setType(k)}>{l}</button>
        ))}
      </div>
      <input className={styles.input} type="number" inputMode="numeric" min="1" placeholder="Valor ($)" value={amount}
        onChange={e => setAmount(e.target.value)} required />
      {type === 'ABONO' && (<>
        <div className={styles.label}>Método</div>
        <div className={styles.chips}>
          {METHODS.filter(([k]) => k !== 'CONSIGNACION').map(([k, l]) => (
            <button type="button" key={k} className={`${styles.chip} ${method === k ? styles.chipOn : ''}`} onClick={() => setMethod(k)}>{l}</button>
          ))}
        </div>
      </>)}
      {!isDiscount && (<>
        <div className={styles.label}>Recibió</div>
        <div className={styles.chips}>
          {RECEIVERS.map(r => (
            <button type="button" key={r} className={`${styles.chip} ${by === r ? styles.chipOn : ''}`} onClick={() => setBy(r)}>{r}</button>
          ))}
        </div>
      </>)}
      <input className={styles.input} placeholder="Nota (opcional)" value={note} onChange={e => setNote(e.target.value)} />
      <button className={styles.btn} type="submit" disabled={busy}>Registrar {PAY_TYPES.find(([k]) => k === type)[1].toLowerCase()}</button>
    </form>
  )
}

function DataForm({ profile, sectors, reload, fail }) {
  const [name, setName] = useState(profile.name)
  const [sectorId, setSectorId] = useState(String(profile.sectorId))
  const [phone, setPhone] = useState(profile.phone || '')
  const [plaza, setPlaza] = useState(profile.plaza || '')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try { await updateClient(profile.id, { name, sectorId: Number(sectorId), phone, plaza }); await reload() }
    catch (err) { fail(err.response?.data?.message || 'No se pudo guardar') }
    finally { setBusy(false) }
  }
  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.label}>Nombre</div>
      <input className={styles.input} value={name} onChange={e => setName(e.target.value)} required />
      <div className={styles.label}>Sector</div>
      <select className={styles.input} value={sectorId} onChange={e => setSectorId(e.target.value)}>
        {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <div className={styles.label}>Teléfono</div>
      <input className={styles.input} type="tel" inputMode="tel" placeholder="300 123 4567" value={phone} onChange={e => setPhone(e.target.value)} />
      <div className={styles.label}>Plaza / punto de entrega</div>
      <input className={styles.input} placeholder="Ej. Plaza Mercasa" value={plaza} onChange={e => setPlaza(e.target.value)} />
      <button className={styles.btn} type="submit" disabled={busy}>Guardar datos</button>
    </form>
  )
}

function Notes({ profile, reload, fail }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async (fn) => {
    setBusy(true)
    try { await fn(); await reload() } catch (err) { fail(err.response?.data?.message || 'Error inesperado') } finally { setBusy(false) }
  }
  return (
    <div className={styles.form}>
      <textarea className={styles.input} rows={3} maxLength={1000} placeholder="Escribe una nota sobre este cliente…"
        value={text} onChange={e => setText(e.target.value)} />
      <button className={styles.btn} disabled={busy || !text.trim()}
        onClick={() => run(async () => { await addClientNote(profile.id, text); setText('') })}>Guardar nota</button>
      {profile.notes.length === 0 && <div className={styles.empty}>Sin notas todavía.</div>}
      {profile.notes.map(n => (
        <div key={n.id} className={styles.note}>
          <div>
            <div className={styles.noteText}>{n.content}</div>
            <div className={styles.noteDate}>{new Date(n.createdAt).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <button className={`${styles.chip}`} aria-label="Eliminar nota" onClick={() => run(() => deleteClientNote(profile.id, n.id))}><Icon name="x" size={14} /></button>
        </div>
      ))}
    </div>
  )
}

/** Ficha del cliente (vista tipo CRM): contacto, estado de cuenta, actividad, historial, pagos y notas. */
export default function ClienteFichaPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [sectors, setSectors] = useState([])
  const [tab, setTab] = useState('historial')
  const [limit, setLimit] = useState(40)
  const [error, setError] = useState('')
  // Vuelve a la pantalla de la que venía (misma sección y fecha); si se abrió directo, va al inicio
  const goBack = () => (window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/despacho'))

  const load = useCallback(() => getClientProfile(id, limit).then(p => { setProfile(p); setError('') })
    .catch(e => setError(e.response?.data?.message || 'No se pudo cargar el cliente')), [id, limit])
  useEffect(() => { load() }, [load])
  useEffect(() => { getDay(todayStr()).then(d => setSectors(d.sectors)).catch(() => {}) }, [])

  if (!profile) {
    return (
      <div className={`app-theme ${styles.page}`}>
        <div className={styles.top}><button className={styles.back} onClick={goBack}><Icon name="left" size={16} style={{ verticalAlign: -3, marginRight: 4 }} />Volver</button></div>
        <div className={styles.empty}>{error || 'Cargando cliente…'}</div>
      </div>
    )
  }
  const [statusLabel, statusCls] = statusOf(profile)
  const balance = Number(profile.balance)
  const wa = profile.phone ? `https://wa.me/${waNumber(profile.phone)}?text=${encodeURIComponent(statementText(profile))}` : null

  return (
    <div className={`app-theme ${styles.page}`}>
      <div className={styles.top}>
        <button className={styles.back} onClick={goBack}><Icon name="left" size={16} style={{ verticalAlign: -3, marginRight: 4 }} />Volver</button>
        <span className={styles.topTitle}>Ficha del cliente</span>
      </div>

      <div className={styles.layout}>
        <div className={styles.side}>
          <div className={styles.hero}>
            <div className={styles.heroTop}>
              <div className={styles.avatar}>{initials(profile.name)}</div>
              <div>
                <h1 className={styles.name}>{profile.name}</h1>
                <div className={styles.tags}>
                  <span className={`${styles.tag} ${statusCls}`}>{statusLabel}</span>
                  <span className={styles.tag}>{profile.sector}</span>
                  {profile.plaza && <span className={styles.tag}><Icon name="pin" size={12} style={{ verticalAlign: -2 }} /> {profile.plaza}</span>}
                </div>
              </div>
            </div>
            <div className={styles.actions}>
              <a className={`${styles.act} ${!profile.phone ? styles.actOff : ''}`} href={profile.phone ? `tel:${profile.phone.replace(/\s/g, '')}` : undefined}><Icon name="phone" size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Llamar</a>
              <a className={`${styles.act} ${styles.actPrimary} ${!wa ? styles.actOff : ''}`} href={wa || undefined} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Enviar estado de cuenta</a>
            </div>
            {!profile.phone && <div className={styles.kpiHint}>Agrega un teléfono en “Datos” para llamar o escribir por WhatsApp.</div>}
          </div>

          <div className={styles.kpis}>
            <div className={`${styles.kpi} ${styles.kpiBig}`}>
              <div className={styles.kpiLabel}>Saldo actual</div>
              <div className={`${styles.kpiValue} ${balance > 0 ? styles.debt : balance < 0 ? styles.info : styles.good}`}>{money(balance)}</div>
              <div className={styles.kpiHint}>{balance > 0 ? 'El cliente debe' : balance < 0 ? 'Saldo a favor del cliente' : 'Sin deuda'}</div>
            </div>
            <div className={styles.kpi}><div className={styles.kpiLabel}>Vacías que debe</div><div className={styles.kpiValue}>{profile.packaging}</div></div>
            <div className={styles.kpi}><div className={styles.kpiLabel}>Facturado 30 días</div><div className={styles.kpiValue}>{money(profile.billed30)}</div></div>
            <div className={styles.kpi}><div className={styles.kpiLabel}>Pagado 30 días</div><div className={`${styles.kpiValue} ${styles.good}`}>{money(profile.paid30)}</div></div>
            <div className={styles.kpi}><div className={styles.kpiLabel}>Sin pagar</div>
              <div className={styles.kpiValue}>{profile.daysSincePayment == null ? '—' : `${profile.daysSincePayment} d`}</div></div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Actividad</h2>
            <div className={styles.pair}>
              <div className={styles.mini}>
                <div className={styles.miniTitle}>Última compra</div>
                {profile.lastPurchase ? (<>
                  <div className={styles.miniMain}>{money(profile.lastPurchase.total)}</div>
                  <div className={styles.itemDetail}>{profile.lastPurchase.boxes} cajas · {fmtShort(profile.lastPurchase.date)} · {ago(profile.daysSincePurchase)}</div>
                </>) : <div className={styles.itemDetail}>Sin compras</div>}
              </div>
              <div className={styles.mini}>
                <div className={styles.miniTitle}>Último pago</div>
                {profile.lastPayment ? (<>
                  <div className={styles.miniMain}>{money(profile.lastPayment.amount)}</div>
                  <div className={styles.itemDetail}>{profile.lastPayment.label} · {fmtShort(profile.lastPayment.date)} · {ago(profile.daysSincePayment)}</div>
                </>) : <div className={styles.itemDetail}>Sin pagos</div>}
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Estado de cuenta</h2>
            <div className={styles.row}><span>Saldo anterior</span><strong>{money(profile.openingBalance)}</strong></div>
            <div className={styles.row}><span>+ Facturado</span><strong>{money(profile.billed)}</strong></div>
            <div className={styles.row}><span>− Descuentos y faltantes</span><strong>{money(profile.discounts)}</strong></div>
            <div className={styles.row}><span>− Pagos</span><strong>{money(profile.paid)}</strong></div>
            <div className={`${styles.row} ${styles.rowTotal}`}><strong>Saldo</strong><strong>{money(balance)}</strong></div>
          </div>
        </div>

        <div className={styles.main}>
          <div className={styles.tabs}>
            {[['historial', 'Historial'], ['pago', 'Registrar pago'], ['datos', 'Datos'], ['notas', `Notas${profile.notes.length ? ` (${profile.notes.length})` : ''}`]].map(([k, l]) => (
              <button key={k} className={`${styles.tab} ${tab === k ? styles.tabOn : ''}`} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          <div className={styles.card}>
            {tab === 'historial' && (<>
              <Timeline items={profile.timeline} />
              {profile.hasMore && <button className={`${styles.btn} ${styles.btnGhost} ${styles.moreBtn}`} onClick={() => setLimit(l => l + 40)}>Ver más movimientos</button>}
            </>)}
            {tab === 'pago' && <PaymentForm profile={profile} reload={load} fail={setError} />}
            {tab === 'datos' && <DataForm key={`${profile.name}-${profile.sectorId}-${profile.phone}-${profile.plaza}`} profile={profile} sectors={sectors} reload={load} fail={setError} />}
            {tab === 'notas' && <Notes profile={profile} reload={load} fail={setError} />}
          </div>
        </div>
      </div>

      {error && <div className={styles.toast} role="alert" onClick={() => setError('')}><Icon name="alert" size={18} /> {error}</div>}
    </div>
  )
}
