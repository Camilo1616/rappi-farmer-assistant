import api from './api'

export const getDailyReport     = (date) => api.get('/reports/daily', { params: date ? { date } : {} })
export const getPortfolioReport = () => api.get('/reports/portfolio')
