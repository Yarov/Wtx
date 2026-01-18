import { Link } from 'react-router-dom'
import { Calendar, Users, Package, MessageSquare, Activity, Bot, Settings, Send, Zap } from 'lucide-react'
import { useDashboard } from '../hooks'
import { StatCard, StatusBadge, QuickAction, SectionHeader } from '../components/ui'

const STAT_CARDS_CONFIG = [
  { key: 'conversations', name: 'Conversaciones', field: 'totalConversations', icon: Users, gradient: 'from-blue-500 to-blue-600', link: '/conversations' },
  { key: 'appointments', name: 'Citas', field: 'totalAppointments', icon: Calendar, gradient: 'from-emerald-500 to-emerald-600', link: '/appointments' },
  { key: 'products', name: 'Productos', field: 'totalProducts', icon: Package, gradient: 'from-violet-500 to-violet-600', link: '/inventory' },
  { key: 'messages', name: 'Mensajes', field: 'totalMessages', icon: MessageSquare, gradient: 'from-amber-500 to-orange-500', link: '/conversations' },
]

const QUICK_ACTIONS_CONFIG = [
  { name: 'Configurar Agente', icon: Bot, link: '/agent', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
  { name: 'Nueva Campaña', icon: Send, link: '/campanas', color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
  { name: 'Ver Contactos', icon: Users, link: '/contactos', color: 'text-violet-600 bg-violet-50 hover:bg-violet-100' },
  { name: 'Configuración', icon: Settings, link: '/settings', color: 'text-gray-600 bg-gray-50 hover:bg-gray-100' },
]

const SYSTEM_STATUS_CONFIG = [
  { key: 'agent', label: 'Agente IA', icon: Bot },
  { key: 'whatsapp', label: 'WhatsApp API', icon: MessageSquare },
  { key: 'database', label: 'Base de datos', icon: Zap },
]

export default function Dashboard() {
  const { stats, contactStats, campaignStats, systemStatus, loading } = useDashboard()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Resumen de tu asistente de WhatsApp</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${systemStatus.agent.status === 'online' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
            <span className={`h-2 w-2 rounded-full ${systemStatus.agent.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
            Agente {systemStatus.agent.status === 'online' ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS_CONFIG.map((stat) => (
          <StatCard
            key={stat.key}
            name={stat.name}
            value={stats[stat.field]}
            icon={stat.icon}
            gradient={stat.gradient}
            link={stat.link}
            loading={loading}
          />
        ))}
      </div>

      {/* Quick Actions & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {QUICK_ACTIONS_CONFIG.map((action) => (
              <QuickAction key={action.name} {...action} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Estado del Sistema</h2>
            <Activity className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {SYSTEM_STATUS_CONFIG.map((item) => (
              <div key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">{item.label}</span>
                </div>
                <StatusBadge 
                  status={systemStatus[item.key].status} 
                  label={systemStatus[item.key].label} 
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <SectionHeader title="Contactos" linkText="Ver todos" linkTo="/contactos" />
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-2xl font-bold text-gray-900">{contactStats.total}</p>
              <p className="text-sm text-gray-500">Total contactos</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-xl">
              <p className="text-2xl font-bold text-emerald-600">{contactStats.activos}</p>
              <p className="text-sm text-gray-500">Activos</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <SectionHeader title="Campañas" linkText="Ver todas" linkTo="/campanas" />
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-2xl font-bold text-gray-900">{campaignStats.total}</p>
              <p className="text-sm text-gray-500">Total campañas</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl">
              <p className="text-2xl font-bold text-blue-600">{campaignStats.enviando}</p>
              <p className="text-sm text-gray-500">En envío</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
