import { useState, useEffect } from 'react'
import { getReport } from '../services/despachoService'
import styles from '../pages/DespachoPage.module.css'

const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0)
const iso = (d) => d.toLocaleDateString('en-CA')
const parse = (s) => new Date(s + 'T12:00:00')

/** Rango de la semana (lunes a domingo) o del mes que contiene la fecha ancla. */
function rangeOf(mode, anchor) {
  const d = parse(anchor)
  if (mode === 'mes') {
    return [iso(new Date(d.getFullYear(), d.getMonth(), 1, 12)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12))]
  }
  const monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  return [iso(monday), iso(sunday)]
}

function shift(mode, anchor, dir) {
  const d = parse(anchor)
  if (mode === 'mes') d.setMonth(d.getMonth() + dir, 1)
  else d.setDate(d.getDate() + 7 * dir)
  return iso(d)
}

const label = (s) => parse(s).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

/** Reporte de cosechado contra vendido por semana o mes. */
export default function ReportPanel({ date, onError }) {
  const [mode, setMode] = useState('semana')
  const [anchor, setAnchor] = useState(date)
  const [report, setReport] = useState(null)
  const [from, to] = rangeOf(mode, anchor)

  useEffect(() => {
    let live = true
    getReport(from, to).then(r => live && setReport(r)).catch(() => live && onError('No se pudo cargar el reporte'))
    return () => { live = false }
  }, [from, to, onError])

  const t = report?.totals
  const maxDay = report ? Math.max(1, ...report.days.map(d => Math.max(d.harvested, d.delivered))) : 1

  return (
    <div>
      <div className={styles.seg}>
        {['semana', 'mes'].map(m => (
          <button key={m} className={`${styles.segBtn} ${mode === m ? styles.segOn : ''}`}
            onClick={() => setMode(m)}>{m === 'semana' ? 'Semana' : 'Mes'}</button>
        ))}
      </div>
      <div className={styles.rangeNav}>
        <button className={styles.nav} onClick={() => setAnchor(shift(mode, anchor, -1))} aria-label="Periodo anterior">‹</button>
        <div className={styles.rangeLabel}>{label(from)} – {label(to)}</div>
        <button className={styles.nav} onClick={() => setAnchor(shift(mode, anchor, 1))} aria-label="Periodo siguiente">›</button>
      </div>

      {!report || report.from !== from ? <div className={styles.small}>Cargando…</div> : (
        <>
          <div className={styles.cards}>
            <div className={styles.card}><div className={styles.cardLabel}>Cosechado</div><div className={styles.cardValue}>{t.harvested}</div>
              <div className={styles.small}>+ {t.openingStock} de arrastre</div></div>
            <div className={styles.card}><div className={styles.cardLabel}>Vendido (cajas)</div><div className={styles.cardValue}>{t.delivered}</div>
              <div className={styles.small}>{t.sellThroughPct}% de lo disponible · pedido {t.ordered}</div></div>
            <div className={styles.card}><div className={styles.cardLabel}>Descartado</div><div className={styles.cardValue}>{t.discarded}</div></div>
            <div className={styles.card}><div className={styles.cardLabel}>Queda en stock</div><div className={styles.cardValue}>{t.endingStock}</div></div>
          </div>
          <div className={styles.card} style={{ marginBottom: 16 }}>
            <div className={styles.cardLabel}>Ventas del periodo</div><div className={styles.cardValue}>{money(t.sales)}</div>
          </div>

          <h2 className={styles.sectionTitle}>Por categoría</h2>
          <div className={styles.closeBox} style={{ marginBottom: 16 }}>
            <table className={styles.table}>
              <thead><tr><th>Categoría</th><th>Cosecha</th><th>Vendió</th><th>Desc.</th><th>Queda</th></tr></thead>
              <tbody>
                {report.categories.map(c => (
                  <tr key={c.category}><td>{c.label}</td><td>{c.harvested}</td><td>{c.delivered}</td>
                    <td>{c.discarded}</td><td><strong>{c.endingStock}</strong></td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className={styles.sectionTitle}>Por día</h2>
          <div className={styles.closeBox}>
            <div className={styles.small} style={{ marginBottom: 6 }}>Verde: cosechado · Naranja: vendido</div>
            {report.days.length === 0 && <div className={styles.small}>Sin movimientos en este periodo.</div>}
            {report.days.map(d => (
              <div key={d.date} className={styles.barRow}>
                <span>{label(d.date)}</span>
                <div className={styles.barTrack}>
                  <div className={styles.barHarv} style={{ width: `${d.harvested * 100 / maxDay}%` }} />
                  <div className={styles.barSold} style={{ width: `${d.delivered * 100 / maxDay}%` }} />
                </div>
                <span style={{ textAlign: 'right' }}>{d.harvested}/{d.delivered}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
