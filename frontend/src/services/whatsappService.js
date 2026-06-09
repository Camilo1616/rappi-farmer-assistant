import api from './api'

export const getWhatsappStatus  = () => api.get('/whatsapp/status')
export const getWhatsappQr      = () => api.get('/whatsapp/qr')
export const openChrome         = () => api.post('/whatsapp/open')
export const closeChrome        = () => api.post('/whatsapp/close')
export const waitConnection     = (timeout = 60) => api.get(`/whatsapp/wait-connection?timeout=${timeout}`)
export const sendTest           = (phone, message) => api.post('/whatsapp/test', { phone, message })
export const getMsgTemplates    = () => api.get('/whatsapp/templates')
export const getWaSentToday    = () => api.get('/whatsapp/sent-today')

// SSE — devuelve un EventSource que el caller debe cerrar
export const sendMasivo = (storeIds, template, onProgress, onDone, onError) => {
  const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api'
  fetch(`${BASE}/whatsapp/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify({ storeIds, template }),
  }).then(async res => {
    const reader = res.body.getReader()
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
            onProgress(data)
            if (data.finalizado) { onDone(data); return }
          } catch {}
        }
      }
    }
  }).catch(onError)
}
