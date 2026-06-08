import api from './api'

export const getDailyReport     = () => api.get('/reports/daily')
export const getPortfolioReport = () => api.get('/reports/portfolio')
