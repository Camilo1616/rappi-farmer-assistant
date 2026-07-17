/** Colores/formato del temporizador de SLA — compartido entre la tabla y el modal de tarea. */

/** Milisegundos restantes hasta fechaLimite (negativo si ya venció); null si no hay fecha límite. */
export function remainingMs(fechaLimite, now = Date.now()) {
  if (!fechaLimite) return null
  const t = new Date(fechaLimite).getTime()
  if (Number.isNaN(t)) return null
  return t - now
}

export function slaColor(ms) {
  if (ms == null) return '#94A3B8'
  if (ms <= 0) return '#EF4444'
  const hours = ms / 3_600_000
  if (hours <= 4) return '#EF4444'
  if (hours <= 24) return '#F59E0B'
  return '#22C55E'
}

function pad(n) { return String(n).padStart(2, '0') }

/** Countdown regresivo con segundos: "2d 05:12:33", "05:12:33", "Vencido hace 00:03:10"... */
export function formatCountdown(ms) {
  if (ms == null) return 'Sin SLA'
  const vencido = ms <= 0
  const abs = Math.abs(ms)
  const secs = Math.floor(abs / 1000)
  const mins = Math.floor(secs / 60)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  const reloj = `${pad(hours % 24)}:${pad(mins % 60)}:${pad(secs % 60)}`
  const texto = days > 0 ? `${days}d ${reloj}` : reloj
  return vencido ? `Vencido hace ${texto}` : texto
}
