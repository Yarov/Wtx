// Configuración centralizada de la aplicación
// En producción: /api (Caddy hace proxy a api:3000)
// En desarrollo: http://localhost:3000/api

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
