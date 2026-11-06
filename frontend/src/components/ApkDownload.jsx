import { useState, useEffect } from 'react'
import Icon from './Icon'
import styles from './ApkDownload.module.css'

// El archivo se publica en frontend/public/downloads/app.apk, o en otra dirección con VITE_APK_URL
const APK_URL = import.meta.env.VITE_APK_URL || '/downloads/app.apk'
// Logo de J.Bell: frontend/public/brand/jbell-logo.png. Si aún no está, se muestra un ícono genérico.
const LOGO_URL = '/brand/jbell-logo.png'

/** Espacio para descargar la app de Android (APK). Detecta si el archivo ya está publicado. */
export default function ApkDownload() {
  const [status, setStatus] = useState('checking') // checking | ready | missing
  const [logoOk, setLogoOk] = useState(true)

  useEffect(() => {
    let live = true
    // Si el servidor responde con una página HTML (en vez del archivo), el APK aún no está publicado
    fetch(APK_URL, { method: 'HEAD' })
      .then(r => { if (live) setStatus(r.ok && !(r.headers.get('content-type') || '').includes('text/html') ? 'ready' : 'missing') })
      .catch(() => live && setStatus('missing'))
    return () => { live = false }
  }, [])

  const ready = status === 'ready'
  return (
    <div className={styles.card}>
      {logoOk
        ? <img className={styles.logo} src={LOGO_URL} alt="J.Bell" onError={() => setLogoOk(false)} />
        : <div className={styles.icon}><Icon name="smartphone" size={28} /></div>}
      <div>
        <span className={`${styles.badge} ${ready ? styles.ok : styles.wait}`}>
          {status === 'checking' ? 'Revisando…' : ready ? 'Disponible' : 'Aún no publicada'}
        </span>
        <div className={styles.title}>Descargar la app para Android</div>
        <div className={styles.text}>Instálala en el celular o la tablet para usar el panel con un toque, sin abrir el navegador.</div>
        {!ready && status === 'missing' && (
          <div className={styles.note}>El archivo todavía no está en el servidor. Cuando se publique en <code>{APK_URL}</code> el botón se activa solo.</div>
        )}
      </div>
      <a className={`${styles.btn} ${ready ? '' : styles.btnOff}`} href={ready ? APK_URL : undefined} download>
        <Icon name="download" size={18} />Descargar APK
      </a>
      <div className={styles.steps}>
        <div className={styles.step}><span className={styles.num}>1</span>Descarga el archivo desde el celular.</div>
        <div className={styles.step}><span className={styles.num}>2</span>Ábrelo desde las descargas.</div>
        <div className={styles.step}><span className={styles.num}>3</span>Si lo pide, permite instalar apps desconocidas.</div>
        <div className={styles.step}><span className={styles.num}>4</span>Entra con tu usuario y contraseña.</div>
      </div>
    </div>
  )
}
