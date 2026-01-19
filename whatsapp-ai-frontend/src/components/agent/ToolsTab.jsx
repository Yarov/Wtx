import { useState, useEffect } from 'react'
import { 
  Wrench, Package, Calendar, Eye, XCircle, PenLine, UserRound,
  MessageCircle, Brain, Zap, CheckCircle2, Send
} from 'lucide-react'
import Toggle from '../Toggle'

const TOOL_META = {
  consultar_inventario: { 
    name: 'Consultar Inventario', 
    icon: Package, 
    color: 'purple',
    trigger: 'Cliente pregunta por productos, precios o disponibilidad',
    examples: ['¿Qué servicios tienen?', '¿Cuánto cuesta el corte?', '¿Tienen tinte disponible?']
  },
  agendar_cita: { 
    name: 'Agendar Cita', 
    icon: Calendar, 
    color: 'blue',
    trigger: 'Cliente quiere reservar una cita o turno',
    examples: ['Quiero agendar para mañana', '¿Tienen espacio el viernes?', 'Reservar a las 3pm']
  },
  ver_citas: { 
    name: 'Ver Citas', 
    icon: Eye, 
    color: 'sky',
    trigger: 'Cliente pregunta por sus citas existentes',
    examples: ['¿Cuándo es mi cita?', '¿Tengo algo agendado?', '¿A qué hora era mi turno?']
  },
  cancelar_cita: { 
    name: 'Cancelar Cita', 
    icon: XCircle, 
    color: 'red',
    trigger: 'Cliente quiere cancelar una cita',
    examples: ['Quiero cancelar mi cita', 'Ya no puedo ir', 'Cancela mi turno']
  },
  modificar_cita: { 
    name: 'Modificar Cita', 
    icon: PenLine, 
    color: 'amber',
    trigger: 'Cliente quiere cambiar fecha, hora o servicio',
    examples: ['¿Puedo cambiar mi cita?', 'Quiero agregar otro servicio', 'Cambiar a las 5pm']
  },
  transferir_a_humano: { 
    name: 'Transferir a Humano', 
    icon: UserRound, 
    color: 'indigo',
    trigger: 'Cliente frustrado, queja, solicita hablar con persona',
    examples: ['Quiero hablar con alguien', 'Estoy muy molesto', 'Esto es inaceptable']
  },
}

const colorClasses = {
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200', light: 'bg-purple-50', gradient: 'from-purple-500 to-violet-600' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200', light: 'bg-blue-50', gradient: 'from-blue-500 to-indigo-600' },
  sky: { bg: 'bg-sky-100', text: 'text-sky-600', border: 'border-sky-200', light: 'bg-sky-50', gradient: 'from-sky-500 to-cyan-600' },
  red: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200', light: 'bg-red-50', gradient: 'from-red-500 to-rose-600' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200', light: 'bg-amber-50', gradient: 'from-amber-500 to-orange-600' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200', light: 'bg-indigo-50', gradient: 'from-indigo-600 to-sky-500' },
}

