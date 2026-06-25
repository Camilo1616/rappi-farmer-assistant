import express from 'express'
import pkg from 'whatsapp-web.js'
import QRCode from 'qrcode'
import { existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'

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

/** Borra los archivos de sesión de LocalAuth para forzar QR fresco en el próximo init. */
function deleteSessionData(sessionId) {
  // whatsapp-web.js guarda en <AUTH_DIR>/<sessionId>/ y también en <AUTH_DIR>/session-<sessionId>/
  const paths = [
    join(AUTH_DIR, sessionId),
    join(AUTH_DIR, `session-${sessionId}`),
  ]
  for (const p of paths) {
    if (existsSync(p)) {
      try {
        rmSync(p, { recursive: true, force: true })
        console.log(`[WA:${sessionId}] Datos de sesión eliminados: ${p}`)
      } catch (e) {
        console.warn(`[WA:${sessionId}] No se pudo eliminar ${p}: ${e.message}`)
      }
    }
  }
}

const CHROMIUM_LOCKS = new Set(['SingletonLock', 'SingletonSocket', 'SingletonCookie'])

function deleteChromiumLocks(dir, sessionId) {
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (CHROMIUM_LOCKS.has(entry)) {
        try { rmSync(full); console.log(`[WA:${sessionId}] Lock eliminado: ${full}`) } catch {}
      } else {
        try { if (statSync(full).isDirectory()) deleteChromiumLocks(full, sessionId) } catch {}
      }
    }
  } catch {}
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

  // Eliminar locks de Chromium que quedan al morir el container — impide reinicio en nueva máquina
  // Buscar recursivamente porque whatsapp-web.js puede guardar el perfil en distintas rutas
  deleteChromiumLocks(AUTH_DIR, sessionId)

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
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-default-browser-check',
        '--safebrowsing-disable-auto-update',
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
    // Borrar sesión corrupta/revocada para que el próximo init muestre QR
    deleteSessionData(sessionId)
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

    // Si el usuario desvinculó el dispositivo desde WhatsApp o hubo conflicto de sesión,
    // los datos guardados en disco ya no son válidos — borrarlos para que el próximo
    // init genere un QR fresco en lugar de quedarse colgado intentando restaurar.
    const REVOKED_REASONS = ['LOGOUT', 'CONFLICT', 'UNLAUNCHED', 'UNPAIRED', 'UNPAIRED_IDLE']
    if (reason && REVOKED_REASONS.includes(reason.toString().toUpperCase())) {
      console.log(`[WA:${sessionId}] Sesión revocada (${reason}) — borrando datos de sesión para regenerar QR`)
      deleteSessionData(sessionId)
    }

    setTimeout(() => {
      if (sessions.has(sessionId)) {
        console.log(`[WA:${sessionId}] Reiniciando cliente tras desconexión (${reason})...`)
        initSession(sessionId)
      }
    }, 5000)
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
    // Verificar estado real del cliente antes de intentar enviar
    const state = await s.client.getState().catch(() => null)
    if (state !== 'CONNECTED') {
      console.warn(`[WA:${sessionId}] Estado del cliente: ${state} — marcando como desconectado`)
      s.connected = false
      return res.status(503).json({ error: `WhatsApp no conectado (estado: ${state})`, sessionId })
    }

    const chatId = await resolveWhatsappId(s.client, phone)
    if (!chatId) {
      console.log(`[WA:${sessionId}] Número no encontrado en WA:`, phone)
      return res.json({ result: 'NUMERO_INVALIDO', phone })
    }

    const msg = await s.client.sendMessage(chatId, message)
    // Esperar ACK de servidor (1 = enviado al servidor de WA, no solo encolado localmente)
    if (msg && msg.id) {
      console.log(`[WA:${sessionId}] Enviado a ${phone} → ${chatId} (id: ${msg.id._serialized})`)
    } else {
      console.warn(`[WA:${sessionId}] sendMessage no devolvió id — posible fallo silencioso`)
    }
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

// Cerrar sesión completamente y borrar datos — el próximo /status o /reconnect generará QR fresco
app.post('/logout', (req, res) => {
  const sessionId = resolveSession(req)
  forceReset(sessionId)
  deleteSessionData(sessionId)
  sessions.delete(sessionId)
  console.log(`[WA:${sessionId}] Logout manual — sesión y datos eliminados`)
  res.json({ message: `Sesión ${sessionId} cerrada y datos eliminados`, sessionId })
})

app.listen(PORT, () => {
  console.log(`[WA] Servicio multi-sesión escuchando en puerto ${PORT}`)
  restorePersistedSessions()

  // Watchdog: cada 5 minutos revisa sesiones desconectadas y las reinicia
  setInterval(() => {
    for (const [sessionId, s] of sessions.entries()) {
      if (!s.connected && !s.initializing) {
        console.log(`[WA:${sessionId}] Watchdog: sesión inactiva, reconectando...`)
        deleteChromiumLocks(AUTH_DIR, sessionId)
        initSession(sessionId)
      }
    }
  }, 5 * 60 * 1000)
})
