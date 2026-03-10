import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
})

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.error || err.message || 'Request failed'
    return Promise.reject(new Error(message))
  }
)

export const tokenApi = {
  getFeed: (params) => api.get('/tokens/feed', { params }),
  getToken: (mint) => api.get(`/tokens/${mint}`),
  getShareCardData: (mint) => api.get(`/tokens/${mint}/share-card-data`),
}

export const analysisApi = {
  analyze: (mint, tokenData) => api.post(`/analysis/${mint}`, tokenData ? { tokenData } : {}),
  chat: (mint, messages, tokenContext) =>
    api.post(`/analysis/${mint}/chat`, { messages, tokenContext }),
}

export const creatorsApi = {
  getProfile: (handle, hint) => api.get(`/creators/${handle}`, hint ? { params: { hint } } : undefined),
}

export const watchlistApi = {
  get: () => api.get('/watchlist'),
  add: (item) => api.post('/watchlist', item),
}

export const alertsApi = {
  subscribe: (data) => api.post('/alerts/subscribe', data),
}

export const skillApi = {
  generate: (prefs) => api.post('/skill/generate', prefs),
}

export const leaderboardApi = {
  get: (params) => api.get('/leaderboard', { params }),
}

export default api
