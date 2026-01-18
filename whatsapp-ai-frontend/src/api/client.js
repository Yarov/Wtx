import axios from 'axios'
import { API_BASE_URL } from '../config'

const api = axios.create({
  baseURL: API_BASE_URL,
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
  getHumanModeConfig: () => api.get('/config/human-mode'),
  updateHumanModeConfig: (data) => api.put('/config/human-mode', data),
}

export const whatsappApi = {
  getConfig: () => api.get('/config/whatsapp'),
  updateConfig: (data) => api.put('/config/whatsapp', data),
  testConnection: () => api.post('/config/whatsapp/test'),
}

export const contactosApi = {
  list: (params = {}) => api.get('/contactos', { params }),
  get: (id) => api.get(`/contactos/${id}`),
  create: (data) => api.post('/contactos', data),
  update: (id, data) => api.put(`/contactos/${id}`, data),
  delete: (id) => api.delete(`/contactos/${id}`),
  deleteAll: () => api.delete('/contactos/all', { data: { confirm: true } }),
  sync: () => api.post('/contactos/sync'),
  verificar: () => api.post('/contactos/verificar'),
  importar: (data) => api.post('/contactos/importar', data),
  // Modo Humano
  listModoHumano: () => api.get('/contactos/modo-humano'),
  activarModoHumano: (id, razon) => api.post(`/contactos/${id}/modo-humano`, { razon }),
  desactivarModoHumano: (id) => api.delete(`/contactos/${id}/modo-humano`),
  limpiarDuplicados: () => api.post('/contactos/limpiar-duplicados'),
  verificarActivos: () => api.post('/contactos/verificar-activos'),
  verificarActivosEstado: () => api.get('/contactos/verificar-activos/estado'),
  stats: () => api.get('/contactos/stats'),
  exportCsv: () => api.get('/contactos/export/csv', { responseType: 'blob' }),
}

export const businessApi = {
  getConfig: () => api.get('/business/config'),
  updateConfig: (data) => api.put('/business/config', data),
  getModules: () => api.get('/business/modules'),
  setupChat: (data) => api.post('/business/setup-chat', data),
  setupApply: (data) => api.post('/business/setup-apply', data),
  getOnboardingStatus: () => api.get('/business/onboarding-status'),
  skipOnboarding: () => api.post('/business/skip-onboarding'),
  restartOnboarding: () => api.post('/business/restart-onboarding'),
}

export const jobsApi = {
  list: (params = {}) => api.get('/jobs', { params }),
  get: (id) => api.get(`/jobs/${id}`),
  getActivo: (tipo) => api.get(`/jobs/tipo/${tipo}/activo`),
  getUltimo: (tipo) => api.get(`/jobs/tipo/${tipo}/ultimo`),
  cancelar: (id) => api.delete(`/jobs/${id}`),
}

export const campanasApi = {
  list: (params = {}) => api.get('/campanas', { params }),
  get: (id) => api.get(`/campanas/${id}`),
  create: (data) => api.post('/campanas', data),
  update: (id, data) => api.put(`/campanas/${id}`, data),
  delete: (id) => api.delete(`/campanas/${id}`),
  iniciar: (id) => api.post(`/campanas/${id}/iniciar`),
  pausar: (id) => api.post(`/campanas/${id}/pausar`),
  reanudar: (id) => api.post(`/campanas/${id}/reanudar`),
  cancelar: (id) => api.post(`/campanas/${id}/cancelar`),
  destinatarios: (id, params = {}) => api.get(`/campanas/${id}/destinatarios`, { params }),
  preview: (id) => api.post(`/campanas/${id}/preview`),
  enviarPrueba: (data) => api.post('/campanas/enviar-prueba', data),
  mejorarMensaje: (data) => api.post('/campanas/mejorar-mensaje', data),
  stats: () => api.get('/campanas/stats'),
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

export const statsApi = {
  getDashboard: () => api.get('/stats'),
}

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getActivity: (limit = 20) => api.get('/dashboard/activity', { params: { limit } }),
  getAlerts: () => api.get('/dashboard/alerts'),
  getInsights: () => api.get('/dashboard/insights'),
}

export default api
