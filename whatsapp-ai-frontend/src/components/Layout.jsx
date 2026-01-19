import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { toolsApi, businessApi } from '../api/client'
import useSecretReset from '../hooks/useSecretReset'
import FactoryResetModal from './FactoryResetModal'
import { 
  LayoutDashboard, 
  Package, 
  Calendar,
  Clock,
  MessagesSquare,
  Bot,
  LogOut,
  User,
  Zap,
  Settings,
  Menu,
  X
} from 'lucide-react'

const BASE_NAVIGATION = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, always: true },
  { name: 'Agente IA', href: '/agent', icon: Bot, always: true },
  { name: 'Contactos', href: '/contactos', icon: User, always: true },
  { name: 'Campañas', href: '/campanas', icon: Zap, always: true },
  { name: 'Inventario', href: '/inventory', icon: Package, module: 'inventory' },
  { name: 'Citas', href: '/appointments', icon: Calendar, module: 'appointments' },
  { name: 'Conversaciones', href: '/conversations', icon: MessagesSquare, always: true },
]

const CONFIG_NAVIGATION = [
  { name: 'Configuración', href: '/settings', icon: Settings, always: true },
  { name: 'Horarios', href: '/schedule', icon: Clock, module: 'schedule' },
]

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [agentEnabled, setAgentEnabled] = useState(true)
  const [agentLoading, setAgentLoading] = useState(false)
  const [modules, setModules] = useState({ inventory: true, appointments: true, schedule: true })
  const [modulesLoaded, setModulesLoaded] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Secret factory reset: Cmd + K (solo admins)
  const [resetModalOpen, setResetModalOpen] = useSecretReset(isAdmin)

  useEffect(() => {
    loadAgentStatus()
    loadModules()
    setSidebarOpen(false)
  }, [location.pathname])

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
      
      // Si no ha completado onboarding, redirigir a setup
      if (!response.data.onboarding_completed) {
        navigate('/setup')
      }
    } catch (error) {
      console.error('Error loading modules:', error)
      setModulesLoaded(true)
    }
  }

  // Filtrar navegación según módulos activos
  const mainNavigation = BASE_NAVIGATION.filter(item => 
    item.always || (item.module && modules[item.module])
  )
  
  const configNavigation = CONFIG_NAVIGATION.filter(item => 
    item.always || (item.module && modules[item.module])
  )

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
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20'
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
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20'
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

            {/* Agent Status Toggle */}
            <button
              onClick={toggleAgent}
              disabled={agentLoading}
              className={`group flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2 rounded-xl transition-all ${
                agentLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              } ${
                agentEnabled 
                  ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-lg shadow-indigo-200' 
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
                <p className={`text-xs ${agentEnabled ? 'text-indigo-100' : 'text-gray-500'}`}>
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
