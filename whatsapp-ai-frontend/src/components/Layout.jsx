import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { toolsApi, businessApi, perfilesApi } from '../api/client'
import useSecretReset from '../hooks/useSecretReset'
import FactoryResetModal from './FactoryResetModal'
import {
  LayoutDashboard,
  MessagesSquare,
  Bot,
  LogOut,
  User,
  Zap,
  Menu,
  X,
  Smartphone,
  FileText,
  Settings,
  BarChart3,
  MessageSquare,
  Users,
  Send,
  ChevronDown,
  Plus,
  Check
} from 'lucide-react'

function ProfileSelector() {
  const { perfiles, perfilActivo, cambiarPerfil, reloadPerfiles } = useAuth()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    const nombre = window.prompt('Nombre del nuevo perfil de WhatsApp:')
    if (!nombre) return
    setCreating(true)
    try {
      const res = await perfilesApi.create({ nombre })
      await reloadPerfiles()
      setOpen(false)
      // Switch to the freshly created profile
      if (res?.data?.id) cambiarPerfil(res.data.id)
    } catch {
      alert('No se pudo crear el perfil')
    } finally {
      setCreating(false)
    }
  }

  if (!perfilActivo) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="text-lg leading-none">{perfilActivo.emoji || '📱'}</span>
        <span className="text-sm font-semibold text-gray-800 max-w-[120px] truncate">{perfilActivo.nombre}</span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 w-60 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
            <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Perfiles</p>
            {perfiles.map((p) => (
              <button
                key={p.id}
                onClick={() => p.id !== perfilActivo.id && cambiarPerfil(p.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                  p.id === perfilActivo.id ? 'bg-violet-50' : ''
                }`}
              >
                <span className="text-lg leading-none">{p.emoji || '📱'}</span>
                <span className="flex-1 truncate text-gray-800">{p.nombre}</span>
                {p.id === perfilActivo.id && <Check className="h-4 w-4 text-violet-600" />}
              </button>
            ))}
            <div className="border-t border-gray-100">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-violet-600 hover:bg-violet-50 font-medium disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {creating ? 'Creando...' : 'Nuevo perfil'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const MAIN_NAVIGATION = [
  { name: 'Reportes', href: '/', icon: LayoutDashboard, always: true },
  { name: 'Conversaciones', href: '/conversations', icon: MessagesSquare, always: true },
  { name: 'Clientes', href: '/contactos', icon: User, always: true },
  { name: 'Campañas', href: '/campanas', icon: Zap, always: true },
]

const CONFIG_NAVIGATION = [
  { name: 'WhatsApp', href: '/whatsapp', icon: Smartphone, always: true },
  { name: 'Tu Agente', href: '/agent', icon: Bot, always: true },
]

// Bottom nav items for mobile (5 slots: 4 primary + "Más")
const BOTTOM_NAV_ITEMS = [
  { name: 'Reportes', href: '/', icon: BarChart3, always: true },
  { name: 'Chats', href: '/conversations', icon: MessageSquare, always: true },
  { name: 'Clientes', href: '/contactos', icon: Users, always: true },
  { name: 'Campañas', href: '/campanas', icon: Send, always: true },
]

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [agentEnabled, setAgentEnabled] = useState(true)
  const [agentLoading, setAgentLoading] = useState(false)
  const [modules, setModules] = useState({})
  const [modulesLoaded, setModulesLoaded] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)

  // Secret factory reset: Cmd + K (solo admins)
  const [resetModalOpen, setResetModalOpen] = useSecretReset(isAdmin)

  useEffect(() => {
    loadAgentStatus()
    loadModules()
    setSidebarOpen(false)
    setMoreMenuOpen(false)
  }, [location.pathname])

  // Lock body scroll when more menu is open
  useEffect(() => {
    if (moreMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [moreMenuOpen])

  useEffect(() => {
    const handleModulesChanged = () => loadModules()
    window.addEventListener('modules-changed', handleModulesChanged)
    return () => window.removeEventListener('modules-changed', handleModulesChanged)
  }, [])

  const loadAgentStatus = async () => {
    try {
      const response = await toolsApi.getAgentStatus()
      setAgentEnabled(response.data.enabled)
    } catch (error) {
      console.error('Error loading agent status:', error)
    }
  }

  const loadModules = async () => {
    try {
      const response = await businessApi.getModules()
      setModules(response.data.modules)
      setModulesLoaded(true)
      // Onboarding wizard disabled: SaaS flow goes straight to the dashboard.
      // Per-profile setup will live in each profile instead.
    } catch (error) {
      console.error('Error loading modules:', error)
      setModulesLoaded(true)
    }
  }

  // Filtrar navegación según módulos activos
  const mainNavigation = MAIN_NAVIGATION.filter(item => 
    item.always || (item.module && modules[item.module])
  )
  
  const configNavigation = CONFIG_NAVIGATION.filter(item => 
    item.always || (item.module && modules[item.module])
  )

  // Items shown in the "Más" overlay — everything not in bottom nav
  const moreMenuMain = mainNavigation.filter(
    item => !BOTTOM_NAV_ITEMS.some(bn => bn.href === item.href)
  )

  // Check if any "more menu" item is currently active (to highlight the "Más" icon)
  const moreMenuAllItems = [...moreMenuMain, ...configNavigation]
  const isMoreActive = moreMenuAllItems.some(item => {
    if (item.href === '/') return location.pathname === '/'
    return location.pathname.startsWith(item.href)
  })

  const isPathActive = (href) => {
    if (href === '/') return location.pathname === '/'
    return location.pathname.startsWith(href)
  }

  const toggleAgent = async () => {
    setAgentLoading(true)
    const newStatus = !agentEnabled
    setAgentEnabled(newStatus)
    try {
      await toolsApi.setAgentStatus(newStatus)
    } catch (error) {
      console.error('Error toggling agent:', error)
      setAgentEnabled(!newStatus)
    } finally {
      setAgentLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 -left-10 w-32 h-32 bg-black/10 rounded-full blur-2xl" />
        </div>

        <div className="relative flex-shrink-0 flex h-16 items-center justify-between px-6 border-b border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Wtx</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <nav className="relative mt-6 px-3 flex-1 overflow-y-auto">
          <div className="space-y-1">
            {mainNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/20'
                      : 'text-white/80 hover:bg-white/15 hover:text-white'
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </NavLink>
            ))}
          </div>

          {/* Configuración */}
          <div className="mt-8">
            <p className="px-3 mb-2 text-xs font-semibold text-white/50 uppercase tracking-wider">
              Configuración
            </p>
            <div className="space-y-1">
              {configNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/20'
                        : 'text-white/80 hover:bg-white/15 hover:text-white'
                    }`
                  }
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

        <div className="relative flex-shrink-0 p-4 border-t border-white/20">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>v3.0</span>
            <span>Wtx Agent</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:pl-64">
        {/* Top Header with Agent Control and User */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 lg:px-6 py-2">
          <div className="flex items-center justify-between gap-2">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Profile selector (Stripe-style switcher) */}
            <ProfileSelector />

            {/* Agent Status Toggle */}
            <button
              onClick={toggleAgent}
              disabled={agentLoading}
              className={`group flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2 rounded-xl transition-all ${
                agentLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              } ${
                agentEnabled
                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <div className={`relative flex items-center justify-center w-7 h-7 lg:w-8 lg:h-8 rounded-lg ${
                agentEnabled ? 'bg-white/20' : 'bg-gray-200'
              }`}>
                <Zap className={`h-4 w-4 lg:h-5 lg:w-5 ${agentEnabled ? 'text-white' : 'text-gray-500'}`} />
                {agentEnabled && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 lg:w-2.5 lg:h-2.5 bg-white rounded-full animate-pulse" />
                )}
              </div>
              <div className="text-left hidden sm:block">
                <p className={`text-sm font-semibold ${agentEnabled ? 'text-white' : 'text-gray-700'}`}>
                  {agentEnabled ? 'IA Activa' : 'IA Inactiva'}
                </p>
                <p className={`text-xs ${agentEnabled ? 'text-violet-100' : 'text-gray-500'}`}>
                  {agentLoading ? 'Cambiando...' : agentEnabled ? 'Respondiendo' : 'Click para activar'}
                </p>
              </div>
              <div className={`hidden sm:block ml-2 w-12 h-6 rounded-full p-0.5 transition-colors ${
                agentEnabled ? 'bg-white/30' : 'bg-gray-300'
              }`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  agentEnabled ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </div>
            </button>

            {/* User Menu */}
            <div className="flex items-center gap-2 lg:gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {user?.is_admin && (
                  <span className="hidden sm:inline px-2 py-1 bg-violet-100 text-violet-700 text-xs font-medium rounded-lg">
                    Admin
                  </span>
                )}
                <button
                  onClick={logout}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Cerrar sesión"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* Factory Reset Modal (Cmd + K) */}
      <FactoryResetModal 
        isOpen={resetModalOpen} 
        onClose={() => setResetModalOpen(false)} 
      />
    </div>
  )
}
