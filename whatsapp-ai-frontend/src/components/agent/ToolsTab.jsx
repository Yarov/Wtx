import { 
  Wrench, Package, Calendar, CreditCard, Eye, XCircle, PenLine,
  MessageCircle, Brain, ArrowRight
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
  generar_pago: { 
    name: 'Generar Pago', 
    icon: CreditCard, 
    color: 'emerald',
    trigger: 'Cliente quiere pagar o necesita link de pago',
    examples: ['Quiero pagar', '¿Cómo puedo hacer el pago?', 'Envíame el link de pago']
  },
}

const colorClasses = {
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200', light: 'bg-purple-50', gradient: 'from-purple-500 to-violet-600' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200', light: 'bg-blue-50', gradient: 'from-blue-500 to-indigo-600' },
  sky: { bg: 'bg-sky-100', text: 'text-sky-600', border: 'border-sky-200', light: 'bg-sky-50', gradient: 'from-sky-500 to-cyan-600' },
  red: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200', light: 'bg-red-50', gradient: 'from-red-500 to-rose-600' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200', light: 'bg-amber-50', gradient: 'from-amber-500 to-orange-600' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200', light: 'bg-emerald-50', gradient: 'from-emerald-500 to-teal-600' },
}

const FLOW_STEPS = [
  { icon: MessageCircle, label: 'Cliente envía mensaje', color: 'gray' },
  { icon: Brain, label: 'IA analiza intención', color: 'violet' },
  { icon: Wrench, label: 'Ejecuta herramienta', color: 'blue' },
  { icon: MessageCircle, label: 'Responde al cliente', color: 'emerald' },
]

export default function ToolsTab({ tools, onToggle }) {
  const enabledCount = tools.filter(t => t.enabled).length
  const getColors = (color) => colorClasses[color] || colorClasses.blue

  return (
    <div className="space-y-8">
      {/* Flow Visualization */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">¿Cómo funciona?</h2>
        <p className="text-sm text-gray-500 mb-4">El agente decide automáticamente qué herramienta usar</p>

        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            {FLOW_STEPS.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`p-3 rounded-xl ${
                    step.color === 'gray' ? 'bg-gray-200' :
                    step.color === 'violet' ? 'bg-violet-100' :
                    step.color === 'blue' ? 'bg-blue-100' :
                    'bg-emerald-100'
                  }`}>
                    <step.icon className={`h-6 w-6 ${
                      step.color === 'gray' ? 'text-gray-600' :
                      step.color === 'violet' ? 'text-violet-600' :
                      step.color === 'blue' ? 'text-blue-600' :
                      'text-emerald-600'
                    }`} />
                  </div>
                  <p className="mt-2 text-xs font-medium text-gray-600 text-center max-w-[100px]">
                    {step.label}
                  </p>
                </div>
                {index < FLOW_STEPS.length - 1 && (
                  <ArrowRight className="h-5 w-5 text-gray-300 mx-4" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tools Header */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Herramientas Disponibles</h2>
            <p className="text-sm text-gray-500">Activa las capacidades que necesita tu agente</p>
          </div>
          
          <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-100">
            {enabledCount} de {tools.length} activas
          </span>
        </div>

        {/* Tools Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => {
            const meta = TOOL_META[tool.id] || {}
            const colors = getColors(meta.color || 'blue')
            const Icon = meta.icon || Wrench
            
            return (
              <div
                key={tool.id}
                className={`relative rounded-2xl border-2 transition-all duration-200 overflow-hidden ${
                  tool.enabled 
                    ? `${colors.border} bg-white shadow-sm` 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                {/* Colored top bar */}
                <div className={`h-1 ${tool.enabled ? `bg-gradient-to-r ${colors.gradient}` : 'bg-gray-200'}`} />
                
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${tool.enabled ? colors.bg : 'bg-gray-200'}`}>
                        <Icon className={`h-5 w-5 ${tool.enabled ? colors.text : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <h3 className={`font-semibold ${tool.enabled ? 'text-gray-900' : 'text-gray-500'}`}>
                          {meta.name || tool.id}
                        </h3>
                      </div>
                    </div>
                    <Toggle 
                      enabled={tool.enabled} 
                      onChange={() => onToggle(tool.id)} 
                    />
                  </div>

                  {/* Trigger */}
                  <div className={`mb-3 ${!tool.enabled && 'opacity-50'}`}>
                    <p className="text-xs font-medium text-gray-500 mb-1">Se activa cuando:</p>
                    <p className="text-sm text-gray-700">{meta.trigger}</p>
                  </div>

                  {/* Examples */}
                  {meta.examples && (
                    <div className={`space-y-1.5 ${!tool.enabled && 'opacity-50'}`}>
                      <p className="text-xs font-medium text-gray-500">Ejemplos:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {meta.examples.slice(0, 2).map((example, i) => (
                          <span 
                            key={i}
                            className={`px-2 py-1 text-xs rounded-lg ${
                              tool.enabled ? colors.light + ' ' + colors.text : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            "{example}"
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
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
