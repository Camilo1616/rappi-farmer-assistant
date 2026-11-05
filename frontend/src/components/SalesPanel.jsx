import { useState, useEffect, useCallback } from 'react'
import { getSales, createSale, confirmSale, createOrder, assignCrop, getCrops } from '../services/salesService'
import styles from './SalesPanel.module.css'

const STATUS = { PENDIENTE: 'Pendiente', CONFIRMADA: 'Confirmada', PEDIDO_CREADO: 'Pedido creado' }

/** Ventas: confirmar y crear pedido. Sin fresas en el banco el pedido se bloquea y se ofrece ir a Cultivos. */
export default function SalesPanel({ onGoToCrops }) {
  const [sales, setSales] = useState([])
  const [crops, setCrops] = useState([])
  const [bankKg, setBankKg] = useState(0)
  const [customer, setCustomer] = useState('')
  const [kg, setKg] = useState('')
  const [error, setError] = useState('')
  const [noStock, setNoStock] = useState(null)

  const load = useCallback(async () => {
    const [s, c] = await Promise.all([getSales(), getCrops()])
    setSales(s.sales); setBankKg(Number(s.bankKg)); setCrops(c.crops)
  }, [])

  useEffect(() => { load().catch(() => setError('No se pudieron cargar las ventas')) }, [load])

  const run = async (fn) => {
    setError(''); setNoStock(null)
    try { await fn(); await load() }
    catch (e) {
      const d = e.response?.data
      if (e.response?.status === 409 && d?.code === 'NO_STRAWBERRIES') setNoStock(d)
      else setError(d?.message || 'Error inesperado')
    }
  }

  const add = (e) => {
    e.preventDefault()
    run(async () => { await createSale({ customerName: customer, quantityKg: Number(kg) }); setCustomer(''); setKg('') })
  }

  return (
    <div className={styles.wrap}>
      <div className={`${styles.bank} ${bankKg <= 0 ? styles.bankEmpty : ''}`}>
        🍓 <strong>Banco de fresas:</strong> {bankKg} kg disponibles
      </div>

      {noStock && (
        <div className={styles.alert}>
          <span>⚠️ {noStock.message}. No se creó el pedido.</span>
          <button className={styles.btn} onClick={onGoToCrops}>Ir a Cultivos para crear/asignar</button>
        </div>
      )}
      {error && <div className={styles.error}>{error}</div>}

      <form className={styles.form} onSubmit={add}>
        <input className={styles.input} placeholder="Cliente" value={customer}
          onChange={e => setCustomer(e.target.value)} required />
        <input className={styles.input} type="number" min="0.01" step="0.01" placeholder="Kg"
          value={kg} onChange={e => setKg(e.target.value)} required />
        <button className={styles.btn} type="submit">Nueva venta</button>
      </form>

      {sales.length === 0 ? <div className={styles.empty}>Sin ventas registradas</div> : (
        <table className={styles.table}>
          <thead><tr><th>Cliente</th><th>Kg</th><th>Estado</th><th>Cultivo</th><th>Acciones</th></tr></thead>
          <tbody>
            {sales.map(s => (
              <tr key={s.id}>
                <td>{s.customerName}</td>
                <td>{s.quantityKg}</td>
                <td><span className={styles.badge}>{STATUS[s.status] || s.status}</span></td>
                <td>
                  <select className={styles.input} value={s.cropId || ''} disabled={s.status === 'PEDIDO_CREADO'}
                    onChange={e => e.target.value && run(() => assignCrop(s.id, Number(e.target.value)))}>
                    <option value="">Sin asignar</option>
                    {crops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td className={styles.actions}>
                  {s.status === 'PENDIENTE' && (
                    <button className={styles.btn} onClick={() => run(() => confirmSale(s.id))}>Confirmar</button>)}
                  {s.status === 'CONFIRMADA' && (
                    <button className={styles.btn} onClick={() => run(() => createOrder(s.id))}>Crear pedido</button>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
