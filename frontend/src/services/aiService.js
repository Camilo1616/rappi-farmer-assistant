import api from './api'

export const checkAiStatus = () => api.get('/ai/status')

export const generateWhatsappMessage = (storeName, ownerName, agingDays, situation, baseTemplate) =>
  api.post('/ai/whatsapp-message', { storeName, ownerName, agingDays, situation, baseTemplate })

export const generateDailySummary = (efectivas, noContacto, whatsappEnviados, tiendas, topPrioridades) =>
  api.post('/ai/daily-summary', { efectivas, noContacto, whatsappEnviados, tiendas, topPrioridades })
