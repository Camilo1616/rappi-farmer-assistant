import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, register, sendPin, checkEmail, forgotPassword, resetPassword } from '../services/authService'
import { useAuth } from '../context/AuthContext'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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
    <div className={styles.container}>

      {/* Panel izquierdo decorativo */}
      <div className={styles.left}>
        <div className={styles.orb + ' ' + styles.orb1} />
        <div className={styles.orb + ' ' + styles.orb2} />
        <div className={styles.orb + ' ' + styles.orb3} />

        {/* Brand */}
        <div className={styles.leftBrand}>
          <span className={styles.brandDot} />
          <span className={styles.brandName}>Rappi Farmer Assistant</span>
        </div>

        {/* Headline central */}
        <div className={styles.leftContent}>
          <div className={styles.leftBadge}>Account Manager · Herramienta interna</div>
          <h1 className={styles.leftHeadline}>
            Tu cartera,<br />
            bajo <em>control</em><br />
            total.
          </h1>
          <p className={styles.leftSub}>
            Prioriza, gestiona y activa restaurantes sin perder el hilo.
            Diseñado para el ritmo real de un AM de Rappi.
          </p>

          {/* Feature pills */}
          <div className={styles.featureList}>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>⚡</span>
              <span>WhatsApp masivo con plantillas dinámicas</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>📊</span>
              <span>Dashboard de prioridades en tiempo real</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>🗂️</span>
              <span>Seguimiento de onboarding día a día</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>🔔</span>
              <span>Alertas de churn y Aliados &lt; 60 %</span>
            </div>
          </div>
        </div>

        {/* Footer stats */}
        <div className={styles.leftFooter}>
          <div className={styles.stat}>
            <span className={styles.statValue}>500<span className={styles.statPlus}>+</span></span>
            <span className={styles.statLabel}>Restaurantes</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statValue}>40</span>
            <span className={styles.statLabel}>WhatsApp / día</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statValue}>8</span>
            <span className={styles.statLabel}>Días críticos</span>
          </div>
        </div>
      </div>

      {/* Panel derecho: formulario */}
      <div className={styles.right}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Bienvenido de vuelta</h2>
            <p className={styles.cardSub}>Ingresa con tu cuenta @rappi.com</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="email" className={styles.label}>Correo</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>✉</span>
                <input
                  id="email"
                  type="email"
                  className={styles.input}
                  placeholder="nombre@rappi.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="password" className={styles.label}>Contraseña</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>🔒</span>
                <input
                  id="password"
                  type="password"
                  className={styles.input}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className={styles.error}>
                <span>⚠</span> {error}
              </div>
            )}

            <button type="submit" className={styles.btn} disabled={loading}>
              {loading && <span className={styles.spinner} />}
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>

            <button type="button" className={styles.forgotLink}
              onClick={() => setShowForgot(true)}>
              ¿Olvidaste tu contraseña?
            </button>
          </form>

          <div className={styles.divider}><span>¿Eres nuevo?</span></div>

          <button className={styles.btnRegister} onClick={() => setShowRegister(true)}>
            ✨ Crear cuenta de Farmer
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

function RegisterModal({ onSuccess, onClose }) {
  const [step,        setStep]        = useState(1)
  const [fullName,    setFullName]    = useState('')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [confirmPwd,  setConfirmPwd]  = useState('')
  const [showPwd,     setShowPwd]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [country,     setCountry]     = useState('CO')
  const [pin,         setPin]         = useState('')
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [resending,   setResending]   = useState(false)
  const [emailExists, setEmailExists] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)

  const COUNTRIES = ['CO','MX','AR','PE','BR','EC','CL','CR','UY','BO','PA','HN']

  const handleEmailChange = async (val) => {
    setEmail(val)
    setEmailExists(false)
    if (val.includes('@') && val.includes('.')) {
      setCheckingEmail(true)
      try {
        const r = await checkEmail(val)
        setEmailExists(r.data.exists)
      } catch {}
      finally { setCheckingEmail(false) }
    }
  }

  const handleSendPin = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPwd) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 6)    { setError('La contraseña debe tener al menos 6 caracteres'); return }
    setLoading(true)
    try {
      await sendPin(email)
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.message || 'Error al enviar el código')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true); setError('')
    try { await sendPin(email) }
    catch (err) { setError('Error al reenviar el código') }
    finally { setResending(false) }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (pin.length !== 6) { setError('El código debe tener 6 dígitos'); return }
    setLoading(true); setError('')
    try {
      const data = await register({ fullName, email, password, countryCode: country, pin })
      onSuccess(data)
    } catch (err) {
      setError(err.response?.data?.message || 'Código incorrecto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>Crear cuenta de Farmer</h3>
            <div className={styles.modalSteps}>
              <span className={`${styles.stepDot} ${step >= 1 ? styles.stepDotActive : ''}`}>1</span>
              <span className={styles.stepLine} />
              <span className={`${styles.stepDot} ${step >= 2 ? styles.stepDotActive : ''}`}>2</span>
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
              <label className={styles.modalLabel}>País</label>
              <select className={styles.modalInput} value={country} onChange={e => setCountry(e.target.value)}>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
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
              {loading ? 'Enviando código...' : '📧 Enviar código de verificación'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form className={styles.modalForm} onSubmit={handleVerify}>
            <div className={styles.pinInfo}>
              <span className={styles.pinIcon}>📬</span>
              <p>Enviamos un código de 6 dígitos a<br /><strong>{email}</strong></p>
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
              {loading ? 'Verificando...' : '✅ Verificar y crear cuenta'}
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
            <p style={{color:'#D1D5DB',margin:0}}>Contraseña actualizada correctamente</p>
            <button className={styles.modalBtn} onClick={onClose}>Ir al login</button>
          </div>
        ) : step === 1 ? (
          <form className={styles.modalForm} onSubmit={handleSendPin}>
            <p style={{color:'#9CA3AF',fontSize:'0.85rem',margin:0}}>
              Ingresa tu correo registrado y te enviaremos un código.
            </p>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Correo @rappi.com</label>
              <input className={styles.modalInput} type="email" placeholder="nombre@rappi.com"
                value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            {error && <div className={styles.modalError}>⚠ {error}</div>}
            <button type="submit" className={styles.modalBtn} disabled={loading || !email}>
              {loading ? 'Enviando...' : '📧 Enviar código'}
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
              Verificar código →
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
              {loading ? 'Guardando...' : '🔐 Cambiar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
