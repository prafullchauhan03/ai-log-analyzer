import api from './axios'

export const getAlerts     = (params) => api.get('/alerts',          { params })
export const getAlertSummary = ()     => api.get('/alerts/summary')
export const runDetection  = ()       => api.post('/alerts/detect')
export const getAlert      = (id)     => api.get(`/alerts/${id}`)
export const acknowledgeAlert = (id)  => api.patch(`/alerts/${id}/acknowledge`)
export const resolveAlert  = (id)     => api.patch(`/alerts/${id}/resolve`)
export const deleteAlert   = (id)     => api.delete(`/alerts/${id}`)
