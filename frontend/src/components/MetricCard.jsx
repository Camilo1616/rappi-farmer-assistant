import styles from './MetricCard.module.css'

export default function MetricCard({ label, value, color = 'blue', icon, trend }) {
  return (
    <div className={`${styles.card} ${styles[color]}`}>
      <div className={styles.top}>
        <span className={styles.icon}>{icon}</span>
        <span className={styles.trend}>{trend}</span>
      </div>
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
      <div className={styles.bar} />
    </div>
  )
}
