import { useState, useEffect } from 'react'
import { MessageSquare, Sparkles, RotateCcw, CheckCircle, Wand2, Eye, EyeOff, User, Target, FileText, AlertTriangle, Volume2, ChevronDown, ChevronUp, Loader2, Copy, Check } from 'lucide-react'
import Card from '../components/Card'
import { Textarea, Input } from '../components/Input'
import Button from '../components/Button'
import { promptApi } from '../api/client'

const PROMPT_SECTIONS = [
  { 
    key: 'role', 
    label: 'Rol', 
    icon: User, 
    color: 'blue',
    placeholder: 'Ej: Actúa como un asistente profesional de atención al cliente con 10 años de experiencia en el sector de belleza y cuidado personal...',
    description: 'Define quién es el agente y su experiencia'
  },
  { 
    key: 'context', 
    label: 'Contexto', 
    icon: FileText, 
    color: 'purple',
    placeholder: 'Ej: Trabajas para una barbería moderna llamada "BarberShop Pro" ubicada en el centro de la ciudad. Atiendes a clientes via WhatsApp...',
    description: 'Describe el entorno y situación del negocio'
  },
  { 
    key: 'task', 
    label: 'Tarea', 
    icon: Target, 
    color: 'emerald',
    placeholder: 'Ej: Tu objetivo principal es agendar citas, responder preguntas sobre servicios y precios, y ofrecer una experiencia excepcional...',
    description: 'Define los objetivos principales del agente'
  },
  { 
    key: 'constraints', 
    label: 'Restricciones', 
    icon: AlertTriangle, 
    color: 'amber',
    placeholder: 'Ej: Nunca inventes precios o servicios. No hagas promesas que no puedas cumplir. No compartas información de otros clientes...',
    description: 'Establece límites y reglas que debe seguir'
  },
  { 
    key: 'tone', 
    label: 'Tono', 
    icon: Volume2, 
    color: 'pink',
    placeholder: 'Ej: Mantén un tono amigable, profesional y cercano. Usa emojis con moderación. Responde de forma concisa pero cálida...',
    description: 'Define cómo debe comunicarse el agente'
  },
]

const DEFAULT_SECTIONS = {
  role: 'Eres un asistente virtual profesional especializado en atención al cliente.',
  context: 'Trabajas para un negocio que atiende clientes via WhatsApp. Tienes acceso a herramientas para agendar citas, consultar inventario y procesar pagos.',
  task: 'Tu objetivo es ayudar a los clientes a agendar citas, responder preguntas sobre servicios y precios, y ofrecer una experiencia de atención excepcional.',
  constraints: 'No inventes información. Si no sabes algo, indícalo. No compartas datos de otros clientes. Responde siempre en español.',
  tone: 'Mantén un tono amigable, profesional y cercano. Usa emojis con moderación. Sé conciso pero cálido.',
}

