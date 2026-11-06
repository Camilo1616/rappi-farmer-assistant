import { useState } from 'react'
import Icon from './Icon'
import styles from './AppShell.module.css'

const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '·'
const ROLE = { DUENA: 'Propietaria', ASISTENTE: 'Cartera', ADMIN: 'Administrador' }

/**
 * Estructura de la app: menú lateral en escritorio, barra inferior con hoja "Más" en celular.
 * items: [{ key, label, icon }]; moreKeys: las que en celular van dentro de "Más".
 */
export default function AppShell({ items, moreKeys, active, onNavigate, title, subtitle, user, onLogout, actions, children }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const primary = items.filter(i => !moreKeys.includes(i.key))
  const more = items.filter(i => moreKeys.includes(i.key))
  const go = (key) => { setMoreOpen(false); onNavigate(key) }

  return (
    <div className={`app-theme ${styles.shell}`}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}><Icon name="tag" size={20} /></div>
          <div><div className={styles.brandName}>Panel de ventas</div><div className={styles.brandSub}>Despachos y cartera</div></div>
        </div>
        <div className={styles.navLabel}>Menú</div>
        {items.map(i => (
          <button key={i.key} className={`${styles.navItem} ${active === i.key ? styles.navOn : ''}`} onClick={() => go(i.key)}>
            <Icon name={i.icon} size={18} />{i.label}
          </button>
        ))}
        <div className={styles.spacer} />
        <div className={styles.userCard}>
          <div className={styles.avatar}>{initials(user?.fullName)}</div>
          <div><div className={styles.userName}>{user?.fullName || 'Usuario'}</div><div className={styles.userRole}>{ROLE[user?.role] || ''}</div></div>
          <button className={styles.logout} onClick={onLogout} aria-label="Salir"><Icon name="logout" size={17} /></button>
        </div>
      </aside>

      <div className={styles.content}>
        <header className={styles.topbar}>
          <div><h1 className={styles.title}>{title}</h1>{subtitle && <div className={styles.subtitle}>{subtitle}</div>}</div>
          <div className={styles.actions}>{actions}</div>
        </header>
        <main className={styles.main}>{children}</main>
      </div>

      <nav className={styles.bottomNav} aria-label="Navegación principal">
        {primary.map(i => (
          <button key={i.key} className={`${styles.bnItem} ${active === i.key ? styles.bnOn : ''}`} onClick={() => go(i.key)}>
            <span className={styles.bnIcon}><Icon name={i.icon} size={19} /></span>{i.label}
          </button>
        ))}
        <button className={`${styles.bnItem} ${more.some(i => i.key === active) ? styles.bnOn : ''}`} onClick={() => setMoreOpen(true)}>
          <span className={styles.bnIcon}><Icon name="grid" size={19} /></span>Más
        </button>
      </nav>

      {moreOpen && (
        <div className={styles.backdrop} onClick={() => setMoreOpen(false)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <div className={styles.grip} />
            {more.map(i => (
              <button key={i.key} className={`${styles.sheetItem} ${active === i.key ? styles.sheetItemOn : ''}`} onClick={() => go(i.key)}>
                <Icon name={i.icon} size={20} />{i.label}
              </button>
            ))}
            <button className={`${styles.sheetItem} ${styles.sheetDanger}`} onClick={onLogout}><Icon name="logout" size={20} />Salir</button>
          </div>
        </div>
      )}
    </div>
  )
}
