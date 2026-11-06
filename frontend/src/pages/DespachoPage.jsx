import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../services/authService'
import { useAuth } from '../context/AuthContext'
import {
  getDay, setHarvest, setDiscard, setLine, setPrice, createSector, createClient,
} from '../services/despachoService'
import CarteraPanel from '../components/CarteraPanel'
import ReportPanel from '../components/ReportPanel'
import ClientSearch from '../components/ClientSearch'
import styles from './DespachoPage.module.css'

const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0)
const todayStr = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD en hora local
const shiftDay = (d, delta) => {
  const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + delta); return x.toLocaleDateString('en-CA')
}

/** Contador +/- con botones grandes para uso en celular. */
function Stepper({ label, value, onChange }) {
  return (
    <div className={styles.stepper}>
      <span className={styles.small}>{label}</span>
      <div className={styles.stepCtl}>
        <button className={styles.stepBtn} onClick={() => onChange(Math.max(0, value - 1))} aria-label={`menos ${label}`}>−</button>
        <span className={styles.stepVal}>{value}</span>
        <button className={styles.stepBtn} onClick={() => onChange(value + 1)} aria-label={`más ${label}`}>+</button>
      </div>
    </div>
  )
}

/** Input numérico que guarda al salir del campo (evita una petición por tecla). */
function NumberField({ value, onCommit, label }) {
  const commit = (el) => {
    const n = Math.max(0, parseInt(el.value, 10) || 0)
    el.value = String(n)
    if (n !== value) onCommit(n)
  }
  // key={value}: si el valor del servidor cambia, el input se reinicia con el dato real
  return (
    <input key={value} className={styles.num} type="number" inputMode="numeric" min="0" aria-label={label}
      defaultValue={value} onBlur={e => commit(e.target)}
      onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
  )
}

