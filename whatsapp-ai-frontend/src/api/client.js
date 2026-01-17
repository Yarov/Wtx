import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 errors (redirect to login)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect if not already on login/register page
      const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register'
      if (!isAuthPage) {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const configApi = {
  getConfig: () => api.get('/config'),
  updateConfig: (data) => api.put('/config', data),
  getApiKeys: () => api.get('/config/api-keys'),
  updateApiKeys: (data) => api.put('/config/api-keys', data),
}

export const toolsApi = {
  getTools: () => api.get('/tools'),
  updateTool: (name, data) => api.put(`/tools/${name}`, data),
  toggleTool: (name, enabled) => api.patch(`/tools/${name}`, { enabled }),
  getAgentStatus: () => api.get('/config/agent-status'),
  setAgentStatus: (enabled) => api.put('/config/agent-status', { enabled }),
}

export const promptApi = {
  getPrompt: () => api.get('/prompt'),
  updatePrompt: (data) => api.put('/prompt', data),
  improvePrompt: (data) => api.post('/prompt/improve', data),
}

export const inventoryApi = {
  getProducts: () => api.get('/inventory'),
  createProduct: (data) => api.post('/inventory', data),
  updateProduct: (id, data) => api.put(`/inventory/${id}`, data),
  deleteProduct: (id) => api.delete(`/inventory/${id}`),
  uploadInventory: (formData) => api.post('/inventory/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  confirmImport: (data) => api.post('/inventory/import', data),
}

export const appointmentsApi = {
  getAppointments: () => api.get('/appointments'),
  updateStatus: (id, estado) => api.patch(`/appointments/${id}/status`, { estado }),
  deleteAppointment: (id) => api.delete(`/appointments/${id}`),
}

export const availabilityApi = {
  getAvailability: () => api.get('/availability'),
  updateAvailability: (id, data) => api.put(`/availability/${id}`, data),
  getBlockedSlots: () => api.get('/blocked-slots'),
  addBlockedSlot: (data) => api.post('/blocked-slots', data),
  deleteBlockedSlot: (id) => api.delete(`/blocked-slots/${id}`),
  getAvailableSlots: (fecha) => api.get(`/available-slots/${fecha}`),
}

export const conversationsApi = {
  getConversations: () => api.get('/conversations'),
  getConversation: (phone) => api.get(`/conversations/${phone}`),
  deleteConversation: (phone) => api.delete(`/conversations/${phone}`),
}

export const paymentsApi = {
  getPayments: () => api.get('/payments'),
  updateStatus: (id, estado) => api.patch(`/payments/${id}/status`, { estado }),
  getConfig: () => api.get('/config/payments'),
  updateConfig: (data) => api.put('/config/payments', data),
}

export const statsApi = {
  getDashboard: () => api.get('/stats'),
}

export default api
