import { useState, useEffect } from 'react'
import {
  getWhatsappStatus, getWhatsappQr, openChrome, logoutSession, sendTest,
} from '../services/whatsappService'
import styles from './WhatsappPage.module.css'

/* ── Conexión WhatsApp ── */
function StepConnection({ status, qr, onRefresh, onStart, onLogout, loading, starting, loggingOut }) {
  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <span className={styles.stepNum}>1</span>
        <div>
          <div className={styles.stepTitle}>Conexión WhatsApp</div>
          <div className={styles.stepSub}>
            {status.connected ? 'Sesión activa' : qr ? 'Escanea el QR con WhatsApp' : status.initializing ? 'Iniciando servicio...' : 'Servicio no iniciado'}
          </div>
        </div>
        <div className={`${styles.statusDot} ${status.connected ? styles.dotGreen : qr ? styles.dotYellow : styles.dotRed}`} />
      </div>

      <div className={styles.statusRow}>
        <div className={styles.statusItem}>{status.connected ? '✅' : '⏳'} WA {status.connected ? 'conectado' : 'desconectado'}</div>
      </div>

      {!status.connected && qr && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 0' }}>
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
          <img src={qr} alt="QR WhatsApp" style={{ width: 220, height: 220, borderRadius: 12, border: '2px solid #e2e8f0' }} />
          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>El QR expira en 60 segundos · Verificando cada 2s...</p>
        </div>
      )}

      {!status.connected && !qr && status.initializing && (
        <div style={{ padding: '12px 0', fontSize: 13, color: '#94a3b8', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span className={styles.spinner} /> Iniciando Chromium, espera unos segundos...
        </div>
      )}

      {!status.connected && !qr && !status.initializing && (
        <div style={{ padding: '12px 0', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
          Inicia el servicio para obtener el código QR
        </div>
      )}

      <div className={styles.btnRow}>
        {!status.connected && !qr && !status.initializing && (
          <button className={styles.btnPrimary} onClick={onStart} disabled={starting}>
            {starting ? <><span className={styles.spinner} /> Iniciando...</> : '▶ Iniciar servicio WhatsApp'}
          </button>
        )}
        <button className={styles.btnSecondary} onClick={onRefresh} disabled={loading}>
          {loading ? <><span className={styles.spinner} /> Verificando...</> : '🔄 Verificar estado'}
        </button>
        {(status.connected || (!qr && (status.initializing || status.open))) && (
          <button
            onClick={onLogout}
            disabled={loggingOut}
            title="Cierra la sesión y borra los datos. Necesitarás escanear el QR de nuevo."
            style={{
              padding: '8px 14px', borderRadius: 8, border: '1.5px solid #DC2626',
              background: 'transparent', color: '#DC2626', fontSize: '0.82rem',
              fontWeight: 600, cursor: loggingOut ? 'not-allowed' : 'pointer', opacity: loggingOut ? 0.6 : 1,
            }}
          >
            {loggingOut ? <><span className={styles.spinner} /> Desvinculando...</> : '🔌 Desvincular sesión'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Página ── */
export default function WhatsappPage() {
  const [status,      setStatus]      = useState({ open: false, connected: false })
  const [qr,          setQr]          = useState(null)
  const [chromLoad,   setChromLoad]   = useState(false)
  const [starting,    setStarting]    = useState(false)
  const [loggingOut,  setLoggingOut]  = useState(false)
  const [testPhone,   setTestPhone]   = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testResult,  setTestResult]  = useState(null)

  const loadStatus = async () => {
    try {
      const r = await getWhatsappStatus()
      setStatus(r.data)
      if (!r.data.connected) {
        const qrRes = await getWhatsappQr().catch(() => null)
        setQr(qrRes?.data?.qr || null)
      } else {
        setQr(null)
      }
    } catch {}
  }

  useEffect(() => {
    loadStatus()
    const iv = setInterval(loadStatus, 5000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (!qr) return
    const iv = setInterval(loadStatus, 2000)
    return () => clearInterval(iv)
  }, [!!qr])

  const handleRefresh = async () => {
    setChromLoad(true)
    await loadStatus()
    setChromLoad(false)
  }

  const handleStart = async () => {
    setStarting(true)
    try {
      const check = await getWhatsappStatus().catch(() => null)
      if (check?.data?.connected || check?.data?.hasQr) {
        await loadStatus()
        setStarting(false)
        return
      }
      await openChrome()
      const deadline = Date.now() + 45_000
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 2500))
        const r = await getWhatsappStatus().catch(() => null)
        if (!r) continue
        setStatus(r.data)
        if (r.data.connected || r.data.hasQr) break
      }
      await loadStatus()
    } catch {}
    setStarting(false)
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logoutSession()
      setQr(null)
      await new Promise(r => setTimeout(r, 6000))
      await loadStatus()
    } catch {}
    setLoggingOut(false)
  }

  const handleTest = async () => {
    if (!testPhone.trim() || !testMessage.trim()) return
    setTestSending(true); setTestResult(null)
    try {
      const r = await sendTest(testPhone.trim(), testMessage)
      setTestResult({ ok: r.data.result === 'ENVIADO', msg: r.data.result })
    } catch { setTestResult({ ok: false, msg: 'Error de conexión' }) }
    finally { setTestSending(false) }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>WhatsApp</h1>
        <p className={styles.sub}>Conexión y mensajes de prueba</p>
      </div>

      <div style={{
        background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)',
        borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#F59E0B',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        🔒 Envío masivo bloqueado — pendiente de conectar con la nueva fuente de contactos.
      </div>

      <div className={styles.layout}>
        <div className={styles.leftCol}>
          <StepConnection
            status={status} qr={qr}
            onRefresh={handleRefresh} onStart={handleStart} onLogout={handleLogout}
            loading={chromLoad} starting={starting} loggingOut={loggingOut}
          />

          <div className={styles.stepCard}>
            <div className={styles.stepHeader}>
              <span className={styles.stepNum}>2</span>
              <div>
                <div className={styles.stepTitle}>Mensaje de prueba</div>
                <div className={styles.stepSub}>Verifica que la conexión funciona enviando un mensaje directo</div>
              </div>
            </div>
            <div className={styles.testRow}>
              <input className={styles.testInput} placeholder="Ej: 573001234567"
                value={testPhone} onChange={e => setTestPhone(e.target.value)} />
            </div>
            <textarea className={styles.textarea} rows={4} placeholder="Escribe el mensaje de prueba..."
              value={testMessage} onChange={e => setTestMessage(e.target.value)}
              style={{ marginTop: 10 }} />
            <div className={styles.testRow} style={{ marginTop: 10 }}>
              <button className={styles.btnSecondary} onClick={handleTest}
                disabled={testSending || !testPhone || !testMessage}>
                {testSending ? 'Enviando...' : '📤 Enviar prueba'}
              </button>
            </div>
            {testResult && (
              <div className={`${styles.testResult} ${testResult.ok ? styles.testOk : styles.testError}`}>
                {testResult.ok ? '✅' : '❌'} {testResult.msg}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
