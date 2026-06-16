import express from 'express'
import pkg from 'whatsapp-web.js'
import QRCode from 'qrcode'
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const { Client, LocalAuth } = pkg

const __dirname = dirname(fileURLToPath(import.meta.url))
const AUTH_DIR  = process.env.AUTH_DIR || join(__dirname, 'auth_info')
const PORT      = process.env.PORT || 3000
const API_KEY   = process.env.API_KEY || ''

// Timeout máximo para que un cliente se inicialice antes de forzar reset
const INIT_TIMEOUT_MS = 120_000

if (!existsSync(AUTH_DIR)) mkdirSync(AUTH_DIR, { recursive: true })

const sessions = new Map()  // sessionId -> { client, qrBase64, connected, initializing, initStartedAt }

const VALID_SESSION_RE = /^u\d+$/  // solo "u" seguido de dígitos

function restorePersistedSessions() {
  if (!existsSync(AUTH_DIR)) return
  try {
    const entries = readdirSync(AUTH_DIR)
    for (const entry of entries) {
      if (!VALID_SESSION_RE.test(entry)) {
        console.log(`[WA] Ignorando carpeta del sistema: ${entry}`)
        continue
      }
      const full = join(AUTH_DIR, entry)
      if (statSync(full).isDirectory() && !sessions.has(entry)) {
        console.log(`[WA] Restaurando sesión guardada: ${entry}`)
        sessions.set(entry, { client: null, qrBase64: null, connected: false, initializing: false, initStartedAt: null })
        initSession(entry)
      }
    }
  } catch (e) {
    console.error('[WA] Error al restaurar sesiones:', e.message)
  }
}

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { client: null, qrBase64: null, connected: false, initializing: false, initStartedAt: null })
    initSession(sessionId)
  }
  return sessions.get(sessionId)
}

function forceReset(sessionId) {
  const s = sessions.get(sessionId)
  if (!s) return
  try { s.client?.destroy().catch(() => {}) } catch {}
  s.client        = null
  s.qrBase64      = null
  s.connected     = false
  s.initializing  = false
  s.initStartedAt = null
}

function initSession(sessionId) {
  const s = sessions.get(sessionId)
  if (!s) return

  // Si ya está inicializando, verificar si el timeout expiró
  if (s.initializing) {
    const elapsed = s.initStartedAt ? Date.now() - s.initStartedAt : INIT_TIMEOUT_MS + 1
    if (elapsed < INIT_TIMEOUT_MS) {
      console.log(`[WA:${sessionId}] Ya inicializando (${Math.round(elapsed/1000)}s), esperando...`)
      return
    }
    console.warn(`[WA:${sessionId}] Timeout de inicialización (${INIT_TIMEOUT_MS/1000}s), forzando reset`)
    forceReset(sessionId)
  }

  if (s.connected) return

  s.initializing  = true
  s.initStartedAt = Date.now()
  s.client        = null

  const sessionDir = join(AUTH_DIR, sessionId)
  if (!existsSync(sessionDir)) mkdirSync(sessionDir, { recursive: true })

  console.log(`[WA:${sessionId}] Iniciando sesión...`)

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: sessionId, dataPath: AUTH_DIR }),
    puppeteer: {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
      ],
    },
  })

  client.on('qr', async (qr) => {
    console.log(`[WA:${sessionId}] QR generado`)
    s.qrBase64  = await QRCode.toDataURL(qr)
    s.connected = false
    s.initStartedAt = Date.now() // resetear el timeout al recibir QR nuevo
  })

  client.on('ready', () => {
    console.log(`[WA:${sessionId}] Conectado y listo`)
    s.connected    = true
    s.qrBase64     = null
    s.initializing = false
    s.initStartedAt = null
  })

  client.on('authenticated', () => {
    console.log(`[WA:${sessionId}] Autenticado`)
  })

  client.on('auth_failure', (msg) => {
    console.error(`[WA:${sessionId}] Fallo de autenticación:`, msg)
    s.connected    = false
    s.initializing = false
    s.initStartedAt = null
    // Reintentar tras 5 segundos
    setTimeout(() => {
      if (sessions.has(sessionId) && !sessions.get(sessionId).connected) {
        console.log(`[WA:${sessionId}] Reintentando tras auth_failure...`)
        forceReset(sessionId)
        initSession(sessionId)
      }
    }, 5000)
  })

  client.on('disconnected', (reason) => {
    console.log(`[WA:${sessionId}] Desconectado:`, reason)
    s.connected    = false
    s.qrBase64     = null
    s.initializing = false
    s.initStartedAt = null
    s.client       = null
    setTimeout(() => {
      if (sessions.has(sessionId)) {
        console.log(`[WA:${sessionId}] Reiniciando cliente tras desconexión...`)
        initSession(sessionId)
      }
    }, 10000)
  })

  client.initialize().catch(e => {
    console.error(`[WA:${sessionId}] Error al inicializar:`, e.message)
    s.initializing  = false
    s.initStartedAt = null
  })

  s.client = client
}

