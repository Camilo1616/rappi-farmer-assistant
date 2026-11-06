import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { changePassword } from '../services/profileService'
import { logout } from '../services/authService'
import '../styles/app-theme.css'
import styles from './CambiarClavePage.module.css'

/** Primer ingreso: reemplaza la contraseña temporal enviada por correo por una propia. */
export default function CambiarClavePage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (next.length < 8) return setError('La contraseña nueva debe tener al menos 8 caracteres')
    if (next !== confirm) return setError('Las contraseñas nuevas no coinciden')
    setBusy(true)
    try {
      await changePassword(current, next)
      const updated = { ...user, mustChangePassword: false }
      localStorage.setItem('user', JSON.stringify(updated))
      setUser(updated)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cambiar la contraseña')
    } finally { setBusy(false) }
  }

  return (
    <div className={`app-theme ${styles.page}`}>
      <form className={styles.card} onSubmit={submit}>
        <h1 className={styles.title}>Crea tu contraseña</h1>
        <p className={styles.text}>Entraste con la contraseña temporal que te llegó al correo. Por seguridad, elige una propia para continuar.</p>
        <label className={styles.label}>Contraseña temporal</label>
        <input className={styles.input} type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required autoFocus />
        <label className={styles.label}>Contraseña nueva</label>
        <input className={styles.input} type="password" autoComplete="new-password" minLength={8} value={next} onChange={e => setNext(e.target.value)} required />
        <label className={styles.label}>Repite la contraseña nueva</label>
        <input className={styles.input} type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} required />
        {error && <div className={styles.error} role="alert">{error}</div>}
        <button className={styles.btn} type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar y entrar'}</button>
        <button type="button" className={styles.link} onClick={() => logout()}>Salir</button>
      </form>
    </div>
  )
}
