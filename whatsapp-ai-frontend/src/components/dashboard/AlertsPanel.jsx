import { AlertTriangle, Clock, UserX, TrendingUp, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'

const ALERT_CONFIG = {
  angry_customer: { 
    icon: UserX, 
    color: 'text-red-600 bg-red-50 border-red-200',
    iconColor: 'text-red-500'
  },
  negative_sentiment: { 
    icon: AlertTriangle, 
    color: 'text-orange-600 bg-orange-50 border-orange-200',
    iconColor: 'text-orange-500'
  },
  unconfirmed_appointment: { 
    icon: Clock, 
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    iconColor: 'text-amber-500'
  },
  high_value: { 
    icon: TrendingUp, 
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    iconColor: 'text-emerald-500'
  },
}

const SEVERITY_DOT = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return ''
  const now = new Date()
  const date = new Date(timestamp)
  const diff = Math.floor((now - date) / 1000 / 60)
  
  if (diff < 1) return 'ahora'
  if (diff < 60) return `hace ${diff} min`
  if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`
  return `hace ${Math.floor(diff / 1440)}d`
}

export default function AlertsPanel({ alerts = [], loading = false }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          <h2 className="text-lg font-semibold text-gray-900">Alertas Importantes</h2>
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse p-4 bg-gray-50 rounded-xl">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const hasAlerts = alerts.length > 0

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        {hasAlerts && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
        )}
        <h2 className="text-lg font-semibold text-gray-900">Alertas Importantes</h2>
        {hasAlerts && (
          <span className="ml-auto text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
            {alerts.length}
          </span>
        )}
      </div>

      {!hasAlerts ? (
        <div className="text-center py-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 mb-3">
            <span className="text-2xl">✓</span>
          </div>
          <p className="text-gray-500 text-sm">Todo en orden, sin alertas</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {alerts.map((alert) => {
            const config = ALERT_CONFIG[alert.type] || ALERT_CONFIG.angry_customer
            const Icon = config.icon
            const dotColor = SEVERITY_DOT[alert.severity] || SEVERITY_DOT.medium

            return (
              <div 
                key={alert.id} 
                className={`p-4 rounded-xl border ${config.color}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-white/50`}>
                    <Icon className={`h-4 w-4 ${config.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                      <span className="font-medium text-sm">{alert.title}</span>
                    </div>
                    <p className="text-sm opacity-80 mb-2">
                      {alert.contact?.nombre} - {formatTimeAgo(alert.timestamp)}
                    </p>
                    <p className="text-xs opacity-70 line-clamp-2 mb-2">
                      {alert.description}
                    </p>
                    {alert.action && (
                      <Link 
                        to={alert.action.link}
                        className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                      >
                        {alert.action.label}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
