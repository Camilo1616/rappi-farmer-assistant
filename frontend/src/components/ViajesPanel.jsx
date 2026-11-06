import { useState, useEffect, useCallback } from 'react'
import Icon from './Icon'
import { getTripDay, createTrip, deleteTrip, addTripEntry, deleteTripEntry, savePreset, deletePreset } from '../services/despachoService'
import styles from '../pages/DespachoPage.module.css'

const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0)

function EntryForm({ trip, date, presets, run }) {
  const [type, setType] = useState('EXPENSE')
  const [concept, setConcept] = useState('')
  const [boxes, setBoxes] = useState('')
  const [unit, setUnit] = useState('')
  const [amount, setAmount] = useState('')

  const applyPreset = (id) => {
    const p = presets.find(x => String(x.id) === id)
    if (!p) return
    setType(p.kind); setConcept(p.concept); setUnit(p.unitAmount != null ? String(p.unitAmount) : '')
    if (!p.perBox) setBoxes('')
  }
  const computed = Number(boxes) > 0 && Number(unit) > 0 ? Number(boxes) * Number(unit) : Number(amount) || 0

  return (
    <form className={styles.payForm} onSubmit={e => {
      e.preventDefault()
      run(async () => {
        const d = await addTripEntry({
          date, tripId: trip.id, type, concept,
          boxes: Number(boxes) > 0 ? Number(boxes) : null,
          unitAmount: Number(boxes) > 0 && Number(unit) > 0 ? Number(unit) : null,
          amount: Number(boxes) > 0 && Number(unit) > 0 ? null : Number(amount),
        })
        setConcept(''); setBoxes(''); setUnit(''); setAmount('')
        return d
      })
    }}>
      <select className={styles.input} defaultValue="" onChange={e => applyPreset(e.target.value)} aria-label="Tarifa frecuente">
        <option value="">Tarifa frecuente…</option>
        {presets.map(p => <option key={p.id} value={p.id}>{p.kind === 'INCOME' ? '+' : '−'} {p.concept}</option>)}
      </select>
      <select className={styles.input} value={type} onChange={e => setType(e.target.value)}>
        <option value="EXPENSE">Gasto</option><option value="INCOME">Ingreso (flete)</option>
      </select>
      <input className={styles.input} placeholder="Concepto (ACPM, peajes, flete Jbell…)" value={concept}
        onChange={e => setConcept(e.target.value)} required />
      <input className={styles.input} type="number" inputMode="numeric" min="1" placeholder="Cajas (opcional)" value={boxes}
        onChange={e => setBoxes(e.target.value)} />
      {Number(boxes) > 0
        ? <input className={styles.input} type="number" inputMode="numeric" min="1" placeholder="Tarifa por caja ($)" value={unit}
            onChange={e => setUnit(e.target.value)} required />
        : <input className={styles.input} type="number" inputMode="numeric" min="1" placeholder="Valor ($)" value={amount}
            onChange={e => setAmount(e.target.value)} required />}
      <div className={styles.preview}>Total: <strong>{money(computed)}</strong></div>
      <button className={styles.btn} type="submit">Agregar línea</button>
    </form>
  )
}

function PresetsEditor({ presets, date, run }) {
  const [kind, setKind] = useState('EXPENSE')
  const [concept, setConcept] = useState('')
  const [unit, setUnit] = useState('')
  const [perBox, setPerBox] = useState(false)
  return (
    <div className={styles.closeBox}>
      {presets.map(p => (
        <div key={p.id} className={styles.cropPriceRow}>
          <span>{p.kind === 'INCOME' ? '+' : '−'} {p.concept}{p.unitAmount != null ? ` · ${money(p.unitAmount)}${p.perBox ? ' / caja' : ''}` : ''}</span>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => run(() => deletePreset(p.id, date))}>Quitar</button>
        </div>
      ))}
      <form className={styles.form} style={{ marginTop: 10 }} onSubmit={e => {
        e.preventDefault()
        run(async () => {
          const d = await savePreset({ kind, concept, unitAmount: Number(unit) > 0 ? Number(unit) : null, perBox }, date)
          setConcept(''); setUnit(''); setPerBox(false)
          return d
        })
      }}>
        <select className={styles.input} value={kind} onChange={e => setKind(e.target.value)}>
          <option value="EXPENSE">Gasto</option><option value="INCOME">Ingreso</option>
        </select>
        <input className={styles.input} placeholder="Concepto" value={concept} onChange={e => setConcept(e.target.value)} required />
        <input className={styles.input} type="number" inputMode="numeric" min="0" placeholder="Tarifa ($, opcional)" value={unit}
          onChange={e => setUnit(e.target.value)} />
        <label className={styles.check}><input type="checkbox" checked={perBox} onChange={e => setPerBox(e.target.checked)} /> Por caja</label>
        <button className={styles.btn} type="submit">Guardar tarifa</button>
      </form>
      <div className={styles.small}>Si el concepto ya existe, se actualiza su tarifa. Ej.: “Flete finca” $4.500 por caja; “Conductor por caja” $1.000.</div>
    </div>
  )
}

