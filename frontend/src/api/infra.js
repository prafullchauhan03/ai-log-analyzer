import api from './axios'

export const getInfraStatus  = ()            => api.get('/infra/status')
export const getElasticsearch = ()           => api.get('/infra/elasticsearch')
export const getESTimeSeries  = (minutes=60) => api.get(`/infra/elasticsearch/timeseries?minutes=${minutes}`)
export const getESIndices     = ()           => api.get('/infra/elasticsearch/indices')
export const getKafka         = ()           => api.get('/infra/kafka')
export const getKafkaLag      = ()           => api.get('/infra/kafka/lag')
export const getRedis         = ()           => api.get('/infra/redis')
export const getRedisSlowlog  = ()           => api.get('/infra/redis/slowlog')
