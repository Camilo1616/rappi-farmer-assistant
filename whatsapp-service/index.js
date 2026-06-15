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

if (!existsSync(AUTH_DIR)) mkdirSync(AUTH_DIR, { recursive: true })

// ── Sesiones múltiples (una por farmer) ──────────────────────────────────────
// sessionId: string como "u42" (prefijo + userId del backend)
// Cada sesión tiene su propio cliente whatsapp-web.js, QR y estado de conexión.

const sessions = new Map()  // sessionId -> { client, qrBase64, connected, initializing }

// Restaurar sesiones guardadas en disco al arrancar
function restorePersistedSessions() {
  if (!existsSync(AUTH_DIR)) return
  try {
    const entries = readdirSync(AUTH_DIR)
    for (const entry of entries) {
      const full = join(AUTH_DIR, entry)
      if (statSync(full).isDirectory() && !sessions.has(entry)) {
        console.log(`[WA] Restaurando sesión guardada: ${entry}`)
        sessions.set(entry, { client: null, qrBase64: null, connected: false, initializing: false })
        initSession(entry)
      }
    }
  } catch (e) {
    console.error('[WA] Error al restaurar sesiones:', e.message)
  }
}

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { client: null, qrBase64: null, connected: false, initializing: false })
    initSession(sessionId)
  }
  return sessions.get(sessionId)
}

function initSession(sessionId) {
  const s = sessions.get(sessionId)
  if (s.initializing || s.connected) return
  s.initializing = true
  s.client = null  // asegura instancia fresca

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
  })

  client.on('ready', () => {
    console.log(`[WA:${sessionId}] Conectado y listo`)
    s.connected    = true
    s.qrBase64     = null
    s.initializing = false
  })

  client.on('authenticated', () => {
    console.log(`[WA:${sessionId}] Autenticado`)
  })

  client.on('auth_failure', (msg) => {
    console.error(`[WA:${sessionId}] Fallo de autenticación:`, msg)
    s.connected    = false
    s.initializing = false
  })

  client.on('disconnected', (reason) => {
    console.log(`[WA:${sessionId}] Desconectado:`, reason)
    s.connected    = false
    s.qrBase64     = null
    s.initializing = false
    s.client       = null
    // Reiniciar con un cliente nuevo en 10 segundos
    setTimeout(() => {
      if (sessions.has(sessionId)) {
        console.log(`[WA:${sessionId}] Reiniciando cliente tras desconexión...`)
        initSession(sessionId)
      }
    }, 10000)
  })

  client.initialize().catch(e => {
    console.error(`[WA:${sessionId}] Error al inicializar:`, e.message)
    s.initializing = false
  })

  s.client = client
}

// ── Express ───────────────────────────────────────────────────────────────────

const app = express()
app.use(express.json())

// Middleware de autenticación por API key
app.use((req, res, next) => {
  if (!API_KEY) return next()
  const key = req.headers['x-api-key'] || req.query.apiKey
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' })
  next()
})

// Extrae el sessionId del query string o usa "default"
function resolveSession(req) {
  return (req.query.session || req.body?.session || 'default').replace(/[^a-zA-Z0-9_-]/g, '_')
}

app.get('/health', (req, res) => res.json({ ok: true }))

// Lista todas las sesiones activas (para debugging del backend)
app.get('/sessions', (req, res) => {
  const list = [...sessions.entries()].map(([id, s]) => ({
    id,
    connected:    s.connected,
    hasQr:        !!s.qrBase64,
    initializing: s.initializing,
  }))
  res.json(list)
})

// Estado de la sesión del farmer
app.get('/status', (req, res) => {
  const sessionId = resolveSession(req)
  const s = getSession(sessionId)
  res.json({ connected: s.connected, hasQr: !!s.qrBase64, qr: s.qrBase64, sessionId })
})

// Enviar mensaje en nombre del farmer
app.post('/send', async (req, res) => {
  const { phone, message } = req.body
  const sessionId = resolveSession(req)

  if (!phone || !message) return res.status(400).json({ error: 'phone y message son requeridos' })

  const s = sessions.get(sessionId)
  if (!s || !s.connected || !s.client) {
    return res.status(503).json({ error: 'WhatsApp no conectado para esta sesión', sessionId })
  }

  try {
    const digits = phone.replace(/\D/g, '')
    const chatId = `${digits}@c.us`
    await s.client.sendMessage(chatId, message)
    console.log(`[WA:${sessionId}] Enviado a`, phone)
    res.json({ result: 'ENVIADO', phone })
  } catch (err) {
    console.error(`[WA:${sessionId}] Error enviando a`, phone, '—', err.message)
    const isInvalid = err.message?.includes('invalid') || err.message?.includes('not registered')
    res.json({ result: isInvalid ? 'NUMERO_INVALIDO' : 'ERROR', error: err.message })
  }
})

// Forzar reconexión para una sesión específica
app.post('/reconnect', (req, res) => {
  const sessionId = resolveSession(req)
  if (sessions.has(sessionId)) {
    const s = sessions.get(sessionId)
    s.connected    = false
    s.qrBase64     = null
    s.initializing = false
    s.client?.initialize().catch(() => {})
  } else {
    getSession(sessionId)  // crea e inicializa
  }
  res.json({ message: `Reconectando sesión ${sessionId}...`, sessionId })
})

app.listen(PORT, () => {
  console.log(`[WA] Servicio multi-sesión escuchando en puerto ${PORT}`)
  // Restaurar sesiones guardadas para que reconecten sin pedir QR
  restorePersistedSessions()
})
