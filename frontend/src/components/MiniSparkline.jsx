/**
 * Sparkline miniatura SVG de 3 puntos: L4W → L7D → MTD
 * Muestra tendencia: sube (verde), baja (rojo), estable (gris)
 */
export default function MiniSparkline({ l4w, l7d, mtd }) {
  // MTD = base mensual → L4W = 4 semanas → L7D = más reciente
  const points = [mtd, l4w, l7d].map(v => (v != null ? parseFloat(v) : null))
  const valid = points.filter(v => v != null)
  if (valid.length < 2) return null

  const W = 48, H = 18, PAD = 2
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const range = max - min || 1

  const toY = v => PAD + ((H - PAD * 2) * (1 - (v - min) / range))
  const toX = i => PAD + ((W - PAD * 2) / (points.length - 1)) * i

  // Solo usar puntos no nulos
  const coords = points
    .map((v, i) => v != null ? { x: toX(i), y: toY(v), v } : null)
    .filter(Boolean)

  const polyline = coords.map(c => `${c.x},${c.y}`).join(' ')

  const first = coords[0].v
  const last  = coords[coords.length - 1].v
  const diff  = last - first
  const color = diff > 2 ? '#22C55E' : diff < -2 ? '#EF4444' : '#94A3B8'

  const Arrow = () => {
    if (diff > 2)  return <span style={{ color: '#22C55E', fontSize: 10, marginLeft: 2 }}>▲</span>
    if (diff < -2) return <span style={{ color: '#EF4444', fontSize: 10, marginLeft: 2 }}>▼</span>
    return <span style={{ color: '#94A3B8', fontSize: 10, marginLeft: 2 }}>—</span>
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', marginLeft: 4 }}>
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        <polyline
          points={polyline}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="2" fill={color} />
        ))}
      </svg>
      <Arrow />
    </span>
  )
}
