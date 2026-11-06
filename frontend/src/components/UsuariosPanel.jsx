import { useState, useEffect, useCallback } from 'react'
import { listUsers, createUser, resendAccess, setUserActive, setUserRole } from '../services/usuariosService'
import styles from './UsuariosPanel.module.css'

const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '·'
const ROLES = { DUENA: 'Propietaria', ASISTENTE: 'Asistente de cartera' }

/**
 * Usuarios y roles: crear usuarios y gestionar su acceso. La contraseña temporal la genera el sistema,
 * se envía al correo del usuario y nunca se muestra en pantalla; al entrar debe cambiarla.
 */
export default function UsuariosPanel({ actorId, actorRole, onError }) {
  const [users, setUsers] = useState(null)
  const [form, setForm] = useState({ fullName: '', email: '', role: 'ASISTENTE' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [confirmResend, setConfirmResend] = useState(null)
  // Quien es solo asistente únicamente puede crear asistentes
  const allowedRoles = actorRole === 'ASISTENTE' ? ['ASISTENTE'] : ['ASISTENTE', 'DUENA']

  const load = useCallback(() => listUsers().then(setUsers).catch(() => onError('No se pudieron cargar los usuarios')), [onError])
  useEffect(() => { load() }, [load])

  const run = async (fn, okMessage) => {
    onError(''); setNotice(''); setBusy(true)
    try { const r = await fn(); if (Array.isArray(r)) setUsers(r); if (okMessage) setNotice(okMessage); return true }
    catch (e) { onError(e.response?.data?.message || 'Error inesperado'); return false }
    finally { setBusy(false) }
  }

  const submit = async (e) => {
    e.preventDefault()
    const email = form.email.trim()
    const ok = await run(() => createUser(form), `Listo: enviamos la contraseña temporal a ${email}. El usuario deberá cambiarla al entrar.`)
    if (ok) setForm({ fullName: '', email: '', role: form.role })
  }

  if (!users) return <div className={styles.hint}>Cargando usuarios…</div>

  return (
    <div>
      <form className={styles.formCard} onSubmit={submit}>
        <div className={styles.formTitle}>Nuevo usuario</div>
        <div className={styles.row}>
          <input className={styles.input} placeholder="Nombre completo" value={form.fullName}
            onChange={e => setForm({ ...form, fullName: e.target.value })} required />
          <input className={styles.input} type="email" placeholder="Correo del usuario" value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })} required />
          <select className={styles.input} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} aria-label="Rol">
            {allowedRoles.map(r => <option key={r} value={r}>{ROLES[r]}</option>)}
          </select>
        </div>
        <div className={styles.hint}>
          La contraseña se genera sola y se envía al correo del usuario. No se muestra aquí; al entrar por primera vez el sistema le pedirá crear una nueva.
        </div>
        <div><button className={styles.btn} type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Crear y enviar contraseña por correo'}</button></div>
      </form>

      {notice && <div className={styles.ok} style={{ marginBottom: 14 }}>{notice}</div>}

      <div className={styles.list}>
        {users.map(u => (
          <div key={u.id} className={styles.user}>
            <div className={styles.who}>
              <div className={styles.avatar}>{initials(u.fullName)}</div>
              <div style={{ minWidth: 0 }}>
                <div className={styles.name}>{u.fullName}</div>
                <div className={styles.mail}>{u.email}</div>
                <div className={styles.tags}>
                  <span className={styles.tag}>{u.roleLabel}</span>
                  <span className={`${styles.tag} ${u.active ? styles.tagOk : styles.tagOff}`}>{u.active ? 'Activo' : 'Desactivado'}</span>
                  {u.mustChangePassword && <span className={`${styles.tag} ${styles.tagWarn}`}>Aún no cambia la clave</span>}
                </div>
              </div>
            </div>
            {u.id === actorId ? <div className={styles.hint}>Este eres tú</div> : u.canManage ? (
              <div className={styles.actions}>
                <select className={styles.select} value={u.role} aria-label={`Rol de ${u.fullName}`} disabled={busy}
                  onChange={e => run(() => setUserRole(u.id, e.target.value), 'Rol actualizado')}>
                  {Object.entries(ROLES).filter(([k]) => allowedRoles.includes(k) || k === u.role).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                {confirmResend === u.id ? (
                  <span className={styles.confirm}>¿Enviar una contraseña nueva a {u.email}?
                    <button className={styles.btn} disabled={busy}
                      onClick={async () => { await run(() => resendAccess(u.id).then(() => null), `Enviamos una contraseña temporal nueva a ${u.email}`); setConfirmResend(null) }}>Sí, enviar</button>
                    <button className={`${styles.btn} ${styles.ghost}`} onClick={() => setConfirmResend(null)}>Cancelar</button>
                  </span>
                ) : (
                  <button className={`${styles.btn} ${styles.ghost}`} disabled={busy} onClick={() => setConfirmResend(u.id)}>Reenviar contraseña</button>
                )}
                <button className={`${styles.btn} ${styles.ghost} ${u.active ? styles.danger : ''}`} disabled={busy}
                  onClick={() => run(() => setUserActive(u.id, !u.active), u.active ? 'Usuario desactivado' : 'Usuario activado')}>
                  {u.active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            ) : <div className={styles.hint}>Solo lectura</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