// Prefijos de países donde opera Rappi (en orden de probabilidad)
const COUNTRY_PREFIXES = ['57', '52', '51', '55', '54', '56', '593', '595', '598', '591', '502', '503', '504', '505', '506', '507']

/**
 * Resuelve el chatId de WhatsApp para un número de teléfono.
 * Prueba el número tal como viene (si ya tiene código de país),
 * luego intenta con cada prefijo de país hasta encontrar uno registrado.
 */
async function resolveWhatsappId(client, phone) {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null

  // Si el número ya tiene suficientes dígitos para incluir código de país (>= 10)
  // intentar primero tal como está
  const candidates = []

  // El número como viene (puede ya tener prefijo)
  candidates.push(digits)

  // Si tiene 9 o 10 dígitos (sin prefijo), agregar variantes con cada país
  if (digits.length <= 10) {
    for (const prefix of COUNTRY_PREFIXES) {
      candidates.push(prefix + digits)
    }
  } else {
    // También probar sin el primer dígito por si tiene un 0 al inicio
    if (digits.startsWith('0')) candidates.push(digits.slice(1))
  }

  for (const candidate of candidates) {
    try {
      const numberId = await client.getNumberId(candidate)
      if (numberId) return numberId._serialized
    } catch {}
  }
  return null
}

// ── Express ───────────────────────────────────────────────────────────────────

const app = express()
app.use(express.json())

app.use((req, res, next) => {
  if (!API_KEY) return next()
  const key = req.headers['x-api-key'] || req.query.apiKey
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' })
  next()
})

function resolveSession(req) {
  return (req.query.session || req.body?.session || 'default').replace(/[^a-zA-Z0-9_-]/g, '_')
}

app.get('/health', (req, res) => res.json({ ok: true }))

app.get('/sessions', (req, res) => {
  const list = [...sessions.entries()].map(([id, s]) => ({
    id,
    connected:    s.connected,
    hasQr:        !!s.qrBase64,
    initializing: s.initializing,
    initElapsedSec: s.initStartedAt ? Math.round((Date.now() - s.initStartedAt) / 1000) : null,
  }))
  res.json(list)
})

app.get('/status', (req, res) => {
  const sessionId = resolveSession(req)
  const s = getSession(sessionId)
  res.json({ connected: s.connected, hasQr: !!s.qrBase64, qr: s.qrBase64, sessionId, initializing: s.initializing })
})

app.post('/send', async (req, res) => {
  const { phone, message } = req.body
  const sessionId = resolveSession(req)

  if (!phone || !message) return res.status(400).json({ error: 'phone y message son requeridos' })

  const s = sessions.get(sessionId)
  if (!s || !s.connected || !s.client) {
    return res.status(503).json({ error: 'WhatsApp no conectado para esta sesión', sessionId })
  }

  try {
    const chatId = await resolveWhatsappId(s.client, phone)
    if (!chatId) {
      console.log(`[WA:${sessionId}] Número no encontrado en WA:`, phone)
      return res.json({ result: 'NUMERO_INVALIDO', phone })
    }
    await s.client.sendMessage(chatId, message)
    console.log(`[WA:${sessionId}] Enviado a`, phone, '→', chatId)
    res.json({ result: 'ENVIADO', phone })
  } catch (err) {
    console.error(`[WA:${sessionId}] Error enviando a`, phone, '—', err.message)
    const isInvalid = err.message?.includes('invalid') || err.message?.includes('not registered')
    res.json({ result: isInvalid ? 'NUMERO_INVALIDO' : 'ERROR', error: err.message })
  }
})

// Forzar reconexión — siempre destruye el cliente viejo y crea uno nuevo
app.post('/reconnect', (req, res) => {
  const sessionId = resolveSession(req)
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { client: null, qrBase64: null, connected: false, initializing: false, initStartedAt: null })
  }
  forceReset(sessionId)
  initSession(sessionId)
  res.json({ message: `Reconectando sesión ${sessionId}...`, sessionId })
})

app.listen(PORT, () => {
  console.log(`[WA] Servicio multi-sesión escuchando en puerto ${PORT}`)
  restorePersistedSessions()
})
