import express from 'express'
import pkg from 'whatsapp-web.js'
import QRCode from 'qrcode'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const { Client, LocalAuth } = pkg

const __dirname = dirname(fileURLToPath(import.meta.url))
const AUTH_DIR  = process.env.AUTH_DIR || join(__dirname, 'auth_info')
const PORT      = process.env.PORT || 3000
const API_KEY   = process.env.API_KEY || ''

if (!existsSync(AUTH_DIR)) mkdirSync(AUTH_DIR, { recursive: true })

// Estado global
let qrBase64  = null
let connected = false
let client    = null

function createClient() {
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
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
    console.log('[WA] QR generado')
    qrBase64  = await QRCode.toDataURL(qr)
    connected = false
  })

  client.on('ready', () => {
    console.log('[WA] Conectado y listo')
    connected = true
    qrBase64  = null
  })

  client.on('authenticated', () => {
    console.log('[WA] Autenticado')
  })

  client.on('auth_failure', (msg) => {
    console.error('[WA] Fallo de autenticación:', msg)
    connected = false
  })

  client.on('disconnected', (reason) => {
    console.log('[WA] Desconectado:', reason)
    connected = false
    qrBase64  = null
    // Reintentar en 10 segundos
    setTimeout(() => {
      console.log('[WA] Reiniciando cliente...')
      client.initialize().catch(e => console.error('[WA] Error al reiniciar:', e.message))
    }, 10000)
  })

  client.initialize().catch(e => console.error('[WA] Error al inicializar:', e.message))
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

app.get('/health', (req, res) => res.json({ ok: true }))

app.get('/status', (req, res) => {
  res.json({ connected, hasQr: !!qrBase64, qr: qrBase64 })
})

app.post('/send', async (req, res) => {
  const { phone, message } = req.body
  if (!phone || !message) return res.status(400).json({ error: 'phone y message son requeridos' })
  if (!connected || !client) return res.status(503).json({ error: 'WhatsApp no conectado' })

  try {
    const digits = phone.replace(/\D/g, '')
    const chatId = `${digits}@c.us`
    await client.sendMessage(chatId, message)
    console.log('[WA] Enviado a', phone)
    res.json({ result: 'ENVIADO', phone })
  } catch (err) {
    console.error('[WA] Error enviando a', phone, '—', err.message)
    const isInvalid = err.message?.includes('invalid') || err.message?.includes('not registered')
    res.json({ result: isInvalid ? 'NUMERO_INVALIDO' : 'ERROR', error: err.message })
  }
})

app.post('/reconnect', (req, res) => {
  connected = false
  qrBase64  = null
  client?.initialize().catch(() => {})
  res.json({ message: 'Reconectando...' })
})

app.listen(PORT, () => {
  console.log(`[WA] Servicio escuchando en puerto ${PORT}`)
  createClient()
})
