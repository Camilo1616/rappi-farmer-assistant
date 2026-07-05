import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, register, sendPin, checkEmail, forgotPassword, resetPassword } from '../services/authService'
import { useAuth } from '../context/AuthContext'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [showForgot,   setShowForgot]   = useState(false)
  const { setUser } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(email, password)
      setUser({ id: data.id, email: data.email, fullName: data.fullName, role: data.role })
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterSuccess = (data) => {
    setUser({ id: data.id, email: data.email, fullName: data.fullName, role: data.role })
    navigate('/')
  }

  return (
    <div className={styles.page}>

      {/* ── Panel izquierdo ── */}
      <div className={styles.left}>
        <div className={styles.orb + ' ' + styles.orb1} />
        <div className={styles.orb + ' ' + styles.orb2} />
        <div className={styles.orb + ' ' + styles.orb3} />

        <div className={styles.leftCenter}>
          <div className={styles.leftBrandMark}>
            <span className={styles.brandMarkDot} />
            <span className={styles.brandMarkName}>Rappi Assistant</span>
          </div>
          <p className={styles.brandMarkSub}>Herramienta interna</p>
        </div>
      </div>

      {/* ── Panel derecho ── */}
      <div className={styles.right}>
        <div className={styles.card}>

          <div className={styles.logo}>
            <span className={styles.logoDot} />
            <div className={styles.logoWords}>
              <span className={styles.logoText}>rappi</span>
              <span className={styles.logoSub}>assistant</span>
            </div>
          </div>

          <h2 className={styles.title}>Bienvenido de vuelta</h2>
          <p className={styles.sub}>Ingresa con tu cuenta @rappi.com</p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.fieldWrap}>
              <label className={styles.fieldLabel}>Correo</label>
              <input
                type="email"
                className={styles.input}
                placeholder="nombre@rappi.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className={styles.fieldWrap}>
              <label className={styles.fieldLabel}>Contraseña</label>
              <input
                type="password"
                className={styles.input}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button type="button" className={styles.forgotInline}
              onClick={() => setShowForgot(true)}>
              ¿Olvidaste tu contraseña?
            </button>

            {error && <div className={styles.error}>{error}</div>}

            <button type="submit" className={styles.btn} disabled={loading}>
              {loading && <span className={styles.spinner} />}
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>

          <div className={styles.divider}>¿Eres nuevo?</div>

          <button className={styles.btnRegister} onClick={() => setShowRegister(true)}>
            Crear cuenta
          </button>

        </div>
      </div>

      {showRegister && (
        <RegisterModal onSuccess={handleRegisterSuccess} onClose={() => setShowRegister(false)} />
      )}
      {showForgot && (
        <ForgotPasswordModal onClose={() => setShowForgot(false)} />
      )}
    </div>
  )
}

/* ─── Modal de registro ────────────────────────────────────────────────────── */