/** Viajes del conductor: fletes cobrados, gastos y resultado neto de cada viaje. */
export default function ViajesPanel({ date, onError }) {
  const [data, setData] = useState(null)
  const [driver, setDriver] = useState('')
  const [dest, setDest] = useState('')
  const [showPresets, setShowPresets] = useState(false)

  const load = useCallback(() => getTripDay(date).then(setData).catch(() => onError('No se pudieron cargar los viajes')), [date, onError])
  useEffect(() => { load() }, [load])

  const run = async (fn) => {
    onError('')
    try { setData(await fn()) } catch (e) { onError(e.response?.data?.message || 'Error inesperado'); load() }
  }
  if (!data) return <div className={styles.small}>Cargando viajes…</div>
  const net = Number(data.net)

  return (
    <div>
      <div className={styles.cards}>
        <div className={styles.card}><div className={styles.cardLabel}>Ingresos (fletes)</div><div className={`${styles.cardValue} ${styles.in}`}>{money(data.income)}</div></div>
        <div className={styles.card}><div className={styles.cardLabel}>Gastos</div><div className={`${styles.cardValue} ${styles.out}`}>{money(data.expense)}</div></div>
        <div className={styles.card}><div className={styles.cardLabel}>Resultado de viajes</div><div className={`${styles.cardValue} ${net >= 0 ? styles.in : styles.out}`}>{money(net)}</div></div>
      </div>

      {data.trips.length === 0 && <div className={styles.small} style={{ marginBottom: 12 }}>No hay viajes este día.</div>}
      {data.trips.map(t => (
        <div key={t.id} className={styles.crop}>
          <div className={styles.cropHead}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon name="truck" size={16} />{t.destination || 'Viaje'}{t.driverName ? ` · ${t.driverName}` : ''}</span>
            <span className={`${styles.meta} ${Number(t.net) >= 0 ? styles.in : styles.out}`}>{money(t.net)}</span>
          </div>
          {t.entries.length === 0 && <div className={styles.small} style={{ padding: '8px 14px' }}>Sin líneas todavía.</div>}
          {t.entries.map(e => (
            <div key={e.id} className={styles.entry}>
              <span className={styles.entryMain}>
                <strong>{e.concept}</strong>
                {e.boxes != null && <span className={styles.small}>{e.boxes} cajas × {money(e.unitAmount)}</span>}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={e.type === 'INCOME' ? styles.in : styles.out}>{e.type === 'INCOME' ? '+' : '−'}{money(e.amount)}</span>
                <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => run(() => deleteTripEntry(e.id, date))} aria-label="Quitar línea"><Icon name="x" size={14} /></button>
              </span>
            </div>
          ))}
          <EntryForm trip={t} date={date} presets={data.presets} run={run} />
          <div style={{ padding: '0 14px 12px' }}>
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => run(() => deleteTrip(t.id, date))}>Eliminar viaje</button>
          </div>
        </div>
      ))}

      <form className={styles.form} onSubmit={e => {
        e.preventDefault()
        run(async () => { const d = await createTrip({ date, driverName: driver, destination: dest }); setDriver(''); setDest(''); return d })
      }}>
        <input className={styles.input} placeholder="Destino (Pereira, Neiva…)" value={dest} onChange={e => setDest(e.target.value)} />
        <input className={styles.input} placeholder="Conductor" value={driver} onChange={e => setDriver(e.target.value)} />
        <button className={styles.btn} type="submit">Nuevo viaje</button>
      </form>

      <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setShowPresets(s => !s)}>
        {showPresets ? 'Cerrar ajustes' : 'Ajustes: tarifas frecuentes'}
      </button>
      {showPresets && <div style={{ marginTop: 10 }}><PresetsEditor presets={data.presets} date={date} run={run} /></div>}
    </div>
  )
}
