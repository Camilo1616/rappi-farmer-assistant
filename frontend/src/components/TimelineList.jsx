import styles from '../pages/GestionAgmPage.module.css'

const STATUS_COLOR = {
  'confirmado': '#22C55E', 'on track': '#3B82F6', 'baja': '#EF4444',
  'escalado': '#F97316', 'pendiente': '#6B7280', 'esperando respuesta': '#F59E0B',
  'sin información': '#A855F7', 'asignada a otra área': '#94A3B8', 'imposible contacto': '#EF4444',
}

export function statusColor(status) {
  return STATUS_COLOR[(status || '').trim().toLowerCase()] || '#6B7280'
}

/* ── Timeline de cambios (usado en el modal por tienda, en "Conversación" y en Reportes > Historial) ── */
export default function TimelineList({ entries, showStore }) {
  if (!entries || entries.length === 0) {
    return <p className={styles.emptyText}>Sin cambios registrados todavía.</p>
  }
  return (
    <div className={styles.timeline}>
      {entries.map((h, i) => (
        <div key={i} className={styles.timelineRow}>
          <span className={styles.timelineDot} style={{ background: statusColor(h.status) }} />
          <div className={styles.timelineBody}>
            <div className={styles.timelineHeader}>
              <span className={styles.timelineStatus} style={{ color: statusColor(h.status) }}>{h.status || '—'}</span>
              {showStore && <span className={styles.timelineStore}>{h.storeId}</span>}
              <span className={styles.timelineDate}>{h.fechaHora}</span>
            </div>
            {h.agente && <div className={styles.timelineMeta}>Agente: {h.agente}</div>}
            {h.comentarioInterno && <div className={styles.timelineComment}><b>Interno:</b> {h.comentarioInterno}</div>}
            {h.comentarioAliado && <div className={styles.timelineComment}><b>Aliado:</b> {h.comentarioAliado}</div>}
            {h.ticket && <div className={styles.timelineMeta}>Ticket: {h.ticket} ({h.statusTicket || 'sin status'})</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
