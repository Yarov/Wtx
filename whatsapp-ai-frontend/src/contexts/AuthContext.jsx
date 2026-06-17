import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../config'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [perfiles, setPerfiles] = useState([])
  const [perfilActivo, setPerfilActivo] = useState(null)
  const navigate = useNavigate()

  // Load the user's WhatsApp profiles and resolve the active one.
  const loadPerfiles = async (token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/perfiles/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) return
      const data = await res.json()
      setPerfiles(data)
      const activo = data.find(p => p.es_activo) || data[0] || null
      setPerfilActivo(activo)
      if (activo) {
        localStorage.setItem('perfil_id', String(activo.id))
      }
    } catch {
      // non-fatal: backend falls back to the active profile
    }
  }

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token')
    if (token) {
      // Verify token and get user info
      fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => {
          if (!res.ok) throw new Error('Invalid token')
          return res.json()
        })
        .then(async (data) => {
          setUser(data)
          await loadPerfiles(token)
        })
        .catch(() => {
          localStorage.removeItem('token')
          localStorage.removeItem('perfil_id')
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [])

  // Switch the active profile and reload so every page refetches its data.
  const cambiarPerfil = async (perfilId) => {
    const token = localStorage.getItem('token')
    try {
      await fetch(`${API_BASE_URL}/perfiles/${perfilId}/activar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
    } catch {
      // ignore; we still switch the local active profile
    }
    localStorage.setItem('perfil_id', String(perfilId))
    window.location.reload()
  }

  const login = async (username, password) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.detail || 'Login failed')
    }

    const data = await res.json()
    localStorage.setItem('token', data.access_token)

    // Get user info
    const userRes = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${data.access_token}`
      }
    })
    const userData = await userRes.json()
    setUser(userData)
    await loadPerfiles(data.access_token)

    navigate('/')
  }

  const register = async (email, username, password) => {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password })
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.detail || 'Registration failed')
    }

    // Auto login after registration
    await login(username, password)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('perfil_id')
    setUser(null)
    setPerfiles([])
    setPerfilActivo(null)
    navigate('/login')
  }

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.is_admin || false,
    perfiles,
    perfilActivo,
    cambiarPerfil,
    reloadPerfiles: () => loadPerfiles(localStorage.getItem('token')),
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
