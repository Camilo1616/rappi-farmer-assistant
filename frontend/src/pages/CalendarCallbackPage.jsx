import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

export default function CalendarCallbackPage() {
  const [params] = useSearchParams()

  useEffect(() => {
    const status = params.get('status') || 'error'
    localStorage.setItem('calendar_auth_result', status + '_' + Date.now())
    try { window.opener?.postMessage({ type: 'calendar_auth', status }, '*') } catch {}
    // Solo cerrar automáticamente si fue exitoso; si hay error, dejar abierto para leer el mensaje
    if (status === 'connected') setTimeout(() => window.close(), 1500)
  }, [])

  const status = params.get('status')
  const msg = params.get('msg')

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', margin: 0, background: '#f8fafc',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{ textAlign: 'center', padding: 32, maxWidth: 480 }}>
        <p style={{ fontSize: 48, margin: 0 }}>{status === 'connected' ? '✅' : '❌'}</p>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: '16px 0 4px' }}>
          {status === 'connected' ? 'Google Calendar conectado' : 'Error al conectar'}
        </p>
        {msg && (
          <p style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', padding: '8px 12px',
            borderRadius: 8, marginTop: 8, wordBreak: 'break-all', textAlign: 'left' }}>
            {msg}
          </p>
        )}
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 12 }}>Cerrando ventana...</p>
      </div>
    </div>
  )
}
