import { useState, useEffect } from 'react'
import { getHistorial } from '../services/agmService'
import TimelineList, { statusColor } from './TimelineList'
import styles from '../pages/GestionAgmPage.module.css'

/* ── "Historial de gestión" — agrupado por día, con contadores por status ── */
export default function HistorialGestionTab() {
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [entries, setEntries] = useState([])
  const [openDay, setOpenDay] = useState(null)

  const load = (d) => {
    setLoading(true); setError(null)
    getHistorial({ days: d })
      .then(r => setEntries(r.data))
      .catch(e => setError(e.response?.data?.message || 'Error al leer el historial'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(days) }, [days])

  // Agrupar por día (YYYY-MM-DD extraído de "yyyy-MM-dd HH:mm:ss")
  const porDia = {}
  for (const e of entries) {
    const dia = (e.fechaHora || '').slice(0, 10) || 'Sin fecha'
    porDia[dia] = porDia[dia] || []
    porDia[dia].push(e)
  }
  const dias = Object.keys(porDia).sort().reverse()

  return (
    <div className={styles.card}>
      <div className={styles.sectionTitle}>📅 Historial de gestión</div>
      <p className={styles.emptyText}>Qué tareas se gestionaron y cuándo — incluye ayer y días anteriores.</p>

      <div style={{ display: 'flex', gap: 8, margin: '10px 0 16px' }}>
        {[7, 15, 30].map(d => (
          <button key={d}
            className={styles.btnGhost}
            style={days === d ? { borderColor: 'var(--rappi-orange)', color: 'var(--rappi-orange)' } : {}}
            onClick={() => setDays(d)}>
            Últimos {d} días
          </button>
        ))}
      </div>

      {loading && <p className={styles.emptyText}>Cargando...</p>}
      {error && <div className={styles.readOnlyNote}>⚠ {error}</div>}

      {!loading && !error && dias.length === 0 && (
        <p className={styles.emptyText}>No hay gestiones registradas en este periodo.</p>
      )}

      {!loading && !error && dias.map(dia => {
        const items = porDia[dia]
        const conteo = {}
        items.forEach(e => { conteo[e.status || 'Sin status'] = (conteo[e.status || 'Sin status'] || 0) + 1 })
        const abierto = openDay === dia
        return (
          <div key={dia} className={styles.dayGroup}>
            <button className={styles.dayHeader} onClick={() => setOpenDay(abierto ? null : dia)}>
              <span>{dia}</span>
              <span className={styles.dayCount}>{items.length} cambios</span>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(conteo).map(([status, n]) => (
                  <span key={status} className={styles.dayBadge} style={{ color: statusColor(status), borderColor: statusColor(status) + '55' }}>
                    {status} × {n}
                  </span>
                ))}
              </span>
              <span style={{ marginLeft: 'auto' }}>{abierto ? '▲' : '▼'}</span>
            </button>
            {abierto && <TimelineList entries={items} showStore />}
          </div>
        )
      })}
    </div>
  )
}
