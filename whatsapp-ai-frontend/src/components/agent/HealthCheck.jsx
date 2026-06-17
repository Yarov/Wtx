import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, BookOpen, Target, Database, Settings, UserRound,
  CheckCircle2, AlertTriangle, XCircle, Loader2, MessageSquare, ArrowUpRight
} from 'lucide-react'
import { configApi } from '../../api/client'

const SECTIONS_META = {
  identidad: { icon: User, label: 'Identidad del agente', color: 'violet' },
  conocimiento: { icon: BookOpen, label: 'Base de conocimiento', color: 'blue' },
  funnel: { icon: Target, label: 'Funnel de ventas', color: 'emerald' },
  captura_datos: { icon: Database, label: 'Captura de datos', color: 'sky' },
  config_ia: { icon: Settings, label: 'Configuracion IA', color: 'amber' },
  modo_humano: { icon: UserRound, label: 'Modo humano', color: 'orange' },
}

const SECTION_LINKS = {
  identidad: { type: 'tab', tab: 'personality' },
  conocimiento: { type: 'route', path: '/conocimiento' },
  funnel: { type: 'route', path: '/funnel' },
  captura_datos: { type: 'tab', tab: 'tools' },
  config_ia: { type: 'tab', tab: 'model' },
  modo_humano: { type: 'tab', tab: 'human_mode' },
}

function ScoreCircle({ score, size = 120 }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444'
  const bgColor = score >= 80 ? 'text-green-50' : score >= 50 ? 'text-yellow-50' : 'text-red-50'

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth="10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-gray-500">de 100</span>
      </div>
    </div>
  )
}

function StatusIcon({ status }) {
  if (status === 'ok' || status === 'good') {
    return <CheckCircle2 className="h-5 w-5 text-green-500" />
  }
  if (status === 'warning' || status === 'partial') {
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />
  }
  return <XCircle className="h-5 w-5 text-red-500" />
}

function ScoreBar({ score }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
        style={{ width: `${score}%` }}
      />
    </div>
  )
}

function HealthCard({ section, data, onAction }) {
  const meta = SECTIONS_META[section] || { icon: Settings, label: section, color: 'gray' }
  const Icon = meta.icon

  const items = data.items || []
  const score = data.score ?? 0
  const status = score >= 80 ? 'ok' : score >= 50 ? 'warning' : 'error'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl bg-${meta.color}-100`}>
            <Icon className={`h-5 w-5 text-${meta.color}-600`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{meta.label}</h3>
          </div>
        </div>
        <StatusIcon status={status} />
      </div>

      <ScoreBar score={score} />

      {items.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-center gap-2 text-xs">
              {item.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
              )}
              <span className={item.ok ? 'text-gray-600' : 'text-gray-500'}>{item.label}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => onAction(section)}
        className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
      >
        Configurar
        <ArrowUpRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function StatMini({ icon: Icon, label, value, gradient }) {
  return (
    <div className={`rounded-xl bg-gradient-to-br ${gradient} p-4 text-white`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold">{value ?? '-'}</p>
          <p className="text-xs text-white/80 mt-0.5">{label}</p>
        </div>
        <div className="p-2 bg-white/20 rounded-lg">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

export default function HealthCheck({ onSwitchTab }) {
  const navigate = useNavigate()
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHealth()
  }, [])

  const loadHealth = async () => {
    setLoading(true)
    try {
      const res = await configApi.agentHealth()
      setHealth(res.data)
    } catch (error) {
      console.error('Error loading agent health:', error)
      // Fallback: show empty state
      setHealth({
        overall_score: 0,
        sections: {},
        metrics: {}
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAction = (section) => {
    const link = SECTION_LINKS[section]
    if (!link) return
    if (link.type === 'tab' && onSwitchTab) {
      onSwitchTab(link.tab)
    } else if (link.type === 'route') {
      navigate(link.path)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-violet-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Analizando configuracion del agente...</p>
        </div>
      </div>
    )
  }

  const overallScore = health?.overall_score ?? 0
  const sections = health?.sections || {}
  const metrics = health?.metrics || {}

  return (
    <div className="space-y-8">
      {/* Overall Score */}
      <div className="flex flex-col items-center py-6">
        <ScoreCircle score={overallScore} size={140} />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">
          {overallScore >= 80 ? 'Tu agente esta listo' : overallScore >= 50 ? 'Tu agente necesita mejoras' : 'Tu agente necesita configuracion'}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {overallScore >= 80
            ? 'La mayoria de las secciones estan bien configuradas'
            : 'Configura las secciones marcadas para mejorar el rendimiento'}
        </p>
      </div>

      {/* Health Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.keys(SECTIONS_META).map((key) => (
          <HealthCard
            key={key}
            section={key}
            data={sections[key] || { score: 0, items: [] }}
            onAction={handleAction}
          />
        ))}
      </div>

      {/* Metrics Row */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Metricas de los ultimos 7 dias</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatMini
            icon={MessageSquare}
            label="Conversaciones"
            value={metrics.conversations_7d ?? '-'}
            gradient="from-blue-500 to-blue-600"
          />
          <StatMini
            icon={UserRound}
            label="Transfers a humano"
            value={metrics.human_transfers_7d ?? '-'}
            gradient="from-orange-500 to-orange-600"
          />
          <StatMini
            icon={Database}
            label="Datos capturados"
            value={metrics.data_captured_7d ?? '-'}
            gradient="from-violet-500 to-violet-600"
          />
        </div>
      </div>
    </div>
  )
}
