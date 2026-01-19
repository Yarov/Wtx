import { Link } from 'react-router-dom'
import { Calendar, Users, MessageSquare, Bot, TrendingUp, RefreshCw } from 'lucide-react'
import { useDashboard } from '../hooks'
import { ActivityFeed, AlertsPanel } from '../components/dashboard'

function InsightsStrip({ insights, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-7 w-20 bg-gray-200 rounded mb-1"></div>
              <div className="h-4 w-28 bg-gray-100 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (insights.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-gray-400 text-sm text-center">
          Los insights aparecerán con más actividad
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {insights.slice(0, 4).map((insight, idx) => (
          <div key={idx} className="border-l-2 border-gray-200 pl-4">
            <p className="text-2xl font-bold text-gray-900">{insight.value}</p>
            <p className="text-sm text-gray-500">{insight.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ name, value, subValue, trend, icon: Icon, gradient, link, loading }) {
  const content = (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-5 text-white h-[130px]`}>
      <div className="flex items-start justify-between h-full">
        <div className="flex flex-col">
          <p className="text-sm font-medium text-white/80">{name}</p>
          {loading ? (
            <div className="h-8 w-20 bg-white/20 rounded animate-pulse mt-1"></div>
          ) : (
            <>
              <p className="text-3xl font-bold mt-1">{value}</p>
              <p className="text-sm text-white/70 mt-1 h-5">
                {subValue || '\u00A0'}
              </p>
              <div className="h-5 mt-auto">
                {trend !== undefined && trend !== 0 && (
                  <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${trend > 0 ? 'bg-white/20' : 'bg-red-500/30'}`}>
                    <TrendingUp className={`h-3 w-3 ${trend < 0 ? 'rotate-180' : ''}`} />
                    {trend > 0 ? '+' : ''}{trend}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div className="p-2 bg-white/20 rounded-xl h-fit">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )

  return link ? <Link to={link}>{content}</Link> : content
}

export default function Dashboard() {
  const { stats, conversations, alerts, insights, systemStatus, loading, refreshing, refresh } = useDashboard()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Centro de control de tu asistente IA</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={refresh}
            disabled={refreshing}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Actualizar"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full">
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${systemStatus.agent.status === 'online' ? 'text-indigo-700' : 'text-gray-600'}`}>
              <span className={`h-2 w-2 rounded-full ${systemStatus.agent.status === 'online' ? 'bg-indigo-500 animate-pulse' : 'bg-gray-400'}`}></span>
              Agente
            </span>
            <span className="text-gray-300">|</span>
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${systemStatus.whatsapp.status === 'online' ? 'text-indigo-700' : systemStatus.whatsapp.status === 'warning' ? 'text-amber-600' : 'text-gray-600'}`}>
              <span className={`h-2 w-2 rounded-full ${systemStatus.whatsapp.status === 'online' ? 'bg-indigo-500' : systemStatus.whatsapp.status === 'warning' ? 'bg-amber-500' : 'bg-gray-400'}`}></span>
              WhatsApp
            </span>
          </div>
        </div>
      </div>

      {/* Insights Strip */}
      <InsightsStrip insights={insights} loading={loading} />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          name="Mensajes"
          value={stats.messages?.total || 0}
          subValue={`${stats.messages?.today || 0} hoy`}
          trend={stats.messages?.trend}
          icon={MessageSquare}
          gradient="from-blue-500 to-blue-600"
          link="/conversations"
          loading={loading}
        />
        <StatCard
          name="Citas"
          value={stats.appointments?.total || 0}
          subValue={`${stats.appointments?.today || 0} para hoy`}
          icon={Calendar}
          gradient="from-indigo-600 to-indigo-700"
          link="/appointments"
          loading={loading}
        />
        <StatCard
          name="Contactos"
          value={stats.contacts?.total || 0}
          subValue={`+${stats.contacts?.new_this_week || 0} esta semana`}
          icon={Users}
          gradient="from-violet-500 to-violet-600"
          link="/contactos"
          loading={loading}
        />
        <StatCard
          name="Tasa Respuesta"
          value={`${stats.response_rate?.value || 0}%`}
          trend={stats.response_rate?.trend}
          icon={Bot}
          gradient="from-amber-500 to-orange-500"
          loading={loading}
        />
      </div>

      {/* Chat & Alerts - Side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityFeed conversations={conversations} loading={loading} />
        <AlertsPanel alerts={alerts} loading={loading} />
      </div>
    </div>
  )
}