// Clean Animated Flow Component
function AnimatedFlow() {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 5)
    }, 1800)
    return () => clearInterval(interval)
  }, [])

  const steps = [
    { icon: MessageCircle, label: 'Mensaje recibido', sublabel: 'Cliente envía consulta', color: 'indigo' },
    { icon: Brain, label: 'IA analiza', sublabel: 'Detecta intención', color: 'violet' },
    { icon: Zap, label: 'Selecciona tool', sublabel: 'Elige herramienta', color: 'amber' },
    { icon: Wrench, label: 'Ejecuta', sublabel: 'Procesa solicitud', color: 'blue' },
    { icon: CheckCircle2, label: 'Responde', sublabel: 'Envía respuesta', color: 'indigo' },
  ]

  const colorMap = {
    indigo: { bg: 'bg-indigo-600', ring: 'ring-indigo-100', text: 'text-indigo-600', light: 'bg-indigo-50', glow: 'shadow-indigo-500/25' },
    violet: { bg: 'bg-violet-500', ring: 'ring-violet-100', text: 'text-violet-600', light: 'bg-violet-50', glow: 'shadow-violet-500/25' },
    amber: { bg: 'bg-amber-500', ring: 'ring-amber-100', text: 'text-amber-600', light: 'bg-amber-50', glow: 'shadow-amber-500/25' },
    blue: { bg: 'bg-blue-500', ring: 'ring-blue-100', text: 'text-blue-600', light: 'bg-blue-50', glow: 'shadow-blue-500/25' },
  }

  return (
    <div className="relative bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 p-8 overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.015]" style={{ 
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` 
      }} />

      {/* Flow visualization */}
      <div className="relative flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index === activeStep
          const isPast = index < activeStep
          const colors = colorMap[step.color]
          const Icon = step.icon
          
          return (
            <div key={index} className="flex items-center flex-1">
              {/* Step */}
              <div className="flex flex-col items-center flex-1">
                {/* Icon container */}
                <div className={`relative transition-all duration-500 ease-out ${isActive ? 'scale-110' : 'scale-100'}`}>
                  {/* Glow effect */}
                  {isActive && (
                    <div className={`absolute inset-0 rounded-2xl ${colors.bg} blur-xl opacity-40 scale-150`} />
                  )}
                  
                  {/* Main circle */}
                  <div 
                    className={`relative w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                      isActive 
                        ? `${colors.bg} shadow-xl ${colors.glow}` 
                        : isPast 
                          ? `${colors.bg} opacity-80`
                          : 'bg-gray-100 border-2 border-gray-200'
                    }`}
                  >
                    <Icon className={`h-7 w-7 transition-all duration-300 ${
                      isActive || isPast ? 'text-white' : 'text-gray-400'
                    } ${isActive ? 'scale-110' : ''}`} />
                    
                    {/* Pulse ring */}
                    {isActive && (
                      <>
                        <div className={`absolute inset-0 rounded-2xl ${colors.bg} animate-ping opacity-20`} />
                        <div className={`absolute -inset-1 rounded-2xl border-2 ${colors.ring} animate-pulse`} />
                      </>
                    )}
                  </div>

                  {/* Step indicator dot */}
                  <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white transition-all duration-300 ${
                    isActive ? colors.bg : isPast ? 'bg-gray-400' : 'bg-gray-200'
                  }`} />
                </div>
                
                {/* Labels */}
                <div className="mt-5 text-center">
                  <p className={`text-sm font-semibold transition-all duration-300 ${
                    isActive ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {step.label}
                  </p>
                  <p className={`text-xs mt-0.5 transition-all duration-300 ${
                    isActive ? colors.text : 'text-gray-400'
                  }`}>
                    {step.sublabel}
                  </p>
                </div>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="relative flex-shrink-0 w-full max-w-[80px] h-1 mx-2 -mt-10">
                  {/* Background line */}
                  <div className="absolute inset-0 bg-gray-200 rounded-full" />
                  
                  {/* Animated progress line */}
                  <div 
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${
                      isPast 
                        ? 'w-full bg-gradient-to-r from-indigo-400 to-violet-400' 
                        : isActive 
                          ? 'w-1/2 bg-gradient-to-r from-indigo-400 to-violet-400'
                          : 'w-0'
                    }`}
                  />
                  
                  {/* Moving dot */}
                  {isActive && (
                    <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-lg animate-flow-dot" 
                      style={{ 
                        animation: 'flowDot 1.8s ease-in-out infinite',
                        boxShadow: '0 0 10px rgba(139, 92, 246, 0.5)'
                      }} 
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Current action indicator */}
      <div className="mt-8 flex justify-center">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-500 ${colorMap[steps[activeStep].color].light} border ${colorMap[steps[activeStep].color].ring}`}>
          <div className="w-2 h-2 rounded-full bg-current animate-pulse" style={{ color: `var(--${steps[activeStep].color}-500)` }} />
          <span className={`text-sm font-medium ${colorMap[steps[activeStep].color].text}`}>
            {steps[activeStep].label}: {steps[activeStep].sublabel}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes flowDot {
          0% { left: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  )
}

export default function ToolsTab({ tools, onToggle }) {
  const enabledCount = tools.filter(t => t.enabled).length
  const getColors = (color) => colorClasses[color] || colorClasses.blue

  return (
    <div className="space-y-8">
      {/* Animated Flow Visualization */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">¿Cómo funciona?</h2>
        <p className="text-sm text-gray-500 mb-4">Observa cómo fluye la información en tiempo real</p>
        <AnimatedFlow />
      </section>

      {/* Tools Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Herramientas Disponibles</h2>
            <p className="text-sm text-gray-500">Activa las capacidades que necesita tu agente</p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {tools.filter(t => t.enabled).slice(0, 4).map((tool) => {
                const meta = TOOL_META[tool.id] || {}
                const colors = getColors(meta.color || 'blue')
                const Icon = meta.icon || Wrench
                return (
                  <div key={tool.id} className={`w-8 h-8 rounded-full ${colors.bg} flex items-center justify-center border-2 border-white`}>
                    <Icon className={`h-4 w-4 ${colors.text}`} />
                  </div>
                )
              })}
            </div>
            <span className="text-sm font-medium text-gray-600">
              {enabledCount}/{tools.length}
            </span>
          </div>
        </div>

        {/* Tools List */}
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {tools.map((tool) => {
            const meta = TOOL_META[tool.id] || {}
            const colors = getColors(meta.color || 'blue')
            const Icon = meta.icon || Wrench
            
            return (
              <div
                key={tool.id}
                className={`group flex items-center gap-4 p-4 transition-all duration-200 hover:bg-gray-50 ${
                  !tool.enabled && 'bg-gray-50/50'
                }`}
              >
                {/* Icon */}
                <div className={`relative flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  tool.enabled 
                    ? `${colors.bg} shadow-sm` 
                    : 'bg-gray-100'
                }`}>
                  <Icon className={`h-6 w-6 transition-colors ${tool.enabled ? colors.text : 'text-gray-400'}`} />
                  {tool.enabled && (
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${colors.bg.replace('100', '500')} rounded-full border-2 border-white`} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-semibold transition-colors ${tool.enabled ? 'text-gray-900' : 'text-gray-500'}`}>
                      {meta.name || tool.id}
                    </h3>
                    {tool.enabled && (
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${colors.light} ${colors.text}`}>
                        Activo
                      </span>
                    )}
                  </div>
                  <p className={`text-sm transition-colors ${tool.enabled ? 'text-gray-600' : 'text-gray-400'}`}>
                    {meta.trigger}
                  </p>
                  
                  {/* Examples - visible on hover or when active */}
                  {meta.examples && (
                    <div className={`flex flex-wrap gap-1.5 mt-2 transition-all duration-200 ${
                      tool.enabled ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
                    }`}>
                      {meta.examples.map((example, i) => (
                        <span 
                          key={i}
                          className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-md"
                        >
                          {example}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Toggle */}
                <div className="flex-shrink-0">
                  <Toggle 
                    enabled={tool.enabled} 
                    onChange={() => onToggle(tool.id)} 
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Help Section */}
      <section>
        <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
          <h3 className="font-medium text-gray-900 mb-2">¿Cómo decide el agente qué herramienta usar?</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            El agente analiza cada mensaje y detecta la intención. Por ejemplo, si alguien pregunta 
            <strong> "¿tienen espacio mañana a las 3?"</strong>, entiende que quiere agendar y usa esa herramienta automáticamente.
          </p>
        </div>
      </section>
    </div>
  )
}
