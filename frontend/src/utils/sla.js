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

/** "Vencido hace 3h", "en 2d 5h", "en 45m"... */
export function formatCountdown(ms) {
  if (ms == null) return 'Sin SLA'
  const vencido = ms <= 0
  const abs = Math.abs(ms)
  const mins = Math.floor(abs / 60_000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  let texto
  if (days > 0) texto = `${days}d ${hours % 24}h`
  else if (hours > 0) texto = `${hours}h ${mins % 60}m`
  else texto = `${mins}m`
  return vencido ? `Vencido hace ${texto}` : `en ${texto}`
}
