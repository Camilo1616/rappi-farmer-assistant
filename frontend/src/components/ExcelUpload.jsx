import { useState, useRef } from 'react'
import { uploadExcel, downloadTemplate } from '../services/importService'
import styles from './ExcelUpload.module.css'

const COLUMNS = [
  { name: 'FARMER',                          example: 'cristian@rappi.com',      desc: 'Email del farmer asignado' },
  { name: 'CANAL',                           example: 'Hunting',                 desc: 'Hunting / Inside Sales / Self' },
  { name: 'HUNTER',                          example: 'Carlos Ruiz',             desc: 'Nombre del hunter responsable' },
  { name: 'COUNTRY STORE ID',                example: 'CO_12345',                desc: 'ID único de la tienda en Rappi' },
  { name: 'STORE NAME',                      example: 'Restaurante Ejemplo',     desc: 'Nombre comercial de la tienda' },
  { name: 'COUNTRY BRAND ID',                example: 'CO_B001',                 desc: 'ID de marca — agrupa tiendas hermanas' },
  { name: 'BRAND CATEGORY',                  example: 'Comida rápida',           desc: 'Categoría de la marca' },
  { name: 'AGING',                           example: '8',                       desc: 'Días desde onboarding' },
  { name: 'EMAIL_STORE',                     example: 'tienda@gmail.com',        desc: 'Email de contacto de la tienda' },
  { name: 'TELEFONO_PRINCIPAL',              example: '3001234567',              desc: 'Teléfono sin espacios ni guiones' },
  { name: 'OTROS_TELEFONOS',                 example: '3109876543',              desc: 'Teléfonos adicionales' },
  { name: 'STORE CITY',                      example: 'Bogotá',                  desc: 'Ciudad donde opera la tienda' },
  { name: 'OPS_ZONE',                        example: 'Zona Norte',              desc: 'Zona operativa asignada' },
  { name: 'IS_SEAMLESS',                     example: 'SI',                      desc: 'SI / NO — integración seamless' },
  { name: 'GESTIONAR',                       example: 'SI',                      desc: 'SI si debe gestionarse hoy' },
  { name: 'TUVO_HANDOFF',                    example: 'SI',                      desc: 'Si tuvo handoff: SI / NO' },
  { name: 'PUNTOS_FINALES',                  example: '150',                     desc: 'Puntos finales del periodo' },
  { name: 'MOTIVO',                          example: 'Bajo AVA',                desc: 'Motivo de gestión o alerta' },
  { name: 'TIPO_EXCEPCION',                  example: 'Técnica',                 desc: 'Tipo de excepción registrada' },
  { name: 'TIPO_GESTION',                    example: 'LLAMADA',                 desc: 'Tipo de gestión realizada' },
  { name: 'RESULTADO_GESTION',               example: 'EFECTIVA',                desc: 'Resultado de la última gestión' },
  { name: 'Ordenes LW',                      example: '35',                      desc: 'Pedidos semana pasada' },
  { name: 'Ordenes L2W',                     example: '38',                      desc: 'Pedidos hace 2 semanas' },
  { name: 'Ordenes L4W Hoy',                 example: '42',                      desc: 'Pedidos últimas 4 semanas (hoy)' },
  { name: 'Ordenes L4W Ayer',                example: '40',                      desc: 'Pedidos últimas 4 semanas (ayer)' },
  { name: 'Fecha Activación L4W',            example: '2024-01-10',              desc: 'Fecha de activación L4W' },
  { name: 'Ordenes MTD',                     example: '120',                     desc: 'Pedidos del mes actual' },
  { name: 'Fecha Primera Orden',             example: '2024-01-02',              desc: 'Fecha del primer pedido' },
  { name: 'Última Orden',                    example: '2024-01-20',              desc: 'Fecha del pedido más reciente' },
  { name: 'GMV L4W (USD)',                   example: '1250.50',                 desc: 'GMV últimas 4 semanas en USD' },
  { name: 'Fecha de cargue',                 example: '2024-01-21',              desc: 'Fecha en que se carga este Excel' },
  { name: 'Fecha credenciales',              example: '2024-01-01',              desc: 'Fecha de entrega de credenciales' },
  { name: 'Fecha inicio store',              example: '2024-01-15',              desc: 'Fecha de inicio (YYYY-MM-DD)' },
  { name: 'AVA_MTD',                         example: '0.75',                    desc: 'AVA del mes actual' },
  { name: 'AVA_L4W',                         example: '0.72',                    desc: 'AVA últimas 4 semanas (ej: 0.72 = 72%)' },
  { name: 'AVA_L7D',                         example: '0.68',                    desc: 'AVA últimos 7 días' },
  { name: 'AVA STATUS',                      example: 'ACTIVE',                  desc: 'ACTIVE o INACTIVE' },
  { name: 'Último Login',                    example: '2024-01-20',              desc: 'Último acceso del aliado a la plataforma' },
  { name: 'Estado Churn AVA',                example: 'Activo',                  desc: 'Estado de churn / riesgo' },
  { name: 'TRAFICO',                         example: '850',                     desc: 'Tráfico generado en el periodo' },
  { name: 'Menú PDF',                        example: 'SI',                      desc: 'SI si tiene menú en PDF' },
  { name: 'Link Menú',                       example: 'https://...',             desc: 'URL del menú digital' },
  { name: 'DeepLink',                        example: 'rappi://store/12345',     desc: 'Deep link de la tienda en Rappi' },
  { name: 'Catalog Quality',                 example: '85',                      desc: 'Puntuación de calidad del catálogo' },
  { name: 'Catalog Products',                example: '40',                      desc: 'Total de productos en catálogo' },
  { name: 'Catalog Productos sin Imagen',    example: '5',                       desc: 'Productos sin imagen en catálogo' },
  { name: 'Horarios config.',                example: 'SI',                      desc: 'SI si los horarios están configurados' },
  { name: 'Logo & Portada',                  example: 'SI',                      desc: 'SI si tiene logo y portada' },
  { name: 'Catalog Estado',                  example: 'Completo',                desc: 'Estado general del catálogo' },
  { name: 'Último FollowUP',                 example: '2024-01-18',              desc: 'Fecha del último follow-up' },
  { name: 'FollowUp last 30D',               example: '4',                       desc: 'Follow-ups en los últimos 30 días' },
  { name: 'Último Follow exitoso',           example: '2024-01-15',              desc: 'Fecha del último follow-up exitoso' },
  { name: 'Intentos Follow Totales',         example: '12',                      desc: 'Total de intentos de follow-up' },
  { name: 'Success Follow Totales',          example: '8',                       desc: 'Total de follow-ups exitosos' },
  { name: 'Dias Ultimo Follow',              example: '3',                       desc: 'Días desde el último follow-up' },
  { name: 'MD PRO % WTD',                   example: '0.45',                    desc: 'MD Pro % semana hasta hoy' },
  { name: 'MD % WTD',                       example: '0.38',                    desc: 'MD % semana hasta hoy' },
  { name: 'Revenue MTD',                     example: '3500.00',                 desc: 'Revenue del mes actual' },
  { name: 'Bookings MTD',                    example: '95',                      desc: 'Reservas del mes actual' },
  { name: 'Palanca Activa',                  example: 'SI',                      desc: 'SI si tiene palanca activa' },
  { name: 'Descuento Activo',                example: '10%',                     desc: 'Descuento activo en la tienda' },
  { name: 'Monto Free ADS USD',              example: '50.00',                   desc: 'Monto de ADS gratuitos asignados' },
  { name: 'Burn Free ADS USD',               example: '30.00',                   desc: 'ADS gratuitos consumidos' },
  { name: 'Top_Performance',                 example: 'SI',                      desc: 'SI si es tienda top performance' },
  { name: 'Comisión FS',                     example: '0.18',                    desc: 'Comisión de full service' },
  { name: 'Comisión MD',                     example: '0.12',                    desc: 'Comisión de marketplace' },
]

