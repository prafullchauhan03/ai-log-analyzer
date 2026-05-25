import api from './axios'

export const getAIStatus      = ()       => api.get('/ai/status')
export const runAnalysis      = ()       => api.post('/ai/analysis')
export const runAnomalies     = ()       => api.post('/ai/anomalies')
export const runAlertSummary  = ()       => api.post('/ai/alert-summary')
export const runForecast      = ()       => api.post('/ai/forecast')
export const sendChat         = (question, history) =>
  api.post('/ai/chat', { question, history })
