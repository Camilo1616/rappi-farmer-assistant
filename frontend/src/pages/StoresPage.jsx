import { useState, useEffect } from 'react'
import { getStores } from '../services/storeService'
import StoreTable from '../components/StoreTable'
import styles from '../layouts/AppLayout.module.css'

/** Vista plana de toda la cartera del farmer — /dashboard/stores */
export default function StoresPage() {
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getStores()
      .then(({ data }) => setStores(data.content ?? data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className={styles.tableSection}>
      <div className={styles.tableSectionHeader}>
        <span className={styles.tableSectionTitle}>Todas las tiendas</span>
        <span className={styles.tableCount}>{stores.length} tiendas</span>
      </div>
      {loading ? (
        <div className={styles.loadingWrapper}><div className={styles.loadingSpinner}/> Cargando...</div>
      ) : (
        <StoreTable stores={stores} />
      )}
    </div>
  )
}
