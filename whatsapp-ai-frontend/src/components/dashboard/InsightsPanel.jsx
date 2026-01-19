import { Clock, MessageCircle, Users, Calendar, MessageSquare, TrendingUp, Lightbulb } from 'lucide-react'

const INSIGHT_ICONS = {
  peak_hours: Clock,
  top_question: MessageCircle,
  engagement: Users,
  appointments_trend: Calendar,
  avg_messages: MessageSquare,
  response_rate: TrendingUp,
}

const INSIGHT_COLORS = {
  peak_hours: 'text-violet-600 bg-violet-50',
  top_question: 'text-blue-600 bg-blue-50',
  engagement: 'text-indigo-600 bg-indigo-50',
  appointments_trend: 'text-amber-600 bg-amber-50',
  avg_messages: 'text-pink-600 bg-pink-50',
  response_rate: 'text-cyan-600 bg-cyan-50',
}

export default function InsightsPanel({ insights = [], loading = false }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900">Insights del Agente</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg font-semibold text-gray-900">Insights del Agente</h2>
      </div>

      {insights.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Lightbulb className="h-10 w-10 mx-auto mb-2 text-gray-300" />
          <p>Aún no hay suficientes datos</p>
          <p className="text-sm mt-1">Los insights aparecerán con más actividad</p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight, idx) => {
            const Icon = INSIGHT_ICONS[insight.type] || Lightbulb
            const colorClass = INSIGHT_COLORS[insight.type] || 'text-gray-600 bg-gray-50'

            return (
              <div 
                key={idx} 
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className={`p-2.5 rounded-xl ${colorClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500">{insight.label}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-gray-900">
                      {insight.value}
                    </span>
                    {insight.detail && (
                      <span className="text-sm text-gray-500">
                        {insight.detail}
                      </span>
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
