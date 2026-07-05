import api from './api'

export const checkAiStatus = () => api.get('/ai/status')

export const generateWhatsappMessage = (storeName, agingDays, agingStage, segment, churnLabel, avaLabel, avaPct, currentStatus, baseTemplate) =>
  api.post('/ai/whatsapp-message', { storeName, agingDays, agingStage, segment, churnLabel, avaLabel, avaPct, currentStatus, baseTemplate })

export const generateDailySummary = (efectivas, noContacto, whatsappEnviados, tiendas, topPrioridades) =>
  api.post('/ai/daily-summary', { efectivas, noContacto, whatsappEnviados, tiendas, topPrioridades })

export const getAiRecommendations = () => api.get('/ai/recommend')
export const invalidateAiRecommendation = () => api.delete('/ai/recommend').catch(() => {})
