import { useState, useEffect } from 'react'
import { getProfit } from '../services/despachoService'
import styles from '../pages/DespachoPage.module.css'

const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0)

/** Utilidad = ventas + fletes − costo de cultivos − gastos de viaje (sin arriendo, luz ni personal). */
export default function ProfitCard({ from, to, refreshKey }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    let live = true
    getProfit(from, to).then(d => live && setData(d)).catch(() => live && setData(null))
    return () => { live = false }
  }, [from, to, refreshKey])
  if (!data) return null
  const t = data.totals
  const p = Number(t.profit)
  return (
    <div className={styles.profitBox}>
      <div className={styles.cardLabel}>Utilidad {from === to ? 'del día' : 'del periodo'}</div>
      <div className={`${styles.profitBig} ${p >= 0 ? styles.in : styles.out}`}>{money(p)}</div>
      <div className={styles.plRow}><span>Ventas</span><strong>{money(t.sales)}</strong></div>
      <div className={styles.plRow}><span>+ Fletes cobrados</span><strong>{money(t.freightIncome)}</strong></div>
      <div className={styles.plRow}><span>− Costo de cultivos</span><strong>{money(t.cropCost)}</strong></div>
      <div className={styles.plRow}><span>− Gastos de viaje</span><strong>{money(t.tripExpenses)}</strong></div>
      <div className={styles.small} style={{ marginTop: 6 }}>No incluye arriendo, luz, internet ni personal.</div>
    </div>
  )
}
