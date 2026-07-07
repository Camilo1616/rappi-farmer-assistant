import { useState } from 'react'
import api from '../services/api'
import { useDashboard } from '../context/DashboardContext'
import styles from '../layouts/AppLayout.module.css'

/** Vista principal de /dashboard — punto de entrada al Consolidado HO. */
export default function DashboardHomePage() {
  const { firstName } = useDashboard()

  const [hoSyncing, setHoSyncing]             = useState(false)
  const [hoResult, setHoResult]               = useState(null)
  const [hoOpen, setHoOpen]                   = useState(false)
  const [hoData, setHoData]                   = useState([])
  const [hoMeetConectado, setHoMeetConectado] = useState(false)

  const openConsolidadoHO = async () => {
    setHoSyncing(true)
    setHoResult(null)
    try {
      const { data } = await api.get('/calendar/handoff-summary')
      setHoData(data.handoffs ?? [])
      setHoMeetConectado(data.meetConectado ?? false)
      setHoOpen(true)
    } catch {
      setHoResult({ ok: false, msg: 'Error al cargar consolidado HO' })
    } finally {
      setHoSyncing(false)
    }
  }

  return (
    <>
      <div className={styles.welcome}>
        <p className={styles.welcomeText}>Hola, <span>{firstName}</span> 👋</p>
        <p className={styles.welcomeSub}>Consolidado de Handoffs — últimos 14 días / próximos 7</p>
      </div>

      <div className={styles.tableToolbar}>
        <div className={styles.toolbarLeft}>
          <button className={styles.btnHoReport} onClick={openConsolidadoHO} disabled={hoSyncing}>
            {hoSyncing ? '⏳ Cargando...' : '🤝 Consolidado HO'}
          </button>
          {hoResult && (
            <span className={hoResult.ok ? styles.hoResultOk : styles.hoResultErr}>
              {hoResult.msg}
            </span>
          )}
        </div>
      </div>

      {hoOpen && (
        <div className={styles.hoOverlay} onClick={() => setHoOpen(false)}>
          <div className={styles.hoModal} onClick={e => e.stopPropagation()}>
            <div className={styles.hoModalHeader}>
              <span>🤝 Consolidado HO — últimos 14 días / próximos 7</span>
              <button className={styles.hoModalClose} onClick={() => setHoOpen(false)}>✕</button>
            </div>
            {!hoMeetConectado ? (
              <div className={styles.hoBlocked}>
                <div className={styles.hoBlockedIcon}>🔒</div>
                <p className={styles.hoBlockedTitle}>Acceso restringido</p>
                <p className={styles.hoBlockedMsg}>
                  Para ver el Consolidado HO con datos reales de duración y participantes,
                  <strong> Jesus David Ruiz</strong> debe iniciar sesión en el sistema
                  y conectar su Google Calendar desde <em>Mi Perfil</em>.
                </p>
                <p className={styles.hoBlockedSub}>
                  Es el organizador de todos los HOs — sus credenciales son necesarias
                  para consultar la API de Google Meet.
                </p>
                <button className={styles.hoBlockedClose} onClick={() => setHoOpen(false)}>
                  Entendido
                </button>
              </div>
            ) : hoData.length === 0 ? (
              <p className={styles.hoEmpty}>No hay handoffs en esta ventana de tiempo.<br/>Asegúrate de tener el Google Calendar sincronizado.</p>
            ) : (
              <>
              <table className={styles.hoTable}>
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>Brand ID</th>
                    <th>Tienda</th>
                    <th>Farmer</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Duración real</th>
                    <th>Aliado conectado</th>
                    <th>Participantes Meet</th>
                    <th>Invitados calendar</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {hoData.map((h, i) => (
                    <tr key={i} className={h.exitoso ? styles.hoRowOk : styles.hoRowFail}>
                      <td>{h.exitoso ? '✅ Exitoso' : '❌ No exitoso'}</td>
                      <td>{h.brandId}</td>
                      <td>{h.storeName}</td>
                      <td>{h.farmerEmail}</td>
                      <td>{h.eventDate}</td>
                      <td>{h.eventTime ?? '—'}</td>
                      <td>
                        {h.duracionRealMin != null
                          ? <span className={h.duracionOk ? styles.hoTagOk : styles.hoTagFail}>
                              {h.duracionRealMin} min
                            </span>
                          : <span className={styles.hoTagGray}>{h.duracionProgramadaMin} min*</span>
                        }
                      </td>
                      <td>
                        {h.alinadoConectado == null ? <span className={styles.hoTagGray}>—</span>
                          : h.alinadoConectado
                            ? <span className={styles.hoTagOk}>✓ Sí</span>
                            : <span className={styles.hoTagFail}>✗ No</span>
                        }
                      </td>
                      <td className={styles.hoEmails}>
                        {h.participantes?.length
                          ? h.participantes.map((p, j) => (
                              <span key={j} className={p.esExterno ? styles.hoEmailExterno : styles.hoEmailInterno}>
                                {p.displayName || 'Anónimo'}
                                {p.tiempoEnReunionMin > 0 && <span className={styles.hoEmailTime}> ({p.tiempoEnReunionMin}m)</span>}
                              </span>
                            ))
                          : '—'}
                      </td>
                      <td className={styles.hoEmails}>
                        {h.attendeeEmails?.length
                          ? h.attendeeEmails.map((e, j) => (
                              <span key={j} className={e.endsWith('@rappi.com') ? styles.hoEmailInterno : styles.hoEmailExterno}>
                                {e}
                              </span>
                            ))
                          : '—'}
                      </td>
                      <td>{h.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={styles.hoNote}>* Duración programada — datos reales de Meet disponibles cuando Jesus David conecte su cuenta</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
