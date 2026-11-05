import { useState, useEffect, useCallback } from 'react'
import { getCrops, createCrop, deleteCrop, harvestCrop } from '../services/salesService'
import styles from './SalesPanel.module.css'

/** Cultivos: crear, registrar cosecha (alimenta el banco) y eliminar. */
export default function CropsPanel() {
  const [crops, setCrops] = useState([])
  const [bankKg, setBankKg] = useState(0)
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [kgById, setKgById] = useState({})
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const c = await getCrops()
    setCrops(c.crops); setBankKg(Number(c.bankKg))
  }, [])

  useEffect(() => { load().catch(() => setError('No se pudieron cargar los cultivos')) }, [load])

  const run = async (fn) => {
    setError('')
    try { await fn(); await load() } catch (e) { setError(e.response?.data?.message || 'Error inesperado') }
  }

  return (
    <div className={styles.wrap}>
      <div className={`${styles.bank} ${bankKg <= 0 ? styles.bankEmpty : ''}`}>
        🍓 <strong>Banco de fresas:</strong> {bankKg} kg disponibles
      </div>
      {error && <div className={styles.error}>{error}</div>}

      <form className={styles.form} onSubmit={e => {
        e.preventDefault()
        run(async () => { await createCrop({ name, location }); setName(''); setLocation('') })
      }}>
        <input className={styles.input} placeholder="Nombre del cultivo" value={name}
          onChange={e => setName(e.target.value)} required />
        <input className={styles.input} placeholder="Ubicación (opcional)" value={location}
          onChange={e => setLocation(e.target.value)} />
        <button className={styles.btn} type="submit">Crear cultivo</button>
      </form>

      {crops.length === 0 ? <div className={styles.empty}>Aún no hay cultivos. Crea uno para empezar a cosechar.</div> : (
        <table className={styles.table}>
          <thead><tr><th>Cultivo</th><th>Ubicación</th><th>Cosechado (kg)</th><th>Registrar cosecha</th><th /></tr></thead>
          <tbody>
            {crops.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.location || '—'}</td>
                <td>{c.harvestedKg}</td>
                <td className={styles.actions}>
                  <input className={styles.input} type="number" min="0.01" step="0.01" placeholder="Kg" style={{ width: 90 }}
                    value={kgById[c.id] || ''} onChange={e => setKgById({ ...kgById, [c.id]: e.target.value })} />
                  <button className={styles.btn} disabled={!Number(kgById[c.id])}
                    onClick={() => run(async () => { await harvestCrop(c.id, Number(kgById[c.id])); setKgById({ ...kgById, [c.id]: '' }) })}>
                    Cosechar al banco</button>
                </td>
                <td><button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => run(() => deleteCrop(c.id))}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
