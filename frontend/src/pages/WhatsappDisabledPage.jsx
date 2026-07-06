/** Módulo de WhatsApp masivo — temporalmente desactivado. /dashboard/whatsapp */
export default function WhatsappDisabledPage() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)', padding: 40 }}>
      <span style={{ fontSize: 48 }}>🚫</span>
      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Módulo inhabilitado</p>
      <p style={{ fontSize: 13, margin: 0, textAlign: 'center', maxWidth: 300 }}>El módulo de WhatsApp masivo está temporalmente desactivado.</p>
    </div>
  )
}
