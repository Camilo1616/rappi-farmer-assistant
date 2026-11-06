import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { logout } from '../services/authService'
import { useAuth } from '../context/AuthContext'
import {
  getDay, setHarvest, setDiscard, setLine, setPrice, createSector, createClient,
} from '../services/despachoService'
import CarteraPanel from '../components/CarteraPanel'
import ReportPanel from '../components/ReportPanel'
import CultivosPanel from '../components/CultivosPanel'
import ViajesPanel from '../components/ViajesPanel'
import CobrosPanel from '../components/CobrosPanel'
import PedidosPanel from '../components/PedidosPanel'
import ProfitCard from '../components/ProfitCard'
import NumberField from '../components/NumberField'
import ClientSearch from '../components/ClientSearch'
import AppShell from '../components/AppShell'
import VentasTable from '../components/VentasTable'
import ApkDownload from '../components/ApkDownload'
import UsuariosPanel from '../components/UsuariosPanel'
import Icon from '../components/Icon'
import '../styles/app-theme.css'
import styles from './DespachoPage.module.css'

const NAV = [
  { key: 'ventas', label: 'Ventas', icon: 'tag' },
  { key: 'pedidos', label: 'Pedidos', icon: 'clipboard' },
  { key: 'cobros', label: 'Cobros', icon: 'dollar' },
  { key: 'cartera', label: 'Cartera', icon: 'card' },
  { key: 'cultivos', label: 'Cultivos', icon: 'layers' },
  { key: 'viajes', label: 'Viajes', icon: 'truck' },
  { key: 'reportes', label: 'Reportes', icon: 'chart' },
  { key: 'usuarios', label: 'Usuarios y roles', icon: 'user' },
  { key: 'app', label: 'Descargar app', icon: 'smartphone' },
]
// En celular estas van dentro del botón "Más" de la barra inferior
const MORE = ['cultivos', 'viajes', 'reportes', 'usuarios', 'app']

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

