import { useState, useEffect } from 'react'
import { 
  Wrench, Package, Calendar, CreditCard, Eye, Settings, XCircle, PenLine, CheckCircle,
  MessageCircle, ArrowRight, ArrowDown, Play, Zap, GitBranch, HelpCircle, ChevronRight,
  Sparkles, Brain, Target, Clock, User, Phone, Check, X, Edit3, Trash2, Plus, GripVertical
} from 'lucide-react'
import Toggle from '../components/Toggle'
import Button from '../components/Button'
import { toolsApi } from '../api/client'

const TOOL_META = {
  consultar_inventario: { 
    name: 'Consultar Inventario', 
    icon: Package, 
    category: 'inventory',
    color: 'purple',
    trigger: 'Cliente pregunta por productos, precios o disponibilidad',
    example: '"¿Qué servicios tienen?" "¿Cuánto cuesta el corte?"'
  },
  agendar_cita: { 
    name: 'Agendar Cita', 
    icon: Calendar, 
    category: 'appointments',
    color: 'blue',
    trigger: 'Cliente quiere reservar una cita',
    example: '"Quiero agendar para mañana" "¿Tienen espacio el viernes?"'
  },
  ver_citas: { 
    name: 'Ver Citas', 
    icon: Eye, 
    category: 'appointments',
    color: 'sky',
    trigger: 'Cliente pregunta por sus citas existentes',
    example: '"¿Cuándo es mi cita?" "¿Tengo algo agendado?"'
  },
  cancelar_cita: { 
    name: 'Cancelar Cita', 
    icon: XCircle, 
    category: 'appointments',
    color: 'red',
    trigger: 'Cliente quiere cancelar una cita',
    example: '"Quiero cancelar mi cita" "Ya no puedo ir"'
  },
  modificar_cita: { 
    name: 'Modificar Cita', 
    icon: PenLine, 
    category: 'appointments',
    color: 'amber',
    trigger: 'Cliente quiere cambiar fecha, hora o servicio',
    example: '"¿Puedo cambiar mi cita?" "Quiero agregar otro servicio"'
  },
  generar_pago: { 
    name: 'Generar Pago', 
    icon: CreditCard, 
    category: 'payments',
    color: 'emerald',
    trigger: 'Cliente quiere pagar o necesita link de pago',
    example: '"Quiero pagar" "¿Cómo puedo hacer el pago?"'
  },
}

const FLOW_STEPS = [
  {
    id: 'start',
    type: 'trigger',
    title: 'Cliente envía mensaje',
    icon: MessageCircle,
    color: 'gray',
    description: 'El cliente inicia o continúa una conversación'
  },
  {
    id: 'analyze',
    type: 'process',
    title: 'Analizar intención',
    icon: Brain,
    color: 'violet',
    description: 'El agente interpreta qué quiere el cliente'
  },
  {
    id: 'decide',
    type: 'decision',
    title: '¿Qué necesita?',
    icon: GitBranch,
    color: 'indigo',
    description: 'Determina la acción apropiada'
  },
  {
    id: 'tools',
    type: 'tools',
    title: 'Ejecutar herramienta',
    icon: Wrench,
    color: 'blue',
    description: 'Usa la herramienta necesaria'
  },
  {
    id: 'respond',
    type: 'action',
    title: 'Responder al cliente',
    icon: MessageCircle,
    color: 'emerald',
    description: 'Envía respuesta personalizada'
  }
]

const colorClasses = {
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', ring: 'ring-purple-500' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', ring: 'ring-blue-500' },
  sky: { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-300', ring: 'ring-sky-500' },
  red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', ring: 'ring-red-500' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', ring: 'ring-amber-500' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', ring: 'ring-emerald-500' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', ring: 'ring-gray-500' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300', ring: 'ring-violet-500' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300', ring: 'ring-indigo-500' },
}

