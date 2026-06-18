import api from './api'
import progressStore from './whatsappProgressStore'

export const getWhatsappStatus  = () => api.get('/whatsapp/status')
export const getWhatsappQr      = () => api.get('/whatsapp/qr')
export const openChrome         = () => api.post('/whatsapp/open')
export const closeChrome        = () => api.post('/whatsapp/close')
export const waitConnection     = (timeout = 60) => api.get(`/whatsapp/wait-connection?timeout=${timeout}`)
export const sendTest           = (phone, message) => api.post('/whatsapp/test', { phone, message })
export const getMsgTemplates    = () => api.get('/whatsapp/templates')
export const getWaSentToday    = () => api.get('/whatsapp/sent-today')
export const getWaHistory      = (days = 30) => api.get(`/whatsapp/history?days=${days}`)

// Lee el stream SSE y notifica tanto al caller como al store global
async function readSseStream(response, onProgress, onDone, onError) {
  try {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (line.startsWith('data:')) {
          try {
            const data = JSON.parse(line.slice(5).trim())
            progressStore.update({ sending: !data.finalizado, progress: data })
            onProgress(data)
            if (data.finalizado) {
              progressStore.update({ sending: false, progress: data })
              onDone(data)
              return
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    progressStore.update({ sending: false })
    onError(err)
  }
}

// SSE con mensajes personalizados por tienda [{storeId, message}]
export const sendPersonalized = (storeMessages, onProgress, onDone, onError) => {
  const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api'
  progressStore.update({ sending: true })
  fetch(`${BASE}/whatsapp/send-personalized`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify({ storeMessages }),
  }).then(res => readSseStream(res, onProgress, onDone, onError))
    .catch(err => { progressStore.update({ sending: false }); onError(err) })
}

// SSE — envío masivo con template único
export const sendMasivo = (storeIds, template, onProgress, onDone, onError) => {
  const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api'
  progressStore.update({ sending: true })
  fetch(`${BASE}/whatsapp/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify({ storeIds, template }),
  }).then(res => readSseStream(res, onProgress, onDone, onError))
    .catch(err => { progressStore.update({ sending: false }); onError(err) })
}