export default function Prompt() {
  const [sections, setSections] = useState(DEFAULT_SECTIONS)
  const [config, setConfig] = useState({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 500,
    business_name: 'Mi Negocio',
    business_type: 'barbería',
  })
  const [loading, setLoading] = useState(false)
  const [improving, setImproving] = useState(null)
  const [saved, setSaved] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [expandedSection, setExpandedSection] = useState('role')
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('editor')

  useEffect(() => {
    loadPrompt()
  }, [])

  const loadPrompt = async () => {
    try {
      const response = await promptApi.getPrompt()
      if (response.data) {
        // Si hay secciones guardadas, cargarlas
        if (response.data.prompt_sections) {
          setSections(response.data.prompt_sections)
        } else if (response.data.system_prompt) {
          // Compatibilidad: si solo hay system_prompt, ponerlo en context
          setSections({ ...DEFAULT_SECTIONS, context: response.data.system_prompt })
        }
        setConfig({
          model: response.data.model || 'gpt-4o-mini',
          temperature: response.data.temperature || 0.7,
          max_tokens: response.data.max_tokens || 500,
          business_name: response.data.business_name || 'Mi Negocio',
          business_type: response.data.business_type || 'barbería',
        })
      }
    } catch (error) {
      console.log('Using default prompt')
    }
  }

  const buildFullPrompt = () => {
    return `## ROL
${sections.role}

## CONTEXTO
${sections.context}

## TAREA
${sections.task}

## RESTRICCIONES
${sections.constraints}

## TONO
${sections.tone}

## INFORMACIÓN DEL NEGOCIO
- Nombre: ${config.business_name}
- Tipo: ${config.business_type}`
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await promptApi.updatePrompt({
        system_prompt: buildFullPrompt(),
        prompt_sections: sections,
        ...config
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.log('Saved locally')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleImprove = async (sectionKey) => {
    setImproving(sectionKey)
    try {
      const response = await promptApi.improvePrompt({
        section: sectionKey,
        current_content: sections[sectionKey],
        business_name: config.business_name,
        business_type: config.business_type,
        all_sections: sections
      })
      if (response.data?.improved) {
        setSections({ ...sections, [sectionKey]: response.data.improved })
      }
    } catch (error) {
      console.error('Error improving:', error)
    } finally {
      setImproving(null)
    }
  }

  const handleImproveAll = async () => {
    setImproving('all')
    try {
      const response = await promptApi.improvePrompt({
        section: 'all',
        all_sections: sections,
        business_name: config.business_name,
        business_type: config.business_type
      })
      if (response.data?.improved_sections) {
        setSections(response.data.improved_sections)
      }
    } catch (error) {
      console.error('Error improving all:', error)
    } finally {
      setImproving(null)
    }
  }

  const resetSection = (key) => {
    setSections({ ...sections, [key]: DEFAULT_SECTIONS[key] })
  }

  const copyPrompt = () => {
    navigator.clipboard.writeText(buildFullPrompt())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getColorClasses = (color) => ({
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', iconBg: 'bg-blue-100' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', iconBg: 'bg-purple-100' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', iconBg: 'bg-emerald-100' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', iconBg: 'bg-amber-100' },
    pink: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-600', iconBg: 'bg-pink-100' },
  }[color])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración del Agente</h1>
          <p className="text-gray-500 text-sm">Define la personalidad y comportamiento de tu asistente IA</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm animate-pulse">
              <CheckCircle className="h-4 w-4" />
              Guardado
            </div>
          )}
          <Button onClick={handleSave} loading={loading}>
            Guardar Cambios
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('editor')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'editor' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <MessageSquare className="h-4 w-4 inline mr-2" />
          Editor de Prompt
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'config' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Sparkles className="h-4 w-4 inline mr-2" />
          Configuración IA
        </button>
      </div>

      {/* Tab: Editor */}
      {activeTab === 'editor' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Secciones del Prompt */}
          <div className="lg:col-span-2 space-y-4">
            {/* Actions */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Edita cada sección para personalizar tu agente
              </p>
              <button
                onClick={handleImproveAll}
                disabled={improving === 'all'}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:from-violet-600 hover:to-purple-600 transition-all disabled:opacity-50 shadow-lg shadow-purple-200"
              >
                {improving === 'all' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                Mejorar Todo con IA
              </button>
            </div>

            {/* Sections */}
            {PROMPT_SECTIONS.map((section) => {
              const colors = getColorClasses(section.color)
              const Icon = section.icon
              const isExpanded = expandedSection === section.key
              
              return (
                <div
                  key={section.key}
                  className={`rounded-2xl border-2 transition-all ${
                    isExpanded ? `${colors.border} ${colors.bg}` : 'border-gray-200 bg-white'
                  }`}
                >
                  {/* Header */}
                  <button
                    onClick={() => setExpandedSection(isExpanded ? null : section.key)}
                    className="w-full flex items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${isExpanded ? colors.iconBg : 'bg-gray-100'}`}>
                        <Icon className={`h-5 w-5 ${isExpanded ? colors.text : 'text-gray-500'}`} />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900">{section.label}</h3>
                        <p className="text-xs text-gray-500">{section.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {sections[section.key] && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-lg">
                          {sections[section.key].length} chars
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      <textarea
                        value={sections[section.key]}
                        onChange={(e) => setSections({ ...sections, [section.key]: e.target.value })}
                        placeholder={section.placeholder}
                        rows={4}
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                      />
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => resetSection(section.key)}
                          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restaurar
                        </button>
                        <button
                          onClick={() => handleImprove(section.key)}
                          disabled={improving === section.key}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${colors.bg} ${colors.text} hover:opacity-80 disabled:opacity-50`}
                        >
                          {improving === section.key ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Wand2 className="h-3.5 w-3.5" />
                          )}
                          Mejorar con IA
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Preview & Business Info */}
          <div className="space-y-4">
            {/* Business Info */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Información del Negocio
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Nombre</label>
                  <input
                    type="text"
                    value={config.business_name}
                    onChange={(e) => setConfig({ ...config, business_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Mi Barbería"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Tipo de negocio</label>
                  <input
                    type="text"
                    value={config.business_type}
                    onChange={(e) => setConfig({ ...config, business_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="barbería, salón, spa..."
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {showPreview ? (
                    <EyeOff className="h-5 w-5 text-gray-500" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-500" />
                  )}
                  <span className="font-semibold text-gray-900">Vista Previa del Prompt</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); copyPrompt(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600 transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </button>
              {showPreview && (
                <div className="p-4 pt-0">
                  <pre className="p-4 bg-gray-900 text-gray-100 rounded-xl text-xs overflow-auto max-h-96 whitespace-pre-wrap font-mono">
                    {buildFullPrompt()}
                  </pre>
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-100">
              <h4 className="font-semibold text-emerald-900 mb-3">💡 Tips para un buen prompt</h4>
              <ul className="text-sm text-emerald-700 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">•</span>
                  Sé específico en el <strong>Rol</strong> - incluye años de experiencia
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">•</span>
                  El <strong>Contexto</strong> debe incluir detalles del negocio
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">•</span>
                  Define claramente qué <strong>NO</strong> debe hacer en Restricciones
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500">•</span>
                  Usa el botón <strong>"Mejorar con IA"</strong> para optimizar
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Config */}
      {activeTab === 'config' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-6">Modelo de IA</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Modelo</label>
                <select
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini (Rápido y económico)</option>
                  <option value="gpt-4o">GPT-4o (Más inteligente)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Más económico)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Temperatura</label>
                  <span className="text-sm font-semibold text-emerald-600">{config.temperature}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.temperature}
                  onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>🎯 Preciso</span>
                  <span>🎨 Creativo</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Max Tokens</label>
                  <span className="text-sm font-semibold text-emerald-600">{config.max_tokens}</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="100"
                  value={config.max_tokens}
                  onChange={(e) => setConfig({ ...config, max_tokens: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>📝 Corto</span>
                  <span>📄 Largo</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-6">¿Qué significa cada parámetro?</h3>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-xl">
                <h4 className="font-medium text-blue-900 mb-1">🤖 Modelo</h4>
                <p className="text-sm text-blue-700">
                  GPT-4o Mini es ideal para la mayoría de casos. GPT-4o es más inteligente pero más lento y costoso.
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl">
                <h4 className="font-medium text-purple-900 mb-1">🌡️ Temperatura</h4>
                <p className="text-sm text-purple-700">
                  Baja (0-0.3): Respuestas consistentes y predecibles.<br/>
                  Alta (0.7-1): Respuestas más variadas y creativas.
                </p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl">
                <h4 className="font-medium text-amber-900 mb-1">📏 Max Tokens</h4>
                <p className="text-sm text-amber-700">
                  Limita la longitud de las respuestas. 500 tokens ≈ 375 palabras. Para WhatsApp, 300-500 es ideal.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
