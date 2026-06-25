import MiniSparkline from './MiniSparkline'
import styles from './StoreSection.module.css'

const RESULT_STYLE = {
  EFECTIVA:             { bg:'rgba(34,197,94,0.1)',   color:'#22C55E', label:'Efectiva' },
  NO_CONTACTO:          { bg:'rgba(249,115,22,0.1)',  color:'#F97316', label:'No contacto' },
  NO_RESPONDE:          { bg:'rgba(139,147,168,0.1)', color:'#8B93A8', label:'No responde' },
  PROBLEMA_TECNICO:     { bg:'rgba(239,68,68,0.1)',   color:'#EF4444', label:'Problema técnico' },
  REQUIERE_SEGUIMIENTO: { bg:'rgba(59,130,246,0.1)',  color:'#3B82F6', label:'Seguimiento' },
  BRAND_SYNC:           { bg:'rgba(245,158,11,0.1)',  color:'#F59E0B', label:'Brand sync' },
  WHATSAPP:             { bg:'rgba(34,197,94,0.08)',  color:'#22C55E', label:'WhatsApp' },
}

function fmtPct(val, low, mid, high) {
  if (val == null) return <span style={{ color: '#545E75' }}>—</span>
  const n = parseFloat(val)
  const color = n <= 15 ? low : n < 60 ? mid : high
  return <span style={{ fontWeight: 700, color }}>{n.toFixed(0)}%</span>
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function StoreSection({ title, color, icon, stores, onRefresh, hideHeader = false, isChurn = false, isAva = false, onFollowUp }) {
  if (!stores?.length) return (
    <div className={styles.empty}>Sin tiendas en esta sección</div>
  )

  return (
    <div className={styles.section}>
      {!hideHeader && (
        <div className={styles.sectionHeader}>
          <div className={styles.sectionLeft}>
            <span className={styles.sectionIcon}>{icon}</span>
            <span className={styles.sectionTitle}>{title}</span>
            <span className={styles.sectionCount} style={{ background: color + '22', color }}>{stores.length}</span>
          </div>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tienda</th>
              <th>Brand ID</th>
              <th>Store ID</th>
              <th>Teléfono</th>
              {isChurn
                ? <><th>Días sin conectar</th><th>Último Login</th></>
                : <th>Edad</th>
              }
              <th>Órdenes</th>
              {isAva
                ? <><th>AVA MTD</th><th>AVA L4W</th><th>AVA L7D</th></>
                : <th>Conexión</th>
              }
              <th>Estado</th>
              <th>Última gestión</th>
            </tr>
          </thead>
          <tbody>
            {stores.map(s => {
              const connVal    = s.connectionPercentage != null ? parseFloat(s.connectionPercentage) : null
              const connColor  = connVal == null ? '#545E75' : connVal >= 60 ? '#22C55E' : connVal >= 30 ? '#F97316' : '#EF4444'
              const rs         = s.todayManagementResult ? RESULT_STYLE[s.todayManagementResult] : null
              const statusLabel = s.churnLabel || s.avaLabel || s.agingStage
              const statusColor = s.churnLabel ? '#EF4444' : s.avaLabel ? '#F97316' : '#8B93A8'
              const yaGestionada = !!s.todayManagementResult

              return (
                <tr key={s.id} className={styles.row}>
                  <td>
                    <div className={styles.storeCell}>
                      <span className={styles.storeName}>{s.storeName}</span>
                      <span className={styles.storeCode}>{s.storeCode}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: '#ff441f', fontSize: 12 }}>{s.brandId || '—'}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.storeCode || '—'}</span>
                  </td>
                  <td>
                    {s.phoneNumber
                      ? <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{s.phoneNumber}</span>
                      : <span style={{ fontSize: 11, color: '#ef4444' }}>Sin tel.</span>}
                  </td>

                  {isChurn
                    ? <>
                        <td>
                          {s.diasSinLogin != null
                            ? <span className={styles.agingBadge}
                                style={{ color: s.diasSinLogin > 14 ? '#EF4444' : s.diasSinLogin > 7 ? '#F97316' : color }}>
                                {s.diasSinLogin}d
                              </span>
                            : <span className={styles.dash}>—</span>}
                        </td>
                        <td>
                          <span className={styles.dateValue}>{formatDate(s.lastLoginDate)}</span>
                        </td>
                      </>
                    : <td>
                        <span className={styles.agingBadge} style={{ color }}>{s.aging ?? '—'}d</span>
                      </td>
                  }

                  <td>
                    <span style={{ fontWeight:700, color: s.ordersL4W === 0 ? '#EF4444' : s.ordersL4W > 0 ? '#22C55E' : '#545E75' }}>
                      {s.ordersL4W ?? '—'}
                    </span>
                  </td>

                  {isAva
                    ? <>
                        <td>{fmtPct(s.avaMtd, '#EF4444', '#F97316', '#22C55E')}</td>
                        <td>{fmtPct(s.avaL4w, '#EF4444', '#F97316', '#22C55E')}</td>
                        <td>
                          {fmtPct(s.avaL7d, '#EF4444', '#F97316', '#22C55E')}
                          <MiniSparkline l4w={s.avaL4w} l7d={s.avaL7d} mtd={s.avaMtd} />
                        </td>
                      </>
                    : <td>
                        {connVal != null
                          ? <span style={{ fontWeight:700, color: connColor }}>{connVal.toFixed(0)}%</span>
                          : <span className={styles.dash}>—</span>}
                      </td>
                  }

                  <td>
                    {statusLabel
                      ? <span className={styles.tag} style={{ background: statusColor+'22', color: statusColor }}>{statusLabel}</span>
                      : <span className={styles.dash}>—</span>}
                  </td>

                  <td>
                    {yaGestionada
                      ? <span className={styles.tag}
                          style={{ background: rs?.bg ?? 'rgba(34,197,94,0.1)', color: rs?.color ?? '#22C55E' }}>
                          {rs?.label ?? s.todayManagementResult}
                        </span>
                      : s.lastContact
                        ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.lastContact}</span>
                        : <span className={styles.dash}>Sin gestiones</span>
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
