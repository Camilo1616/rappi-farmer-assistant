import { useAuth } from '../context/AuthContext'

export default function HomePage() {
  const { user } = useAuth()

  return (
    <div style={{ padding: 32, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>
        Hola{user?.nickname ? `, ${user.nickname}` : user?.fullName ? `, ${user.fullName}` : ''} 👋
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
        Este espacio está en reconstrucción para el nuevo alcance del equipo.
        Por ahora puedes usar WhatsApp (conexión y pruebas) y tu Perfil desde el menú.
      </p>
    </div>
  )
}
