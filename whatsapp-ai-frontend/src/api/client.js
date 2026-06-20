import axios from 'axios'
import { API_BASE_URL } from '../config'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token + active profile to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const perfilId = localStorage.getItem('perfil_id')
  if (perfilId) {
    config.headers['X-Perfil-ID'] = perfilId
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
  getApiKeys: () => api.get('/config/api-keys'),
  updateApiKeys: (data) => api.put('/config/api-keys', data),
  getHumanModeConfig: () => api.get('/config/human-mode'),
  updateHumanModeConfig: (data) => api.put('/config/human-mode', data),
  testChat: (mensaje, reset = false) => api.post('/config/test-chat', { mensaje, reset }),
  agentHealth: () => api.get('/config/agent-health'),
  getSkillsStatus: () => api.get('/config/skills-status'),
}

export const whatsappApi = {
  // Endpoints simplificados - el usuario solo ve QR/código y estado
  // connect() sin args => QR (comportamiento por defecto).
  // connect({ method: 'code', phone }) => código de emparejamiento por teléfono.
  connect: (opts) =>
    opts
      ? api.post('/whatsapp/connect', { method: opts.method, phone: opts.phone })
      : api.post('/whatsapp/connect'),
  getStatus: () => api.get('/whatsapp/status'),
  disconnect: () => api.post('/whatsapp/disconnect'),
}

export const contactosApi = {
  list: (params = {}) => api.get('/contactos', { params }),
  get: (id) => api.get(`/contactos/${id}`),
  create: (data) => api.post('/contactos', data),
  update: (id, data) => api.put(`/contactos/${id}`, data),
  delete: (id) => api.delete(`/contactos/${id}`),
  deleteAll: () => api.delete('/contactos/all', { data: { confirm: true } }),
  sync: () => api.post('/contactos/sync'),
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
  factoryReset: (data = {}) => api.post('/business/factory-reset', data),
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
  previewDestinatarios: (data) => api.post('/campanas/preview-destinatarios', data),
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
  getPrompt: () => api.get('/config/prompt'),
  updatePrompt: (data) => api.put('/config/prompt', data),
  improvePrompt: (data) => api.post('/config/prompt/improve', data),
}

export const conversationsApi = {
  getConversations: () => api.get('/conversations'),
  getConversation: (phone, params = {}) => api.get(`/conversations/${phone}`, { params }),
  deleteConversation: (phone) => api.delete(`/conversations/${phone}`),
  sendMessage: (phone, message, opts = {}) => api.post(`/conversations/${phone}/send`, {
    message,
    ...(opts.quoted_wa_id ? {
      quoted_wa_id: opts.quoted_wa_id,
      quoted_body: opts.quoted_body,
      quoted_from_me: opts.quoted_from_me,
    } : {}),
  }),
  sendImage: (phone, file, { caption, viewOnce, quoted_wa_id, quoted_body, quoted_from_me } = {}) => {
    const form = new FormData()
    form.append('file', file)
    if (caption) form.append('caption', caption)
    form.append('view_once', viewOnce ? 'true' : 'false')
    if (quoted_wa_id) {
      form.append('quoted_wa_id', quoted_wa_id)
      if (quoted_body != null) form.append('quoted_body', quoted_body)
      form.append('quoted_from_me', quoted_from_me ? 'true' : 'false')
    }
    return api.post(`/conversations/${phone}/send-image`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  markAsRead: (phone) => api.post(`/conversations/${phone}/read`),
}

export const conocimientoApi = {
  list: () => api.get('/conocimiento'),
  get: (id) => api.get(`/conocimiento/${id}`),
  create: (data) => api.post('/conocimiento', data),
  update: (id, data) => api.put(`/conocimiento/${id}`, data),
  delete: (id) => api.delete(`/conocimiento/${id}`),
  stats: () => api.get('/conocimiento/stats'),
  categories: () => api.get('/conocimiento/categories'),
  search: (q) => api.get('/conocimiento/search', { params: { q } }),
  sync: () => api.post('/conocimiento/sync'),
}

export const funnelApi = {
  getSteps: () => api.get('/funnel/steps'),
  getStep: (id) => api.get(`/funnel/steps/${id}`),
  createStep: (data) => api.post('/funnel/steps', data),
  updateStep: (id, data) => api.put(`/funnel/steps/${id}`, data),
  deleteStep: (id) => api.delete(`/funnel/steps/${id}`),
  advanceContact: (telefono) => api.post(`/funnel/contacts/${telefono}/advance`),
  setContactStep: (telefono, stepName) => api.put(`/funnel/contacts/${telefono}/step`, null, { params: { step_name: stepName } }),
  stats: () => api.get('/funnel/stats'),
}

export const captureApi = {
  getFields: () => api.get('/capture/fields'),
  createField: (data) => api.post('/capture/fields', data),
  updateField: (id, data) => api.put(`/capture/fields/${id}`, data),
  deleteField: (id) => api.delete(`/capture/fields/${id}`),
}

export const agentConfigApi = {
  get: () => api.get('/config/agent-config'),
  update: (data) => api.put('/config/agent-config', data),
}

export const perfilesApi = {
  list: () => api.get('/perfiles/'),
  create: (data) => api.post('/perfiles/', data),
  update: (id, data) => api.patch(`/perfiles/${id}`, data),
  delete: (id) => api.delete(`/perfiles/${id}`),
  activar: (id) => api.post(`/perfiles/${id}/activar`),
}

export const statsApi = {
  getDashboard: () => api.get('/stats'),
}

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getAlerts: () => api.get('/dashboard/alerts'),
  getHotLeads: () => api.get('/dashboard/hot-leads'),
  getCampaigns: () => api.get('/dashboard/campaigns-summary'),
  getTrend: () => api.get('/dashboard/trend'),
  // Legacy
  getActivity: (limit = 20) => api.get('/dashboard/activity', { params: { limit } }),
  getInsights: () => api.get('/dashboard/insights'),
}

export default api
