import { useState, useEffect, useCallback } from 'react'
import { getCultivoDay, createCrop, setCropPrice, setIntake } from '../services/despachoService'
import NumberField from './NumberField'
import styles from '../pages/DespachoPage.module.css'

const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0)
const LABELS = { JUMBO: 'Jumbo', PRIMERA: 'Primera', SEGUNDA: 'Segunda', TERCERA: 'Tercera', CUARTA: 'Cuarta', QUINTA: 'Quinta', MADURA: 'Madura', BOLSAS: 'Bolsas' }

/** Cultivos: producto recibido de cada uno en el día y su precio de compra. Suma sola al stock. */
export default function CultivosPanel({ date, onError }) {
  const [data, setData] = useState(null)
  const [pricesOpen, setPricesOpen] = useState({})
  const [name, setName] = useState('')

  const load = useCallback(() => getCultivoDay(date).then(setData).catch(() => onError('No se pudieron cargar los cultivos')), [date, onError])
  useEffect(() => { load() }, [load])

  const run = async (fn) => {
    onError('')
    try { await fn(); await load() } catch (e) { onError(e.response?.data?.message || 'Error inesperado'); load() }
  }
  if (!data) return <div className={styles.small}>Cargando cultivos…</div>

  return (
    <div>
      <div className={styles.cards}>
        <div className={styles.card}><div className={styles.cardLabel}>Cajas recibidas</div><div className={styles.cardValue}>{data.totalBoxes}</div></div>
        <div className={styles.card}><div className={styles.cardLabel}>Costo de compra</div><div className={styles.cardValue}>{money(data.totalCost)}</div></div>
      </div>

      {data.crops.length === 0 && <div className={styles.small} style={{ marginBottom: 12 }}>Aún no hay cultivos. Crea el primero abajo.</div>}
      {data.crops.map(c => {
        const boxesOf = (cat) => c.intakes.find(i => i.category === cat)?.boxes || 0
        return (
          <div key={c.id} className={styles.crop}>
            <div className={styles.cropHead}>
              <span>{c.name}</span>
              <span className={styles.meta}>{c.boxes} cajas · {money(c.cost)}</span>
            </div>
            <div className={styles.cropGrid}>
              {Object.keys(LABELS).map(cat => (
                <div key={cat} className={styles.cropCell}>
                  <span className={styles.small}>{LABELS[cat]} · {money(c.prices[cat])}</span>
                  <NumberField label={`${c.name} ${LABELS[cat]}`} value={boxesOf(cat)}
                    onCommit={n => run(() => setIntake(date, c.id, cat, n))} />
                </div>
              ))}
            </div>
            <div style={{ padding: '0 14px 12px' }}>
              <button className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => setPricesOpen(o => ({ ...o, [c.id]: !o[c.id] }))}>
                {pricesOpen[c.id] ? 'Ocultar precios de compra' : 'Precios de compra'}
              </button>
              {pricesOpen[c.id] && (
                <div style={{ marginTop: 8 }}>
                  {Object.keys(LABELS).map(cat => (
                    <div key={cat} className={styles.cropPriceRow}>
                      <span>{LABELS[cat]}</span>
                      <NumberField label={`Precio ${c.name} ${LABELS[cat]}`} value={Number(c.prices[cat])}
                        onCommit={n => run(() => setCropPrice(c.id, cat, n))} />
                    </div>
                  ))}
                  <div className={styles.small}>Un cambio de precio aplica solo a lo que se reciba desde ahora.</div>
                </div>
              )}
            </div>
          </div>
        )
      })}

      <form className={styles.form} onSubmit={e => { e.preventDefault(); run(async () => { await createCrop(name); setName('') }) }}>
        <input className={styles.input} placeholder="Nuevo cultivo" value={name} onChange={e => setName(e.target.value)} required />
        <button className={styles.btn} type="submit">Crear cultivo</button>
      </form>
    </div>
  )
}