function ClientCard({ client, stock, save }) {
  const [open, setOpen] = useState(false)
  const lineOf = (cat) => client.lines.find(l => l.category === cat) || { ordered: 0, delivered: 0 }
  return (
    <div>
      <button className={styles.clientHead} onClick={() => setOpen(o => !o)}>
        <span><strong>{client.name}</strong>
          <div className={styles.small}>Pedido {client.orderedBoxes} · Entrega {client.deliveredBoxes}</div></span>
        <span className={styles.meta}>{money(client.invoiceTotal)} {open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className={styles.lines}>
          {stock.map(s => {
            const l = lineOf(s.category)
            const diff = l.delivered - l.ordered
            return (
              <div key={s.category} className={styles.lineRow}>
                <div>
                  <div className={styles.lineCat}>{s.label}</div>
                  <div className={styles.small}>
                    Hay {s.available}
                    {diff !== 0 && <span className={diff > 0 ? styles.diffMore : styles.diffLess}>
                      {' '}· {diff > 0 ? `+${diff} de más` : `${diff} de menos`}</span>}
                  </div>
                </div>
                <Stepper label="Pedido" value={l.ordered}
                  onChange={n => save(client.id, s.category, n, l.delivered)} />
                <Stepper label="Entrega" value={l.delivered}
                  onChange={n => save(client.id, s.category, l.ordered, n)} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function DespachoPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [date, setDate] = useState(todayStr())
  const [day, setDay] = useState(null)
  const [error, setError] = useState('')
  const [openSectors, setOpenSectors] = useState({})
  const [tab, setTab] = useState('despacho')
  const [showAdmin, setShowAdmin] = useState(false)
  const [sectorName, setSectorName] = useState('')
  const [client, setClient] = useState({ sectorId: '', name: '', openingBalance: '' })

  const load = useCallback(() =>
    getDay(date).then(setDay).catch(() => setError('No se pudo cargar el día')), [date])
  useEffect(() => { load() }, [load])

  // Ejecuta una acción; si el backend rechaza (p. ej. no hay stock) muestra el mensaje y recarga
  const run = async (fn) => {
    setError('')
    try { const d = await fn(); if (d?.stock) setDay(d); else await load() }
    catch (e) { setError(e.response?.data?.message || 'Error inesperado'); load() }
  }
  const saveLine = (cid, cat, ordered, delivered) => run(() => setLine(date, cid, cat, ordered, delivered))

  if (!day) return <div className={styles.page}>{error || 'Cargando…'}</div>
  const s = day.summary

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>🍓 Despacho{user?.fullName ? ` · ${user.fullName.split(' ')[0]}` : ''}</div>
        <button className={`${styles.btn} ${styles.btnGhost}`}
          onClick={() => { logout(); navigate('/login') }}>Salir</button>
      </div>

      <div className={styles.dateRow}>
        <button className={styles.nav} onClick={() => setDate(shiftDay(date, -1))} aria-label="Día anterior">‹</button>
        <input className={styles.date} type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} />
        <button className={styles.nav} onClick={() => setDate(shiftDay(date, 1))} aria-label="Día siguiente">›</button>
      </div>

      <ClientSearch date={date} />

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'despacho' ? styles.tabOn : ''}`} onClick={() => setTab('despacho')}>Despacho</button>
        <button className={`${styles.tab} ${tab === 'cartera' ? styles.tabOn : ''}`} onClick={() => setTab('cartera')}>Cartera</button>
        <button className={`${styles.tab} ${tab === 'reportes' ? styles.tabOn : ''}`} onClick={() => setTab('reportes')}>Reportes</button>
      </div>

      {tab === 'cartera' ? <CarteraPanel date={date} onError={setError} />
        : tab === 'reportes' ? <ReportPanel date={date} onError={setError} /> : (<>
      <div className={styles.cards}>
        <div className={styles.card}><div className={styles.cardLabel}>Cosechado hoy</div><div className={styles.cardValue}>{s.harvestedBoxes}</div></div>
        <div className={styles.card}><div className={styles.cardLabel}>Arrastre de ayer</div><div className={styles.cardValue}>{s.carryoverBoxes}</div></div>
        <div className={styles.card}><div className={styles.cardLabel}>Despachado</div><div className={styles.cardValue}>{s.deliveredBoxes}</div></div>
        <div className={styles.card}><div className={styles.cardLabel}>Vendido hoy</div><div className={styles.cardValue}>{money(s.salesTotal)}</div></div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Fresa disponible por categoría</h2>
        <div className={styles.stockGrid}>
          {day.stock.map(c => (
            <div key={c.category} className={`${styles.stock} ${c.available <= 0 ? styles.stockEmpty : ''}`}>
              <div className={styles.stockName}>{c.label}
                {c.carryover > 0 && <span className={styles.first}>🔥 {c.carryover} sale primero</span>}</div>
              <div className={styles.avail}>{c.available}</div>
              <div className={styles.small}>{money(c.price)} / caja</div>
              <div className={styles.mini}><span className={styles.small}>Cosecha</span>
                <NumberField label={`Cosecha ${c.label}`} value={c.harvested}
                  onCommit={n => run(() => setHarvest(date, c.category, n))} /></div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Clientes por sector</h2>
        {day.sectors.length === 0 && <div className={styles.small}>Aún no hay sectores. Créalos en “Administrar”.</div>}
        {day.sectors.map(sec => (
          <div key={sec.id} className={styles.sector}>
            <button className={styles.sectorHead} onClick={() => setOpenSectors(o => ({ ...o, [sec.id]: !o[sec.id] }))}>
              <span>{sec.name}<div className={styles.small}>{sec.clients.length} cliente{sec.clients.length !== 1 ? 's' : ''}</div></span>
              <span className={styles.meta}>Entrega {sec.deliveredBoxes} / Pedido {sec.orderedBoxes}<br />
                {money(sec.invoiceTotal)} {openSectors[sec.id] ? '▲' : '▼'}</span>
            </button>
            {openSectors[sec.id] && sec.clients.map(c => (
              <ClientCard key={c.id} client={c} stock={day.stock} save={saveLine} />
            ))}
          </div>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Cierre del día · cosechado vs vendido</h2>
        <div className={styles.closeBox}>
          <div className={`${styles.closeRow} ${styles.closeHead}`}>
            <span>Categoría</span><span className={styles.right}>Había</span>
            <span className={styles.right}>Vendió</span><span className={styles.right}>Descarte</span>
            <span className={styles.right}>Sobra</span>
          </div>
          {day.stock.map(c => (
            <div key={c.category} className={styles.closeRow}>
              <span>{c.label}</span>
              <span className={styles.right}>{c.carryover + c.harvested}</span>
              <span className={styles.right}>{c.delivered}</span>
              <NumberField label={`Descarte ${c.label}`} value={c.discarded}
                onCommit={n => run(() => setDiscard(date, c.category, n))} />
              <span className={styles.right}><strong>{c.available}</strong></span>
            </div>
          ))}
          <div className={styles.small} style={{ marginTop: 8 }}>
            Sobran {s.leftoverBoxes} cajas: pasan a mañana y saldrán primero. Registra como descarte lo que no se pueda guardar.
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setShowAdmin(a => !a)}>
          {showAdmin ? 'Cerrar administración' : 'Administrar sectores, clientes y precios'}
        </button>
        {showAdmin && (
          <div style={{ marginTop: 12 }}>
            <form className={styles.form} onSubmit={e => { e.preventDefault(); run(async () => { await createSector(sectorName); setSectorName('') }) }}>
              <input className={styles.input} placeholder="Nuevo sector" value={sectorName}
                onChange={e => setSectorName(e.target.value)} required />
              <button className={styles.btn} type="submit">Crear sector</button>
            </form>
            <form className={styles.form} onSubmit={e => {
              e.preventDefault()
              run(async () => {
                await createClient({ sectorId: Number(client.sectorId), name: client.name,
                  openingBalance: Number(client.openingBalance) || 0 })
                setClient({ ...client, name: '', openingBalance: '' })
              })
            }}>
              <select className={styles.input} value={client.sectorId} required
                onChange={e => setClient({ ...client, sectorId: e.target.value })}>
                <option value="">Sector…</option>
                {day.sectors.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              <input className={styles.input} placeholder="Nombre del cliente" value={client.name}
                onChange={e => setClient({ ...client, name: e.target.value })} required />
              <input className={styles.input} type="number" placeholder="Saldo anterior ($)" value={client.openingBalance}
                onChange={e => setClient({ ...client, openingBalance: e.target.value })} />
              <button className={styles.btn} type="submit">Crear cliente</button>
            </form>
            <div className={styles.sectionTitle}>Precio por caja</div>
            <div className={styles.stockGrid}>
              {day.stock.map(c => (
                <div key={c.category} className={styles.stock}>
                  <div className={styles.stockName}>{c.label}</div>
                  <NumberField label={`Precio ${c.label}`} value={Number(c.price)}
                    onCommit={n => run(async () => { await setPrice(c.category, n) })} />
                </div>
              ))}
            </div>
            <div className={styles.small} style={{ marginTop: 6 }}>
              Un cambio de precio solo aplica a ventas nuevas; las ya registradas conservan su precio.
            </div>
          </div>
        )}
      </section>

      </>)}

      {error && <div className={styles.toast} role="alert" onClick={() => setError('')}>⚠️ {error}</div>}
    </div>
  )
}