export default function ExcelUpload({ onImported, onDashboard }) {
  const [dragging,    setDragging]    = useState(false)
  const [file,        setFile]        = useState(null)
  const [progress,    setProgress]    = useState(0)
  const [status,      setStatus]      = useState('idle')
  const [result,      setResult]      = useState(null)
  const [error,       setError]       = useState('')
  const [errorDetails, setErrorDetails] = useState(null)
  const [downloading,  setDownloading]  = useState(false)
  const [colsOpen,     setColsOpen]     = useState(false)
  const inputRef = useRef()

  const handleFile = (f) => {
    if (!f) return
    if (!f.name.match(/\.(xlsx|xls)$/i)) { setError('Solo se aceptan archivos .xlsx o .xls'); return }
    setFile(f); setError(''); setStatus('idle'); setResult(null)
  }

  const handleUpload = async () => {
    if (!file) return
    setStatus('uploading'); setProgress(0); setError('')
    try {
      const { data } = await uploadExcel(file, setProgress)
      setResult(data); setStatus('success')
      if (onImported) onImported()
    } catch (err) {
      const data = err.response?.data
      if (typeof data === 'string') {
        setError(data || 'Error al procesar el archivo')
        setErrorDetails(null)
      } else {
        setError(data?.message || data?.error || `Error ${err.response?.status ?? ''} al procesar el archivo`.trim())
        const details = data?.details || data?.errors
        setErrorDetails(Array.isArray(details) && details.length > 0 ? details : null)
      }
      setStatus('error')
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await downloadTemplate()
      const url = URL.createObjectURL(new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'plantilla_cartera_rappi.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setError('No se pudo descargar la plantilla. Intenta de nuevo.')
    } finally {
      setDownloading(false)
    }
  }

  const reset = () => {
    setFile(null); setStatus('idle'); setProgress(0); setResult(null); setError(''); setErrorDetails(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  if (status === 'success' && result) {
    return (
      <div className={styles.wrapper}>
        <ResultPage result={result} onReset={reset} onDashboard={onDashboard} />
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>

      {/* ── Hero ── */}
      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.heroBadge}>📥 Importación de cartera</div>
          <h1 className={styles.heroTitle}>Carga tu Excel diario</h1>
          <p className={styles.heroSub}>
            Sube el reporte de Rappi con el estado de las tiendas para actualizar
            el dashboard, métricas y prioridades automáticamente.
          </p>
        </div>
        <button
          className={styles.btnDownload}
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading
            ? <><span className={styles.spinner} /> Descargando...</>
            : <><DownloadIcon /> Descargar plantilla Excel</>
          }
        </button>
      </div>

      {/* ── Flujo ── */}
      <div className={styles.flowRow}>
        <FlowStep icon="⬇" num="1" title="Descarga la plantilla" text="Con las 18 columnas requeridas ya configuradas" />
        <div className={styles.flowArrow} />
        <FlowStep icon="✏" num="2" title="Llénala con tus datos" text="Copia los datos del reporte diario de Rappi" />
        <div className={styles.flowArrow} />
        <FlowStep icon="⬆" num="3" title="Sube el archivo aquí" text="Arrastra o haz clic para seleccionar el .xlsx" />
        <div className={styles.flowArrow} />
        <FlowStep icon="✓" num="4" title="Listo" text="El dashboard se actualiza automáticamente" />
      </div>

      {/* ── Columnas requeridas ── */}
      <div className={styles.colSection}>
        <button className={styles.colHeader} onClick={() => setColsOpen(v => !v)}>
          <div className={styles.colHeaderLeft}>
            <span className={styles.colHeaderTitle}>Columnas del Excel</span>
            <span className={styles.colHeaderBadge}>{COLUMNS.length} columnas</span>
          </div>
          <span className={`${styles.colChevron} ${colsOpen ? styles.colChevronOpen : ''}`}>›</span>
        </button>
        {colsOpen && (
          <div className={styles.colTable}>
            <div className={styles.colTableHead}>
              <span>Nombre de columna</span>
              <span>Ejemplo</span>
              <span>Descripción</span>
            </div>
            {COLUMNS.map((col, i) => (
              <div key={col.name} className={`${styles.colRow} ${i % 2 === 0 ? styles.colRowAlt : ''}`}>
                <span className={styles.colName}>{col.name}</span>
                <span className={styles.colExample}>{col.example}</span>
                <span className={styles.colDesc}>{col.desc}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Dropzone ── */}
      <div
        className={`${styles.dropzone} ${dragging ? styles.dragging : ''} ${file ? styles.hasFile : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
        onClick={() => !file && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className={styles.hidden}
          onChange={(e) => { handleFile(e.target.files[0]) }} />

        {file ? (
          <div className={styles.filePill}>
            <span className={styles.filePillIcon}>📊</span>
            <div className={styles.filePillInfo}>
              <span className={styles.filePillName}>{file.name}</span>
              <span className={styles.filePillMeta}>{(file.size / 1024).toFixed(1)} KB · listo para procesar</span>
            </div>
            <button className={styles.filePillRemove} onClick={(e) => { e.stopPropagation(); reset() }}>✕</button>
          </div>
        ) : (
          <>
            <div className={styles.dropCircle}>
              <span className={styles.dropArrow}>⬆</span>
            </div>
            <p className={styles.dropMain}>Arrastra el archivo aquí</p>
            <p className={styles.dropOr}>o <span>haz clic para buscar</span> en tu equipo</p>
            <span className={styles.dropFormats}>.xlsx &nbsp;·&nbsp; .xls</span>
          </>
        )}
      </div>

      {/* ── Progreso ── */}
      {status === 'uploading' && (
        <div className={styles.progressBlock}>
          <div className={styles.progressTop}>
            <span className={styles.progressLabel}>Procesando cartera...</span>
            <span className={styles.progressPct}>{progress}%</span>
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressBar} style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className={styles.errorBanner}>
          <span className={styles.errorEmoji}>⚠</span>
          <div style={{ flex: 1 }}>
            <p className={styles.errorTitle}>No se pudo procesar el archivo</p>
            <p className={styles.errorBody}>{error}</p>
            {errorDetails && (
              <ul className={styles.errorDetails}>
                {errorDetails.slice(0, 10).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
                {errorDetails.length > 10 && (
                  <li>…y {errorDetails.length - 10} errores más</li>
                )}
              </ul>
            )}
          </div>
          <button className={styles.errorClose} onClick={() => { setError(''); setErrorDetails(null) }}>✕</button>
        </div>
      )}

      {/* ── Acciones ── */}
      {file && status !== 'uploading' && (
        <div className={styles.actions}>
          <button className={styles.btnOutline} onClick={reset}>Cancelar</button>
          <button className={styles.btnRed} onClick={handleUpload}>
            Procesar archivo →
          </button>
        </div>
      )}

    </div>
  )
}

// ── Pantalla de resultado detallado ──────────────────────────────────────────

function ResultPage({ result, onReset, onDashboard }) {
  const [activeTab, setActiveTab] = useState('created')

  const tabs = [
    { key: 'created',  label: 'Nuevas',       count: result.created  ?? 0, color: '#22C55E', list: result.createdList  ?? [] },
    { key: 'updated',  label: 'Actualizadas', count: result.updated  ?? 0, color: '#3B82F6', list: result.updatedList  ?? [] },
    { key: 'skipped',  label: 'Ignoradas',    count: result.skipped  ?? 0, color: '#F59E0B', list: result.skippedList  ?? [] },
    { key: 'errors',   label: 'Con error',    count: result.errors   ?? 0, color: '#EF4444', list: result.errorList    ?? [] },
    { key: 'removed',  label: 'Eliminadas',   count: result.removed  ?? 0, color: '#8B5CF6', list: result.removedList  ?? [] },
  ].filter(t => t.count > 0)

  const current = tabs.find(t => t.key === activeTab) ?? tabs[0]

  return (
    <div className={styles.resultPage}>

      {/* Header */}
      <div className={styles.resultHeader}>
        <div className={styles.resultIconWrap}>✓</div>
        <div>
          <h2 className={styles.resultTitle}>Importación completada</h2>
          <p className={styles.resultSub}>{result.total ?? 0} filas procesadas del archivo</p>
        </div>
      </div>

      {/* Stats strip */}
      <div className={styles.statStrip}>
        <StatStrip value={result.total    ?? 0} label="Total"        color="#F0F2F8" />
        <StatStrip value={result.created  ?? 0} label="Nuevas"       color="#22C55E" />
        <StatStrip value={result.updated  ?? 0} label="Actualizadas" color="#3B82F6" />
        {(result.skipped ?? 0) > 0 && <StatStrip value={result.skipped} label="Ignoradas" color="#F59E0B" />}
        {(result.errors  ?? 0) > 0 && <StatStrip value={result.errors}  label="Errores"   color="#EF4444" />}
        {(result.removed ?? 0) > 0 && <StatStrip value={result.removed} label="Eliminadas" color="#8B5CF6" />}
      </div>

      {/* Tabs de detalle */}
      {tabs.length > 0 && (
        <div className={styles.resultDetail}>
          <div className={styles.resultTabs}>
            {tabs.map(t => (
              <button
                key={t.key}
                className={`${styles.resultTab} ${activeTab === t.key ? styles.resultTabActive : ''}`}
                style={activeTab === t.key ? { borderBottomColor: t.color, color: t.color } : {}}
                onClick={() => setActiveTab(t.key)}
              >
                <span className={styles.resultTabDot} style={{ background: t.color }} />
                {t.label}
                <span className={styles.resultTabCount} style={activeTab === t.key ? { background: t.color + '22', color: t.color } : {}}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          <div className={styles.resultTableWrap}>
            {current && current.list.length > 0 ? (
              <table className={styles.resultTable}>
                <thead>
                  <tr>
                    <th>Store ID</th>
                    <th>Nombre de tienda</th>
                    {current.key === 'errors'
                      ? <th>Motivo del error</th>
                      : <>
                          <th>Farmer</th>
                          <th>Canal</th>
                        </>
                    }
                  </tr>
                </thead>
                <tbody>
                  {current.list.map((row, i) => (
                    <tr key={i}>
                      <td className={styles.resultCode}>{row.storeCode ?? '—'}</td>
                      <td>{row.storeName ?? '—'}</td>
                      {current.key === 'errors'
                        ? <td className={styles.resultError}>{row.reason ?? '—'}</td>
                        : <>
                            <td className={styles.resultMuted}>{row.farmerEmail ?? '—'}</td>
                            <td><span className={styles.resultTag}>{row.channel ?? '—'}</span></td>
                          </>
                      }
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className={styles.resultEmpty}>Sin registros en esta categoría</p>
            )}
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className={styles.resultActions}>
        <button className={styles.btnOutline} onClick={onReset}>← Cargar otro archivo</button>
        <button className={styles.btnRed} onClick={onDashboard}>Ir al dashboard →</button>
      </div>

    </div>
  )
}

function StatStrip({ value, label, color }) {
  return (
    <div className={styles.statStripItem}>
      <span className={styles.statStripValue} style={{ color }}>{value}</span>
      <span className={styles.statStripLabel}>{label}</span>
    </div>
  )
}

function FlowStep({ icon, num, title, text }) {
  return (
    <div className={styles.flowStep}>
      <div className={styles.flowNum}>{num}</div>
      <div className={styles.flowIcon}>{icon}</div>
      <p className={styles.flowTitle}>{title}</p>
      <p className={styles.flowText}>{text}</p>
    </div>
  )
}

function StatCard({ value, label, accent }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statValue} style={{ color: accent }}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}