function ClientCard({ client, stock, save }) {
  const [open, setOpen] = useState(false)
  const lineOf = (cat) => client.lines.find(l => l.category === cat) || { ordered: 0, delivered: 0 }
  return (
    <div>
      <button className={styles.clientHead} onClick={() => setOpen(o => !o)}>
        <span><strong>{client.name}</strong>{client.overdue && <span className={styles.moraTag}>En mora</span>}
          <div className={styles.small}>Pedido {client.orderedBoxes} · Entrega {client.deliveredBoxes}</div></span>
        <span className={styles.meta}>{money(client.invoiceTotal)} <Icon name={open ? 'up' : 'down'} size={14} /></span>
      </button>
      {open && client.overdue && (
        <div className={styles.moraBox} style={{ marginTop: 8 }}>
          <strong>Cliente en mora:</strong> debe {money(client.balance)}
          {client.daysSincePayment != null ? ` · ${client.daysSincePayment} días sin pagar` : ' · nunca ha registrado un pago'}.
          Revisa antes de despacharle más producto.
        </div>
      )}
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
  const [params, setParams] = useSearchParams()
  const [date, setDate] = useState(todayStr())
  const [day, setDay] = useState(null)
  const [error, setError] = useState('')
  const [openSectors, setOpenSectors] = useState({})
  const [view, setView] = useState('tabla')
  const [mode, setMode] = useState('entrega')
  const [showAdmin, setShowAdmin] = useState(false)
  const [sectorName, setSectorName] = useState('')
  const [client, setClient] = useState({ sectorId: '', name: '', openingBalance: '', openingPackaging: '' })

  // La sección vive en la URL (?s=cobros): al volver desde la ficha de un cliente queda donde estaba
  const tab = NAV.some(n => n.key === params.get('s')) ? params.get('s') : 'ventas'
  const setTab = (k) => setParams(k === 'ventas' ? {} : { s: k })

  useEffect(() => {
    const prev = document.title
    document.title = 'Panel de ventas'
    return () => { document.title = prev }
  }, [])

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
  const doLogout = () => { logout(); navigate('/login') }

  const current = NAV.find(n => n.key === tab)
  const subtitle = new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  const s = day?.summary

  const dateBar = (
    <div className={styles.dateRow}>
      <button className={styles.nav} onClick={() => setDate(shiftDay(date, -1))} aria-label="Día anterior"><Icon name="left" size={18} /></button>
      <input className={styles.date} type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} />
      <button className={styles.nav} onClick={() => setDate(shiftDay(date, 1))} aria-label="Día siguiente"><Icon name="right" size={18} /></button>
      {date !== todayStr() && <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setDate(todayStr())}>Hoy</button>}
    </div>
  )

  let content
  if (tab === 'app') {
    content = <ApkDownload />
  } else if (tab === 'usuarios') {
    content = <UsuariosPanel actorId={user?.id} actorRole={user?.role} onError={setError} />
  } else if (!day) {
    content = <div className={styles.small}>{error || 'Cargando…'}</div>
  } else if (tab === 'pedidos') {
    content = <PedidosPanel date={date} onError={setError} onChanged={load} />
  } else if (tab === 'cartera') {
    content = <CarteraPanel date={date} onError={setError} />
  } else if (tab === 'cobros') {
    content = <CobrosPanel date={date} sectors={day.sectors} onError={setError} />
  } else if (tab === 'cultivos') {
    content = <CultivosPanel date={date} onError={setError} />
  } else if (tab === 'viajes') {
    content = <ViajesPanel date={date} onError={setError} />
  } else if (tab === 'reportes') {
    content = <ReportPanel date={date} onError={setError} />
  } else {
    content = (<>
      <div className={styles.cards}>
        <div className={styles.card}><div className={styles.cardLabel}>Recibido hoy</div><div className={styles.cardValue}>{s.harvestedBoxes}</div></div>
        <div className={styles.card}><div className={styles.cardLabel}>Arrastre de ayer</div><div className={styles.cardValue}>{s.carryoverBoxes}</div></div>
        <div className={styles.card}><div className={styles.cardLabel}>Despachado</div><div className={styles.cardValue}>{s.deliveredBoxes}</div></div>
        <div className={styles.card}><div className={styles.cardLabel}>Vendido hoy</div><div className={styles.cardValue}>{money(s.salesTotal)}</div></div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Disponible por categoría</h2>
        <div className={styles.stockGrid}>
          {day.stock.map(c => (
            <div key={c.category} className={`${styles.stock} ${c.available <= 0 ? styles.stockEmpty : ''}`}>
              <div className={styles.stockName}>{c.label}
                {c.carryover > 0 && <span className={styles.first}>{c.carryover} sale primero</span>}</div>
              <div className={styles.avail}>{c.available}</div>
              <div className={styles.small}>{money(c.price)} / caja</div>
              {c.cultivoHarvested > 0 && <div className={styles.small}>De cultivos: {c.cultivoHarvested}</div>}
              <div className={styles.mini}><span className={styles.small}>{c.cultivoHarvested > 0 ? 'Ajuste' : 'Entrada'}</span>
                <NumberField label={`Entrada ${c.label}`} value={c.harvested - c.cultivoHarvested}
                  onCommit={n => run(() => setHarvest(date, c.category, n))} /></div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Ventas por cliente</h2>
          <div className={styles.segmented}>
            <button className={`${styles.segBtn} ${view === 'tabla' ? styles.segOn : ''}`} onClick={() => setView('tabla')}>Tabla</button>
            <button className={`${styles.segBtn} ${view === 'tarjetas' ? styles.segOn : ''}`} onClick={() => setView('tarjetas')}>Tarjetas</button>
          </div>
        </div>
        {view === 'tabla'
          ? <VentasTable day={day} mode={mode} onModeChange={setMode} onSave={saveLine} />
          : (<>
            {day.sectors.length === 0 && <div className={styles.small}>Aún no hay sectores. Créalos en “Administrar”.</div>}
            {day.sectors.map(sec => (
              <div key={sec.id} className={styles.sector}>
                <button className={styles.sectorHead} onClick={() => setOpenSectors(o => ({ ...o, [sec.id]: !o[sec.id] }))}>
                  <span>{sec.name}<div className={styles.small}>{sec.clients.length} cliente{sec.clients.length !== 1 ? 's' : ''}</div></span>
                  <span className={styles.meta}>Entrega {sec.deliveredBoxes} / Pedido {sec.orderedBoxes}<br />
                    {money(sec.invoiceTotal)} <Icon name={openSectors[sec.id] ? 'up' : 'down'} size={14} /></span>
                </button>
                {openSectors[sec.id] && sec.clients.map(c => (
                  <ClientCard key={c.id} client={c} stock={day.stock} save={saveLine} />
                ))}
              </div>
            ))}
          </>)}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Cierre del día</h2>
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
            Sobran {s.leftoverBoxes} cajas: pasan a mañana y salen primero. Registra como descarte lo que no se pueda guardar.
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <ProfitCard from={date} to={date} refreshKey={s.salesTotal} />
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
                  openingBalance: Number(client.openingBalance) || 0,
                  openingPackaging: Number(client.openingPackaging) || 0 })
                setClient({ ...client, name: '', openingBalance: '', openingPackaging: '' })
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
              <input className={styles.input} type="number" placeholder="Vacías que debe" value={client.openingPackaging}
                onChange={e => setClient({ ...client, openingPackaging: e.target.value })} />
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

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Aplicación para Android</h2>
        <ApkDownload />
      </section>
    </>)
  }

  return (
    <AppShell items={NAV} moreKeys={MORE} active={tab} onNavigate={setTab} title={current.label} subtitle={subtitle}
      user={user} onLogout={doLogout}>
      {tab !== 'app' && tab !== 'usuarios' && (<>{dateBar}<ClientSearch date={date} /></>)}
      <div className={styles.view}>{content}</div>
      {error && <div className={styles.toast} role="alert" onClick={() => setError('')}><Icon name="alert" size={18} /><span>{error}</span></div>}
    </AppShell>
  )
}
