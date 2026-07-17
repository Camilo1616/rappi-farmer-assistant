import HistorialGestionTab from '../components/HistorialGestionTab'
import styles from './ReportsPage.module.css'

export default function ReportsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Reportes</h1>
          <p className={styles.sub}>Historial de gestión — todo lo gestionado en AGM-IA</p>
        </div>
      </div>

      <HistorialGestionTab />
    </div>
  )
}
