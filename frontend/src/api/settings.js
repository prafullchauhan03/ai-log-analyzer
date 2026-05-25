import api from './axios'

export const getSettings   = ()     => api.get('/settings')
export const updateSettings= (data) => api.put('/settings', data)
export const resetSettings = ()     => api.post('/settings/reset')
export const testES        = ()     => api.post('/settings/test-es')
export const testKafka     = ()     => api.post('/settings/test-kafka')
export const testRedis     = ()     => api.post('/settings/test-redis')
