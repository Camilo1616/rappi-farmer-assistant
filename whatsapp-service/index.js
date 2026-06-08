import express from 'express'
import { createWriteStream, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  jidNormalizedUser,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import QRCode from 'qrcode'

const __dirname = dirname(fileURLToPath(import.meta.url))
const AUTH_DIR  = process.env.AUTH_DIR || join(__dirname, 'auth_info')
const PORT      = process.env.PORT || 3000
const API_KEY   = process.env.API_KEY || ''

const logger = pino({ level: 'silent' })

// Estado global
let sock        = null
let qrBase64    = null
let connected   = false
let connecting  = false
let reconnectAttempts = 0
const MAX_RECONNECT = 5

if (!existsSync(AUTH_DIR)) mkdirSync(AUTH_DIR, { recursive: true })

// ── Conexión Baileys ──────────────────────────────────────────────────────────

async function connect() {
  if (connecting) return
  connecting = true

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: true,
    browser: ['Rappi Farmer', 'Chrome', '1.0'],
    connectTimeoutMs: 60_000,
    keepAliveIntervalMs: 25_000,
    retryRequestDelayMs: 2000,
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      qrBase64 = await QRCode.toDataURL(qr)
      connected = false
      console.log('[WA] QR generado — escanea con WhatsApp')
    }

    if (connection === 'open') {
      qrBase64   = null
      connected  = true
      connecting = false
      reconnectAttempts = 0
      console.log('[WA] Conectado')
    }

    if (connection === 'close') {
      connected  = false
      connecting = false
      const code = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = code !== DisconnectReason.loggedOut

      console.log('[WA] Desconectado — código:', code, '— reconectar:', shouldReconnect)

      if (shouldReconnect && reconnectAttempts < MAX_RECONNECT) {
        reconnectAttempts++
        const delay = Math.min(5000 * reconnectAttempts, 30000)
        console.log(`[WA] Reintentando en ${delay / 1000}s (intento ${reconnectAttempts})`)
        setTimeout(connect, delay)
      } else if (code === DisconnectReason.loggedOut) {
        qrBase64 = null
        console.log('[WA] Sesión cerrada — escanea el QR de nuevo')
        setTimeout(connect, 3000)
      }
    }
  })

  connecting = false
}

// ── Normalizar número de teléfono ─────────────────────────────────────────────

function normalizePhone(phone) {
  // Elimina todo excepto dígitos
  const digits = phone.replace(/\D/g, '')
  return `${digits}@s.whatsapp.net`
}

// ── Middleware auth ───────────────────────────────────────────────────────────

const app = express()
app.use(express.json())

app.use((req, res, next) => {
  if (!API_KEY) return next()
  const key = req.headers['x-api-key'] || req.query.apiKey
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' })
  next()
})

// ── Endpoints ─────────────────────────────────────────────────────────────────

// Estado y QR
app.get('/status', (req, res) => {
  res.json({
    connected,
    hasQr: !!qrBase64,
    qr: qrBase64,
  })
})

// Enviar un mensaje
app.post('/send', async (req, res) => {
  const { phone, message } = req.body
  if (!phone || !message) return res.status(400).json({ error: 'phone y message son requeridos' })
  if (!connected || !sock) return res.status(503).json({ error: 'WhatsApp no conectado' })

  try {
    const jid = normalizePhone(phone)
    await sock.sendMessage(jid, { text: message })
    res.json({ result: 'ENVIADO', phone })
  } catch (err) {
    console.error('[WA] Error enviando a', phone, '—', err.message)
    // Número inválido si el error indica que no existe
    const isInvalid = err.message?.includes('not-authorized') ||
                      err.message?.includes('not on whatsapp') ||
                      err.message?.includes('invalid')
    res.status(200).json({ result: isInvalid ? 'NUMERO_INVALIDO' : 'ERROR', error: err.message })
  }
})

// Desconectar (logout)
app.post('/disconnect', async (req, res) => {
  if (sock) {
    await sock.logout().catch(() => {})
    sock = null
  }
  connected = false
  qrBase64  = null
  res.json({ message: 'Desconectado' })
})

// Reconectar manualmente
app.post('/reconnect', async (req, res) => {
  if (sock) {
    await sock.end().catch(() => {})
    sock = null
  }
  connected  = false
  connecting = false
  reconnectAttempts = 0
  connect()
  res.json({ message: 'Reconectando...' })
})

// Health check
app.get('/health', (req, res) => res.json({ ok: true }))

// ── Arranque ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[WA] Servicio escuchando en puerto ${PORT}`)
  connect()
})