function RegisterModal({ onSuccess, onClose }) {
  const [step,          setStep]          = useState(1)
  const [fullName,      setFullName]      = useState('')
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [confirmPwd,    setConfirmPwd]    = useState('')
  const [showPwd,       setShowPwd]       = useState(false)
  const [showConfirm,   setShowConfirm]   = useState(false)
  const [pin,           setPin]           = useState('')
  const [error,         setError]         = useState('')
  const [loading,       setLoading]       = useState(false)
  const [resending,     setResending]     = useState(false)
  const [emailExists,   setEmailExists]   = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)

  const totalSteps = 2

  const handleEmailChange = async (val) => {
    setEmail(val); setEmailExists(false)
    if (val.includes('@') && val.includes('.')) {
      setCheckingEmail(true)
      try { const r = await checkEmail(val); setEmailExists(r.data.exists) } catch {}
      finally { setCheckingEmail(false) }
    }
  }

  const handleSendPin = async (e) => {
    e.preventDefault(); setError('')
    if (!email.toLowerCase().endsWith('@rappi.com')) { setError('Solo se permiten correos corporativos @rappi.com'); return }
    if (password !== confirmPwd) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 6)    { setError('La contraseña debe tener al menos 6 caracteres'); return }
    setLoading(true)
    try { await sendPin(email); setStep(2) }
    catch (err) { setError(err.response?.data?.message || 'Error al enviar el código') }
    finally { setLoading(false) }
  }

  const handleResend = async () => {
    setResending(true); setError('')
    try { await sendPin(email) } catch { setError('Error al reenviar el código') }
    finally { setResending(false) }
  }

  const handleVerifyPin = (e) => {
    e.preventDefault(); setError('')
    if (pin.length !== 6) { setError('El código debe tener 6 dígitos'); return }
    handleRegister()
  }

  const handleRegister = async () => {
    setLoading(true); setError('')
    try {
      const data = await register({ fullName, email, password, pin })
      onSuccess(data)
    } catch (err) {
      setError(err.response?.data?.message || 'Código incorrecto o error al crear la cuenta')
      if (err.response?.status === 400 && err.response?.data?.message?.toLowerCase().includes('código')) setStep(2)
    } finally { setLoading(false) }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>Crear cuenta</h3>
            <div className={styles.modalSteps}>
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s, i) => (
                <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className={`${styles.stepDot} ${step >= s ? styles.stepDotActive : ''}`}>{s}</span>
                  {i < totalSteps - 1 && <span className={styles.stepLine} />}
                </span>
              ))}
            </div>
          </div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {step === 1 && (
          <form className={styles.modalForm} onSubmit={handleSendPin}>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Nombre completo</label>
              <input className={styles.modalInput} placeholder="Ej: Cristian Ariza"
                value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Correo @rappi.com</label>
              <input className={`${styles.modalInput} ${emailExists ? styles.inputError : ''}`}
                type="email" placeholder="nombre@rappi.com"
                value={email} onChange={e => handleEmailChange(e.target.value)} required />
              {checkingEmail && <span className={styles.emailHint}>Verificando...</span>}
              {emailExists && <span className={styles.emailTaken}>⚠ Este correo ya tiene cuenta. Inicia sesión.</span>}
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Contraseña</label>
              <div className={styles.pwdWrap}>
                <input className={styles.modalInput} type={showPwd ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Confirmar contraseña</label>
              <div className={styles.pwdWrap}>
                <input className={styles.modalInput} type={showConfirm ? 'text' : 'password'}
                  placeholder="Repite la contraseña"
                  value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirm(v => !v)}>
                  {showConfirm ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            {error && <div className={styles.modalError}>⚠ {error}</div>}
            <button type="submit" className={styles.modalBtn}
              disabled={loading || !fullName || !email || !password || !confirmPwd || emailExists}>
              {loading ? 'Enviando código...' : 'Enviar código de verificación'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form className={styles.modalForm} onSubmit={handleVerifyPin}>
            <div className={styles.pinInfo}>
              <span className={styles.pinIcon}>📬</span>
              <p>Código enviado a<br /><strong>{email}</strong></p>
              <p className={styles.pinSub}>Expira en 10 minutos</p>
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Código de verificación</label>
              <input className={`${styles.modalInput} ${styles.pinInput}`}
                placeholder="000000" maxLength={6}
                value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                autoFocus required />
            </div>
            {error && <div className={styles.modalError}>⚠ {error}</div>}
            <button type="submit" className={styles.modalBtn} disabled={loading || pin.length !== 6}>
              {loading ? 'Verificando...' : 'Crear cuenta'}
            </button>
            <button type="button" className={styles.btnResend} onClick={handleResend} disabled={resending}>
              {resending ? 'Reenviando...' : '¿No recibiste el código? Reenviar'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

/* ─── Modal recuperar contraseña ───────────────────────────────────────────── */

function ForgotPasswordModal({ onClose }) {
  const [step,       setStep]       = useState(1)
  const [email,      setEmail]      = useState('')
  const [pin,        setPin]        = useState('')
  const [newPwd,     setNewPwd]     = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showPwd,    setShowPwd]    = useState(false)
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [success,    setSuccess]    = useState(false)

  const handleSendPin = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await forgotPassword(email); setStep(2) }
    catch (err) { setError(err.response?.data?.message || 'Error al enviar código') }
    finally { setLoading(false) }
  }

  const handleVerifyPin = (e) => {
    e.preventDefault(); setError('')
    if (pin.length !== 6) { setError('El código debe tener 6 dígitos'); return }
    setStep(3)
  }

  const handleReset = async (e) => {
    e.preventDefault(); setError('')
    if (newPwd !== confirmPwd) { setError('Las contraseñas no coinciden'); return }
    if (newPwd.length < 6)    { setError('Mínimo 6 caracteres'); return }
    setLoading(true)
    try { await resetPassword(email, pin, newPwd); setSuccess(true) }
    catch (err) { setError(err.response?.data?.message || 'Código incorrecto o expirado') }
    finally { setLoading(false) }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>Recuperar contraseña</h3>
            {!success && (
              <div className={styles.modalSteps}>
                {[1,2,3].map((s,i) => (
                  <span key={s} style={{display:'flex',alignItems:'center',gap:6}}>
                    <span className={`${styles.stepDot} ${step >= s ? styles.stepDotActive : ''}`}>{s}</span>
                    {i < 2 && <span className={styles.stepLine} />}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {success ? (
          <div className={styles.modalForm} style={{alignItems:'center',textAlign:'center',gap:16}}>
            <span style={{fontSize:'2.5rem'}}>✅</span>
            <p style={{color:'#C8B4A8',margin:0}}>Contraseña actualizada correctamente</p>
            <button className={styles.modalBtn} onClick={onClose}>Ir al login</button>
          </div>
        ) : step === 1 ? (
          <form className={styles.modalForm} onSubmit={handleSendPin}>
            <p style={{color:'#8B6F5E',fontSize:'0.85rem',margin:0}}>
              Ingresa tu correo registrado y te enviaremos un código.
            </p>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Correo @rappi.com</label>
              <input className={styles.modalInput} type="email" placeholder="nombre@rappi.com"
                value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            {error && <div className={styles.modalError}>⚠ {error}</div>}
            <button type="submit" className={styles.modalBtn} disabled={loading || !email}>
              {loading ? 'Enviando...' : 'Enviar código'}
            </button>
          </form>
        ) : step === 2 ? (
          <form className={styles.modalForm} onSubmit={handleVerifyPin}>
            <div className={styles.pinInfo}>
              <span className={styles.pinIcon}>📬</span>
              <p>Código enviado a<br /><strong>{email}</strong></p>
              <p className={styles.pinSub}>Expira en 10 minutos</p>
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Código de verificación</label>
              <input className={`${styles.modalInput} ${styles.pinInput}`}
                placeholder="000000" maxLength={6}
                value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,''))}
                autoFocus required />
            </div>
            {error && <div className={styles.modalError}>⚠ {error}</div>}
            <button type="submit" className={styles.modalBtn} disabled={pin.length !== 6}>
              Verificar →
            </button>
          </form>
        ) : (
          <form className={styles.modalForm} onSubmit={handleReset}>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Nueva contraseña</label>
              <div className={styles.pwdWrap}>
                <input className={styles.modalInput} type={showPwd ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={newPwd} onChange={e => setNewPwd(e.target.value)} required autoFocus />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Confirmar contraseña</label>
              <div className={styles.pwdWrap}>
                <input className={styles.modalInput} type={showPwd ? 'text' : 'password'}
                  placeholder="Repite la contraseña"
                  value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required />
              </div>
            </div>
            {error && <div className={styles.modalError}>⚠ {error}</div>}
            <button type="submit" className={styles.modalBtn} disabled={loading || !newPwd || !confirmPwd}>
              {loading ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