export default function Tools() {
  const [tools, setTools] = useState([])
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState('flow')
  const [selectedTool, setSelectedTool] = useState(null)
  const [expandedStep, setExpandedStep] = useState('decide')
  useEffect(() => {
    loadTools()
  }, [])

  const loadTools = async () => {
    try {
      const response = await toolsApi.getTools()
      const toolsData = response.data.map(t => ({
        id: t.id,
        enabled: t.enabled,
        description: t.description,
        ...TOOL_META[t.id]
      }))
      setTools(toolsData)
    } catch (error) {
      console.error('Error loading tools:', error)
    }
  }

  const toggleTool = async (id) => {
    const tool = tools.find(t => t.id === id)
    const newEnabled = !tool.enabled
    
    setTools(tools.map(t => t.id === id ? { ...t, enabled: newEnabled } : t))
    
    try {
      await toolsApi.toggleTool(id, newEnabled)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Error toggling tool:', error)
      setTools(tools.map(t => t.id === id ? { ...t, enabled: !newEnabled } : t))
    }
  }

  const enabledCount = tools.filter(t => t.enabled).length
  const enabledTools = tools.filter(t => t.enabled)

  const FlowNode = ({ step, isLast }) => {
    const colors = colorClasses[step.color]
    const Icon = step.icon
    const isExpanded = expandedStep === step.id
    
    return (
      <div className="flex flex-col items-center">
        {/* Node */}
        <button
          onClick={() => setExpandedStep(isExpanded ? null : step.id)}
          className={`relative group w-full max-w-md transition-all duration-200 ${
            isExpanded ? 'scale-105' : 'hover:scale-102'
          }`}
        >
          <div className={`p-4 rounded-2xl border-2 ${colors.border} ${colors.bg} transition-all ${
            isExpanded ? 'shadow-lg' : 'shadow-sm hover:shadow-md'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${colors.bg} border ${colors.border}`}>
                <Icon className={`h-5 w-5 ${colors.text}`} />
              </div>
              <div className="text-left flex-1">
                <h4 className="font-semibold text-gray-900">{step.title}</h4>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
              <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`} />
            </div>
            
            {/* Expanded content for decision node */}
            {isExpanded && step.id === 'decide' && (
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                <p className="text-xs font-medium text-gray-500 mb-3">El agente puede detectar:</p>
                <div className="grid grid-cols-2 gap-2">
                  {['Consulta de servicios', 'Quiere agendar', 'Ver sus citas', 'Cancelar cita', 'Modificar cita', 'Pagar servicio', 'Conversación general'].map((intent, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600 bg-white/50 rounded-lg px-2 py-1.5">
                      <div className={`w-2 h-2 rounded-full ${i < 6 ? 'bg-blue-400' : 'bg-gray-300'}`} />
                      {intent}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expanded content for tools node */}
            {isExpanded && step.id === 'tools' && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-500 mb-3">Herramientas activas: {enabledCount}</p>
                <div className="flex flex-wrap gap-2">
                  {enabledTools.map((tool) => {
                    const tc = colorClasses[tool.color]
                    return (
                      <span key={tool.id} className={`px-2 py-1 text-xs rounded-lg ${tc.bg} ${tc.text}`}>
                        {tool.name}
                      </span>
                    )
                  })}
                  {enabledTools.length === 0 && (
                    <span className="text-xs text-gray-400">Ninguna herramienta activa</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </button>

        {/* Connector */}
        {!isLast && (
          <div className="flex flex-col items-center py-2">
            <div className="w-0.5 h-6 bg-gray-300" />
            <ArrowDown className="h-4 w-4 text-gray-400 -mt-1" />
          </div>
        )}
      </div>
    )
  }

  const ToolCard = ({ tool }) => {
    const colors = colorClasses[tool.color]
    const Icon = tool.icon
    
    return (
      <div 
        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
          tool.enabled 
            ? `${colors.border} ${colors.bg} shadow-sm hover:shadow-md` 
            : 'border-gray-200 bg-gray-50 opacity-60'
        }`}
        onClick={() => setSelectedTool(selectedTool?.id === tool.id ? null : tool)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className={`p-2.5 rounded-xl ${tool.enabled ? colors.bg : 'bg-gray-100'} border ${tool.enabled ? colors.border : 'border-gray-200'}`}>
              <Icon className={`h-5 w-5 ${tool.enabled ? colors.text : 'text-gray-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-900">{tool.name}</h4>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{tool.description}</p>
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <Toggle
              enabled={tool.enabled}
              onChange={() => toggleTool(tool.id)}
            />
          </div>
        </div>

        {/* Expanded details */}
        {selectedTool?.id === tool.id && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" /> Se activa cuando:
              </p>
              <p className="text-sm text-gray-600 mt-1 bg-white/50 rounded-lg px-3 py-2">
                {tool.trigger}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" /> Ejemplo:
              </p>
              <p className="text-sm text-gray-500 italic mt-1 bg-white/50 rounded-lg px-3 py-2">
                {tool.example}
              </p>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flujo del Agente</h1>
          <p className="text-gray-500 text-sm">Visualiza y configura cómo funciona tu asistente</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm">
              <CheckCircle className="h-4 w-4" />
              Guardado
            </div>
          )}
          <div className="px-3 py-1.5 bg-gray-100 rounded-full text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{enabledCount}</span> de {tools.length} tools activos
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('flow')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'flow' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <GitBranch className="h-4 w-4" />
          Flujo Visual
        </button>
        <button
          onClick={() => setActiveTab('tools')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'tools' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Wrench className="h-4 w-4" />
          Herramientas
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'config' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Settings className="h-4 w-4" />
          Configuración
        </button>
      </div>

      {/* Tab: Flow */}
      {activeTab === 'flow' && (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Flow Diagram */}
          <div className="lg:col-span-3">
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 p-8">
              <div className="flex flex-col items-center">
                {FLOW_STEPS.map((step, index) => (
                  <FlowNode 
                    key={step.id} 
                    step={step} 
                    isLast={index === FLOW_STEPS.length - 1}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Flow Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-blue-500" />
                ¿Cómo funciona?
              </h3>
              <div className="space-y-4 text-sm">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">1</div>
                  <p className="text-gray-600">El cliente envía un mensaje por WhatsApp</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-600">2</div>
                  <p className="text-gray-600">La IA analiza el mensaje y detecta la intención</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">3</div>
                  <p className="text-gray-600">Decide si necesita usar una herramienta o solo responder</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">4</div>
                  <p className="text-gray-600">Ejecuta la herramienta necesaria (agendar, consultar, etc.)</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-600">5</div>
                  <p className="text-gray-600">Genera una respuesta amigable y la envía al cliente</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-5">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-500" />
                Tips
              </h3>
              <ul className="text-sm text-blue-700 space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5 text-blue-500" />
                  Activa solo las herramientas que necesites
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5 text-blue-500" />
                  El agente es inteligente y sabe cuándo usar cada tool
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5 text-blue-500" />
                  Configura el prompt para guiar mejor al agente
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Tools */}
      {activeTab === 'tools' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      )}

      {/* Tab: Config */}
      {activeTab === 'config' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Settings className="h-5 w-5 text-gray-500" />
              Comportamiento del Agente
            </h3>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Modo estricto</p>
                  <p className="text-sm text-gray-500">Solo usa tools cuando sea absolutamente necesario</p>
                </div>
                <Toggle enabled={false} onChange={() => {}} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Confirmación antes de agendar</p>
                  <p className="text-sm text-gray-500">Pide confirmación al cliente antes de crear cita</p>
                </div>
                <Toggle enabled={true} onChange={() => {}} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Sugerir horarios alternativos</p>
                  <p className="text-sm text-gray-500">Si no hay espacio, sugiere otros horarios</p>
                </div>
                <Toggle enabled={true} onChange={() => {}} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Logging detallado</p>
                  <p className="text-sm text-gray-500">Registra todas las decisiones del agente</p>
                </div>
                <Toggle enabled={false} onChange={() => {}} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              Tiempos de Respuesta
            </h3>
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Delay antes de responder</label>
                  <span className="text-sm font-semibold text-gray-900">1.5s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  defaultValue="1.5"
                  className="w-full accent-emerald-500"
                />
                <p className="text-xs text-gray-500 mt-1">Simula que el agente está escribiendo</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Timeout de herramientas</label>
                  <span className="text-sm font-semibold text-gray-900">10s</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="5"
                  defaultValue="10"
                  className="w-full accent-emerald-500"
                />
                <p className="text-xs text-gray-500 mt-1">Tiempo máximo para ejecutar una herramienta</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
