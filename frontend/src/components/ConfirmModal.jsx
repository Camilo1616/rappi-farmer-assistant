import styles from './ConfirmModal.module.css'

export default function ConfirmModal({ title, message, confirmLabel = 'Confirmar', danger = false, onConfirm, onCancel }) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.icon}>{danger ? '⚠️' : '❓'}</span>
          <span className={styles.title}>{title}</span>
        </div>
        <p className={styles.message}>{message}</p>
        <div className={styles.footer}>
          <button className={styles.btnCancel} onClick={onCancel}>Cancelar</button>
          <button className={`${styles.btnConfirm} ${danger ? styles.btnDanger : ''}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
