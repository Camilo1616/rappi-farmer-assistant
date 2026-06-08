import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

export default function CalendarCallbackPage() {
  const [params] = useSearchParams()

  useEffect(() => {
    const status = params.get('status') || 'error'
    // Notifica a la ventana opener via localStorage (funciona aunque COOP rompa window.opener)
    localStorage.setItem('calendar_auth_result', status + '_' + Date.now())
    // Intenta también postMessage por si el opener sigue disponible
    try { window.opener?.postMessage({ type: 'calendar_auth', status }, '*') } catch {}
    setTimeout(() => window.close(), 800)
  }, [])

  const status = params.get('status')

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', margin: 0, background: '#f8fafc',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{ textAlign: 'center', padding: 32 }}>
        <p style={{ fontSize: 48, margin: 0 }}>{status === 'connected' ? '✅' : '❌'}</p>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: '16px 0 4px' }}>
          {status === 'connected' ? 'Google Calendar conectado' : 'Error al conectar'}
        </p>
        <p style={{ fontSize: 13, color: '#64748b' }}>Cerrando ventana...</p>
      </div>
    </div>
  )
}
