import { useEffect, useState } from 'react'
import { Calendar, Users, Package, MessageSquare, TrendingUp, Activity } from 'lucide-react'
import Card from '../components/Card'
import { statsApi } from '../api/client'

const defaultStats = {
  totalConversations: 0,
  totalAppointments: 0,
  totalProducts: 0,
  totalMessages: 0,
}

export default function Dashboard() {
  const [stats, setStats] = useState(defaultStats)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const response = await statsApi.getDashboard()
      setStats(response.data)
    } catch (error) {
      console.log('Using default stats')
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    { 
      name: 'Conversaciones', 
      value: stats.totalConversations, 
      icon: Users,
      color: 'bg-blue-500'
    },
    { 
      name: 'Citas Agendadas', 
      value: stats.totalAppointments, 
      icon: Calendar,
      color: 'bg-emerald-500'
    },
    { 
      name: 'Productos', 
      value: stats.totalProducts, 
      icon: Package,
      color: 'bg-purple-500'
    },
    { 
      name: 'Total Mensajes', 
      value: stats.totalMessages, 
      icon: MessageSquare,
      color: 'bg-orange-500'
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Resumen del agente de WhatsApp</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div
            key={stat.name}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {loading ? '...' : stat.value}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Estado del Sistema" icon={Activity}>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">API WhatsApp</span>
              <span className="flex items-center gap-2 text-emerald-600">
                <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></span>
                Conectado
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">OpenAI API</span>
              <span className="flex items-center gap-2 text-emerald-600">
                <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></span>
                Activo
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-600">Base de datos</span>
              <span className="flex items-center gap-2 text-emerald-600">
                <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></span>
                Operativa
              </span>
            </div>
          </div>
        </Card>

        <Card title="Actividad Reciente" icon={TrendingUp}>
          <div className="space-y-3">
            <p className="text-gray-500 text-sm text-center py-8">
              Las actividades recientes aparecerán aquí
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
