import { useState, useMemo } from 'react'
import styles from './StoreTable.module.css'

const SEGMENT_STYLE = {
  'Onboarding':    { bg: 'rgba(59,130,246,0.1)',  color: '#3B82F6' },
  'Aliados':       { bg: 'rgba(249,115,22,0.1)',  color: '#F97316' },
  'Churn':         { bg: 'rgba(239,68,68,0.1)',   color: '#EF4444' },
  'AVA Bajando':   { bg: 'rgba(245,158,11,0.1)',  color: '#F59E0B' },
  'Saludable':     { bg: 'rgba(34,197,94,0.1)',   color: '#22C55E' },
  'Sin clasificar':{ bg: 'rgba(139,147,168,0.1)', color: '#8B93A8' },
}

export default function StoreTable({ stores }) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    if (!q.trim()) return stores
    const term = q.trim().toLowerCase()
    return stores.filter(s =>
      s.storeName?.toLowerCase().includes(term) ||
      s.storeCode?.toLowerCase().includes(term) ||
      s.brandId?.toLowerCase().includes(term) ||
      String(s.id ?? '').includes(term)
    )
  }, [stores, q])

  return (
    <div>
      {/* Buscador */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 14px' }}>
        <span style={{ color: '#94a3b8', fontSize: '15px' }}>🔍</span>
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nombre, Store ID, Brand ID..."
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#0f172a', fontFamily: 'Inter, sans-serif' }}
        />
        {q && (
          <button onClick={() => setQ('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '14px', padding: '0 4px' }}>✕</button>
        )}
        <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{filtered.length} tiendas</span>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🏪</span>
          {q ? 'Sin resultados para "' + q + '"' : 'No hay tiendas para mostrar'}
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tienda</th>
              <th>Brand ID</th>
              <th>Store ID</th>
              <th>Canal dashboard</th>
              <th>Canal</th>
              <th>Último contacto</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const seg = s.dashboardSegment
              const segStyle = SEGMENT_STYLE[seg] ?? SEGMENT_STYLE['Sin clasificar']
              return (
                <tr key={s.id} className={styles.row}>
                  <td>
                    <div className={styles.storeCell}>
                      <div className={styles.storeInitial}>{s.storeName?.charAt(0).toUpperCase() ?? '?'}</div>
                      <span className={styles.storeName}>{s.storeName}</span>
                    </div>
                  </td>
                  <td><span className={styles.mono}>{s.brandId ?? '—'}</span></td>
                  <td><span className={styles.mono}>{s.storeCode ?? '—'}</span></td>
                  <td>
                    {seg
                      ? <span className={styles.tag} style={{ background: segStyle.bg, color: segStyle.color }}>{seg}</span>
                      : <span className={styles.dash}>—</span>}
                  </td>
                  <td>
                    {s.channel
                      ? <span className={styles.channelTag} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(139,147,168,0.1)', color: '#475569', fontWeight: 600 }}>{s.channel}</span>
                      : <span className={styles.dash}>—</span>}
                  </td>
                  <td style={{ fontSize: '12px', color: s.lastContact ? '#475569' : '#cbd5e1' }}>
                    {s.lastContact ?? 'Sin gestiones'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
