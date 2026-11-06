import { useState, useEffect, useCallback } from 'react'
import Icon from './Icon'
import {
  getRuns, createRun, deleteRun, addRunClient, removeRunItem, collectItem, resolveItem, reviewItem,
  deleteRunPayment, deleteEmpties, handoverRun, reopenRun, getTripDay, searchClients,
} from '../services/despachoService'
import styles from '../pages/DespachoPage.module.css'

const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0)
const METHODS = [['EFECTIVO', 'Efectivo'], ['NEQUI', 'Nequi'], ['CONSIGNACION', 'Consignación']]
const RECEIVERS = ['Conductor', 'Angela', 'Lorena']
const RESOLUTIONS = [['DEBE', 'Quedó debiendo'], ['DESCUENTO', 'Descuento'], ['FALTANTE', 'Faltante']]
const STATUS = {
  SIN_COBRO: ['Sin cobrar', styles.badgeNone],
  PARCIAL: ['Parcial', styles.badgeWarn],
  COMPLETO: ['Pagó', styles.badgeOk],
}

/** Texto de la hoja "ciega" para mandar al conductor por WhatsApp. */
function sheetText(run) {
  const d = new Date(run.day + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  const lines = [`Hoja de cobro ${d}${run.destination ? ' · ' + run.destination : ''}`]
  let sector = null
  run.items.forEach(i => {
    if (i.sector !== sector) { sector = i.sector; lines.push('', sector.toUpperCase()) }
    lines.push(`• ${i.name} — debe ${money(i.owed)}${i.packaging > 0 ? ` · vacías ${i.packaging}` : ''}`)
  })
  lines.push('', `Total a cobrar: ${money(run.totals.owed)}`)
  return lines.join('\n')
}

function ItemCard({ item, run_, busy }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('EFECTIVO')
  const [by, setBy] = useState('Conductor')
  const [empties, setEmpties] = useState('')
  const [note, setNote] = useState('')
  const [resolving, setResolving] = useState(null)
  const [resAmount, setResAmount] = useState('')
  const [badge, badgeCls] = STATUS[item.status]

  return (
    <div>
      <button className={styles.itemHead} onClick={() => setOpen(o => !o)}>
        <span>
          <strong>{item.name}</strong>{item.needsReview && <span className={styles.moraTag} style={{ background: 'rgba(217,119,6,.15)', color: '#D97706' }}>Duda</span>}{item.addedManually && <span className={styles.small}> · agregado</span>}
          <div className={styles.small}>Debía {money(item.owed)}{item.packaging > 0 ? ` · vacías ${item.packaging}` : ''}</div>
        </span>
        <span style={{ textAlign: 'right' }}>
          <span className={`${styles.badge} ${badgeCls}`}>{badge}</span>
          <div className={styles.small}>{item.collected > 0 ? `Cobró ${money(item.collected)}` : ''}</div>
        </span>
      </button>

      {item.needsClarification && (
        <div className={styles.callout}>
          <strong>Faltan {money(item.remaining)} de {money(item.owed)}. ¿Qué pasó?</strong>
          <div className={styles.chips}>
            {RESOLUTIONS.map(([k, l]) => (
              <button key={k} className={`${styles.chip} ${resolving === k ? styles.chipOn : ''}`}
                onClick={() => {
                  if (k === 'DEBE') run_(() => resolveItem(item.id, { resolution: 'DEBE' }))
                  else { setResolving(k); setResAmount(String(Number(item.remaining))) }
                }}>{l}</button>
            ))}
          </div>
          {resolving && (
            <form className={styles.form} style={{ margin: 0 }} onSubmit={e => {
              e.preventDefault()
              run_(async () => { const d = await resolveItem(item.id, { resolution: resolving, amount: Number(resAmount), note }); setResolving(null); return d })
            }}>
              <input className={styles.input} type="number" inputMode="numeric" min="1" value={resAmount}
                onChange={e => setResAmount(e.target.value)} aria-label="Valor" required />
              <input className={styles.input} placeholder="Nota (opcional)" value={note} onChange={e => setNote(e.target.value)} />
              <button className={styles.btn} type="submit">Guardar</button>
            </form>
          )}
        </div>
      )}

      {open && (
        <div className={styles.itemBody}>
          {item.payments.map(p => (
            <div key={p.id} className={styles.payRow} style={{ padding: '6px 0' }}>
              <span>{p.label}{p.method ? ` · ${p.method.toLowerCase()}` : ''} · <strong>{money(p.amount)}</strong>
                {p.receivedBy ? ` · ${p.receivedBy}` : ''}{p.note ? ` · ${p.note}` : ''}</span>
              <button className={`${styles.btn} ${styles.btnGhost}`} aria-label="Quitar pago"
                onClick={() => run_(() => deleteRunPayment(p.id))}><Icon name="x" size={14} /></button>
            </div>
          ))}
          {item.empties.map(e => (
            <div key={e.id} className={styles.payRow} style={{ padding: '6px 0' }}>
              <span><Icon name="box" size={14} style={{ verticalAlign: -2 }} /> Vacías recibidas · <strong>{e.boxes}</strong></span>
              <button className={`${styles.btn} ${styles.btnGhost}`} aria-label="Quitar vacías"
                onClick={() => run_(() => deleteEmpties(e.id))}><Icon name="x" size={14} /></button>
            </div>
          ))}

          <form className={styles.form} style={{ margin: 0 }} onSubmit={e => {
            e.preventDefault()
            run_(async () => {
              const d = await collectItem(item.id, {
                amount: Number(amount) > 0 ? Number(amount) : null, method, receivedBy: by,
                note, empties: Number(empties) > 0 ? Number(empties) : null,
              })
              setAmount(''); setEmpties(''); setNote('')
              return d
            })
          }}>
            <input className={styles.input} type="number" inputMode="numeric" min="0" placeholder="Valor cobrado ($)"
              value={amount} onChange={e => setAmount(e.target.value)} />
            <div className={styles.chips} style={{ width: '100%' }}>
              {METHODS.map(([k, l]) => (
                <button type="button" key={k} className={`${styles.chip} ${method === k ? styles.chipOn : ''}`}
                  onClick={() => setMethod(k)}>{l}</button>
              ))}
            </div>
            <div className={styles.chips} style={{ width: '100%' }}>
              <span className={styles.small} style={{ alignSelf: 'center' }}>Recibió:</span>
              {RECEIVERS.map(r => (
                <button type="button" key={r} className={`${styles.chip} ${by === r ? styles.chipOn : ''}`}
                  onClick={() => setBy(r)}>{r}</button>
              ))}
            </div>
            <input className={styles.input} type="number" inputMode="numeric" min="0" placeholder="Vacías recibidas"
              value={empties} onChange={e => setEmpties(e.target.value)} />
            <input className={styles.input} placeholder="Nota (opcional)" value={note} onChange={e => setNote(e.target.value)} />
            <button className={styles.btn} type="submit" disabled={busy}>Registrar</button>
          </form>

          <div className={styles.chips}>
            <button className={`${styles.chip} ${item.needsReview ? styles.chipOn : ''}`}
              onClick={() => run_(() => reviewItem(item.id, !item.needsReview))}>{item.needsReview ? 'Quitar duda' : 'Marcar duda'}</button>
            <button className={styles.chip} onClick={() => run_(() => removeRunItem(item.id))}>Quitar de la hoja</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Handover({ run, run_ }) {
  const h = run.handover
  const [amount, setAmount] = useState('')
  const [to, setTo] = useState('Angela')
  const diff = h.difference != null ? Number(h.difference) : null
  return (
    <div className={styles.handover}>
      <strong>Cuadre del efectivo</strong>
      <div className={styles.plRow}><span>Efectivo cobrado</span><strong>{money(h.cash)}</strong></div>
      {run.tripId && <div className={styles.plRow}><span>− Gastos del viaje</span><strong>{money(h.tripExpenses)}</strong></div>}
      <div className={styles.plRow}><span>Debe entregar</span><strong>{money(h.cashExpected)}</strong></div>
      {run.closed ? (
        <>
          <div className={styles.plRow}><span>Entregó a {h.handedTo}</span><strong>{money(h.handedAmount)}</strong></div>
          <div className={diff === 0 ? styles.in : diff < 0 ? styles.out : styles.in}>
            {diff === 0 ? 'Cuadra' : diff < 0 ? `Faltan ${money(-diff)}` : `Sobran ${money(diff)}`}
          </div>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => run_(() => reopenRun(run.id))}>Reabrir</button>
        </>
      ) : (
        <form className={styles.form} style={{ margin: 0 }} onSubmit={e => {
          e.preventDefault()
          run_(() => handoverRun(run.id, { handedAmount: Number(amount), handedTo: to }))
        }}>
          <input className={styles.input} type="number" inputMode="numeric" min="0" placeholder="Entregó ($)"
            value={amount} onChange={e => setAmount(e.target.value)} required />
          <div className={styles.chips}>
            {['Angela', 'Lorena'].map(r => (
              <button type="button" key={r} className={`${styles.chip} ${to === r ? styles.chipOn : ''}`} onClick={() => setTo(r)}>{r}</button>
            ))}
          </div>
          <button className={styles.btn} type="submit">Cerrar y cuadrar</button>
        </form>
      )}
    </div>
  )
}

function AddClient({ run, date, run_ }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const search = async (e) => {
    e.preventDefault()
    setResults(await searchClients(q, date))
  }
  return (
    <div style={{ padding: '0 14px 12px' }}>
      <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setOpen(o => !o)}>Agregar cliente que no está</button>
      {open && (
        <div style={{ marginTop: 8 }}>
          <form className={styles.form} onSubmit={search}>
            <input className={styles.input} placeholder="Nombre del cliente…" value={q} onChange={e => setQ(e.target.value)} />
            <button className={styles.btn} type="submit">Buscar</button>
          </form>
          {results && results.length === 0 && <div className={styles.small}>Sin resultados</div>}
          {results && results.map(c => (
            <div key={c.id} className={styles.payRow} style={{ padding: '8px 0' }}>
              <span><strong>{c.name}</strong><div className={styles.small}>{c.sector} · debe {money(c.balance)}</div></span>
              <button className={styles.btn} onClick={() => { run_(() => addRunClient(run.id, c.id)); setOpen(false); setResults(null); setQ('') }}>Agregar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RunCard({ run, date, run_, busy }) {
  const t = run.totals
  const share = () => window.open(`https://wa.me/?text=${encodeURIComponent(sheetText(run))}`, '_blank', 'noopener')
  const copy = async () => { try { await navigator.clipboard.writeText(sheetText(run)) } catch { /* sin portapapeles */ } }
  return (
    <div className={styles.crop}>
      <div className={styles.cropHead}>
        <span>{run.destination || 'Hoja de cobro'}{run.driverName ? ` · ${run.driverName}` : ''}</span>
        <span className={`${styles.badge} ${run.closed ? styles.badgeOk : styles.badgeWarn}`}>{run.closed ? 'Cuadrada' : 'Abierta'}</span>
      </div>
      <div className={styles.statGrid}>
        <div className={styles.stat}><div className={styles.statLabel}>Por cobrar</div><div className={styles.statVal}>{money(t.owed)}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>Cobrado</div><div className={`${styles.statVal} ${styles.in}`}>{money(t.collected)}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>Efectivo</div><div className={styles.statVal}>{money(t.cash)}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>Nequi</div><div className={styles.statVal}>{money(t.nequi)}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>Consignación</div><div className={styles.statVal}>{money(t.deposit)}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>Descuentos/faltantes</div><div className={styles.statVal}>{money(t.discounts)}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>Falta</div><div className={`${styles.statVal} ${styles.out}`}>{money(t.remaining)}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>Vacías recibidas</div><div className={styles.statVal}>{t.emptiesReturned}</div></div>
      </div>
      {(t.pendingClarifications > 0 || t.reviews > 0) && (
        <div className={styles.alertBar}>
          {t.pendingClarifications > 0 && `${t.pendingClarifications} pago(s) por aclarar`}
          {t.pendingClarifications > 0 && t.reviews > 0 && ' · '}
          {t.reviews > 0 && `${t.reviews} duda(s) por confirmar`}
        </div>
      )}
      <div className={styles.chips} style={{ padding: '10px 14px' }}>
        <button className={styles.btn} onClick={share}><Icon name="send" size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Enviar hoja por WhatsApp</button>
        <button className={`${styles.btn} ${styles.btnGhost}`} onClick={copy}>Copiar</button>
      </div>

      {run.items.map((i, idx) => (
        <div key={i.id}>
          {(idx === 0 || run.items[idx - 1].sector !== i.sector) && <div className={styles.sectorLabel}>{i.sector}</div>}
          <ItemCard item={i} run_={run_} busy={busy} />
        </div>
      ))}

      <AddClient run={run} date={date} run_={run_} />
      <Handover run={run} run_={run_} />
      <div style={{ padding: '0 14px 12px' }}>
        <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => run_(() => deleteRun(run.id))}>Eliminar hoja</button>
      </div>
    </div>
  )
}

/** Cobro presencial: hoja del conductor, pagos por método, diferencias y cuadre del efectivo. */
export default function CobrosPanel({ date, sectors, onError }) {
  const [runs, setRuns] = useState(null)
  const [trips, setTrips] = useState([])
  const [busy, setBusy] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [driver, setDriver] = useState('')
  const [dest, setDest] = useState('')
  const [tripId, setTripId] = useState('')
  const [picked, setPicked] = useState([])

  const load = useCallback(() => Promise.all([getRuns(date), getTripDay(date)])
    .then(([r, t]) => { setRuns(r); setTrips(t.trips) })
    .catch(() => onError('No se pudieron cargar los cobros')), [date, onError])
  useEffect(() => { load() }, [load])

  const run_ = async (fn) => {
    onError(''); setBusy(true)
    try { setRuns(await fn()) } catch (e) { onError(e.response?.data?.message || 'Error inesperado'); load() }
    finally { setBusy(false) }
  }
  if (!runs) return <div className={styles.small}>Cargando cobros…</div>

  return (
    <div>
      {runs.length === 0 && <div className={styles.small} style={{ marginBottom: 12 }}>No hay hojas de cobro este día.</div>}
      {runs.map(r => <RunCard key={r.id} run={r} date={date} run_={run_} busy={busy} />)}

      <button className={`${styles.btn} ${showNew ? styles.btnGhost : ''}`} onClick={() => setShowNew(s => !s)}>
        {showNew ? 'Cancelar' : 'Nueva hoja de cobro'}
      </button>
      {showNew && (
        <form className={styles.closeBox} style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={e => {
          e.preventDefault()
          run_(async () => {
            const d = await createRun({ date, driverName: driver, destination: dest, tripId: tripId ? Number(tripId) : null, sectorIds: picked })
            setShowNew(false); setDriver(''); setDest(''); setTripId(''); setPicked([])
            return d
          })
        }}>
          <div className={styles.small}>Se incluyen los clientes de los sectores elegidos que deban plata o vacías.</div>
          <div className={styles.chips}>
            {sectors.map(s => (
              <button type="button" key={s.id} className={`${styles.chip} ${picked.includes(s.id) ? styles.chipOn : ''}`}
                onClick={() => setPicked(p => p.includes(s.id) ? p.filter(x => x !== s.id) : [...p, s.id])}>{s.name}</button>
            ))}
          </div>
          <input className={styles.input} placeholder="Destino / plaza" value={dest} onChange={e => setDest(e.target.value)} />
          <input className={styles.input} placeholder="Conductor" value={driver} onChange={e => setDriver(e.target.value)} />
          <select className={styles.input} value={tripId} onChange={e => setTripId(e.target.value)}>
            <option value="">Sin viaje vinculado (no descuenta gastos)</option>
            {trips.map(t => <option key={t.id} value={t.id}>{t.destination || 'Viaje'}{t.driverName ? ` · ${t.driverName}` : ''}</option>)}
          </select>
          <button className={styles.btn} type="submit" disabled={busy || picked.length === 0}>Armar hoja</button>
        </form>
      )}
    </div>
  )
}
