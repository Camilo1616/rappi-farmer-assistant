import { useState, useEffect } from 'react'
import { getLiderDashboard } from '../services/dashboardService'
import { useAuth } from '../context/AuthContext'

function semaforo(f) {
  if (f.gestionesHoy === 0) return { color: '#dc2626', bg: '#fee2e2', icon: '🔴', label: 'Sin iniciar' }
  if (f.exitosasHoy >= 8)   return { color: '#16a34a', bg: '#dcfce7', icon: '🟢', label: 'En meta' }
  return                           { color: '#d97706', bg: '#fef9c3', icon: '🟡', label: 'En progreso' }
}

function MetricCard({ label, value, sub, color = '#0f172a' }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <p style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ fontSize: '32px', fontWeight: 800, color, letterSpacing: '-1px', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: '12px', color: '#64748b' }}>{sub}</p>}
    </div>
  )
}

export default function LiderDashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('semaforo')

  useEffect(() => { load() }, [])

  const load = async () => {
    try { const { data: d } = await getLiderDashboard(); setData(d) }
    catch {} finally { setLoading(false) }
  }

  const now = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  const greeting = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 18 ? 'Buenas tardes' : 'Buenas noches'

  if (loading) return (
    <div style={{ padding: '28px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '3px solid #ff441f', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  const farmers = [...(data?.farmers || [])].sort((a, b) => {
    if (sort === 'semaforo') {
      const order = { '🔴': 0, '🟡': 1, '🟢': 2 }
      return (order[semaforo(a).icon] ?? 3) - (order[semaforo(b).icon] ?? 3)
    }
    if (sort === 'gestiones') return b.gestionesHoy - a.gestionesHoy
    if (sort === 'efectivas')  return b.exitosasHoy - a.exitosasHoy
    if (sort === 'tiendas')    return b.totalStores - a.totalStores
    return 0
  })

  const totalBases = (data?.basesPendientes ?? 0) + (data?.basesEnProceso ?? 0) + (data?.basesCompletadas ?? 0)

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
          {greeting}, {user?.nickname || user?.fullName?.split(' ')[0]} 👋
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px', textTransform: 'capitalize' }}>{now}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <MetricCard label="Farmers" value={data?.farmers?.length ?? 0} sub="en el equipo" />
        <MetricCard label="Tiendas" value={data?.totalStores ?? 0} sub="cartera total" />
        <MetricCard label="Gestiones hoy" value={data?.totalGestiones ?? 0} color="#1d4ed8" sub={`meta: ${(data?.farmers?.length ?? 0) * 40}`} />
        <MetricCard label="Efectivas hoy" value={data?.totalEfectivas ?? 0} color="#16a34a" sub={`meta: ${(data?.farmers?.length ?? 0) * 15}`} />
        <MetricCard label="No contacto" value={data?.totalNoContacto ?? 0} color="#d97706" sub={`meta: ${(data?.farmers?.length ?? 0) * 25}`} />
        <MetricCard label="Onboarding" value={data?.totalOnboarding ?? 0} sub="días 1-8" color="#7c3aed" />
        <MetricCard label="Churn" value={data?.totalChurn ?? 0} color="#dc2626" />
        <MetricCard label="Saludables" value={data?.totalSaludables ?? 0} color="#16a34a" />
      </div>

      {totalBases > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>Estado de bases</p>
          <div style={{ display: 'flex', gap: '24px' }}>
            {[
              { label: 'Sin leer / Pendientes', value: data.basesPendientes, color: '#64748b', bg: '#f1f5f9' },
              { label: 'En proceso',             value: data.basesEnProceso,  color: '#854d0e', bg: '#fef9c3' },
              { label: 'Completadas',            value: data.basesCompletadas, color: '#166534', bg: '#dcfce7' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ padding: '4px 12px', borderRadius: '99px', background: bg, color, fontWeight: 700, fontSize: '15px' }}>{value}</span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Equipo hoy</p>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[['semaforo','Semáforo'],['gestiones','Gestiones'],['efectivas','Efectivas'],['tiendas','Tiendas']].map(([key, label]) => (
              <button key={key} onClick={() => setSort(key)} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, border: sort === key ? 'none' : '1px solid #e2e8f0', background: sort === key ? '#0f172a' : '#f8fafc', color: sort === key ? '#fff' : '#475569', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
              {['','Farmer','Código','País','Tiendas','Onb.','Churn','Gestiones','Efectivas','No contacto'].map((h, i) => (
                <th key={i} style={{ padding: '10px 14px', textAlign: i <= 1 ? 'left' : 'center', fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {farmers.map(f => {
              const s = semaforo(f)
              const pct = f.gestionesHoy > 0 ? Math.round((f.exitosasHoy / f.gestionesHoy) * 100) : 0
              return (
                <tr key={f.id} style={{ borderBottom: '1px solid #f8fafc' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span title={s.label} style={{ fontSize: '16px' }}>{s.icon}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <p style={{ fontWeight: 600, color: '#0f172a' }}>{f.fullName}</p>
                    <p style={{ fontSize: '11px', color: '#94a3b8' }}>{f.email}</p>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#ff441f' }}>{f.farmerCode || `#${f.id}`}</span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748b' }}>{f.countryCode || '—'}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>{f.totalStores}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    {f.onboardingCount > 0 ? <span style={{ padding: '2px 8px', borderRadius: '99px', background: '#dbeafe', color: '#1d4ed8', fontSize: '11px', fontWeight: 700 }}>{f.onboardingCount}</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    {f.churnCount > 0 ? <span style={{ padding: '2px 8px', borderRadius: '99px', background: '#fee2e2', color: '#dc2626', fontSize: '11px', fontWeight: 700 }}>{f.churnCount}</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: f.gestionesHoy > 0 ? '#1d4ed8' : '#94a3b8' }}>{f.gestionesHoy}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <span style={{ fontWeight: 700, color: f.exitosasHoy >= 8 ? '#16a34a' : f.exitosasHoy > 0 ? '#d97706' : '#94a3b8' }}>{f.exitosasHoy}</span>
                      {f.gestionesHoy > 0 && <span style={{ fontSize: '10px', color: '#94a3b8' }}>{pct}%</span>}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', color: f.noContactoHoy > 0 ? '#d97706' : '#94a3b8', fontWeight: f.noContactoHoy > 0 ? 700 : 400 }}>{f.noContactoHoy || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {farmers.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
            No hay farmers asignados a tu equipo
          </div>
        )}
      </div>
    </div>
  )
}
