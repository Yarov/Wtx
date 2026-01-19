import { useState } from 'react'
import { 
  User, Target, FileText, AlertTriangle, Volume2, 
  ChevronDown, ChevronUp, Loader2, Wand2, RotateCcw,
  Eye, EyeOff, Copy, Check
} from 'lucide-react'
import { promptApi } from '../../api/client'

const PROMPT_SECTIONS = [
  { 
    key: 'role', 
    label: 'Rol del Agente', 
    icon: User, 
    color: 'blue',
    placeholder: 'Ej: Actúa como un asistente profesional de atención al cliente con 10 años de experiencia en el sector de belleza y cuidado personal...',
    description: 'Define quién es el agente, su experiencia y especialización'
  },
  { 
    key: 'context', 
    label: 'Contexto del Negocio', 
    icon: FileText, 
    color: 'purple',
    placeholder: 'Ej: Trabajas para una barbería moderna llamada "BarberShop Pro" ubicada en el centro de la ciudad. Atiendes a clientes via WhatsApp...',
    description: 'Describe el entorno, ubicación y situación del negocio'
  },
  { 
    key: 'task', 
    label: 'Objetivos Principales', 
    icon: Target, 
    color: 'indigo',
    placeholder: 'Ej: Tu objetivo principal es agendar citas, responder preguntas sobre servicios y precios, y ofrecer una experiencia excepcional...',
    description: 'Define las metas y tareas principales del agente'
  },
  { 
    key: 'constraints', 
    label: 'Restricciones y Límites', 
    icon: AlertTriangle, 
    color: 'amber',
    placeholder: 'Ej: Nunca inventes precios o servicios. No hagas promesas que no puedas cumplir. No compartas información de otros clientes...',
    description: 'Establece qué NO debe hacer el agente'
  },
  { 
    key: 'tone', 
    label: 'Tono y Personalidad', 
    icon: Volume2, 
    color: 'pink',
    placeholder: 'Ej: Mantén un tono amigable, profesional y cercano. Usa emojis con moderación. Responde de forma concisa pero cálida...',
    description: 'Define el estilo de comunicación'
  },
]

const DEFAULT_SECTIONS = {
  role: 'Eres un asistente virtual profesional especializado en atención al cliente.',
  context: 'Trabajas para un negocio que atiende clientes via WhatsApp. Tienes acceso a herramientas para agendar citas y consultar inventario.',
  task: 'Tu objetivo es ayudar a los clientes a agendar citas, responder preguntas sobre servicios y precios, y ofrecer una experiencia de atención excepcional.',
  constraints: 'No inventes información. Si no sabes algo, indícalo. No compartas datos de otros clientes. Responde siempre en español.',
  tone: 'Mantén un tono amigable, profesional y cercano. Usa emojis con moderación. Sé conciso pero cálido.',
}

const colorClasses = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200', light: 'bg-blue-50', ring: 'ring-blue-500' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200', light: 'bg-purple-50', ring: 'ring-purple-500' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200', light: 'bg-indigo-50', ring: 'ring-indigo-500' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200', light: 'bg-amber-50', ring: 'ring-amber-500' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-200', light: 'bg-pink-50', ring: 'ring-pink-500' },
}

export default function PersonalityTab({ 
  sections, 
  setSections, 
  config, 
  setConfig,
  onSave 
}) {
  const [expandedSection, setExpandedSection] = useState('role')
  const [improving, setImproving] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState(false)

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

  const copyPrompt = () => {
    navigator.clipboard.writeText(buildFullPrompt())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getColors = (color) => colorClasses[color] || colorClasses.blue

  return (
    <div className="space-y-8">
      {/* Business Info Section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Información del Negocio</h2>
        <p className="text-sm text-gray-500 mb-4">Datos básicos que el agente usará en sus respuestas</p>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre del negocio
            </label>
            <input
              type="text"
              value={config.business_name}
              onChange={(e) => setConfig({ ...config, business_name: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all"
              placeholder="Mi Barbería"
            />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de negocio
            </label>
            <input
              type="text"
              value={config.business_type}
              onChange={(e) => setConfig({ ...config, business_type: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all"
              placeholder="barbería, salón de belleza, spa..."
            />
          </div>
        </div>
      </section>

      {/* Personality Sections */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Personalidad del Agente</h2>
            <p className="text-sm text-gray-500">Define cómo se comporta y comunica tu asistente</p>
          </div>
          
          <button
            onClick={handleImproveAll}
            disabled={improving === 'all'}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-violet-600 hover:to-purple-700 transition-all disabled:opacity-50 shadow-lg shadow-purple-200"
          >
            {improving === 'all' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Mejorar Todo con IA
          </button>
        </div>

        <div className="space-y-3">
          {PROMPT_SECTIONS.map((section, index) => {
            const colors = getColors(section.color)
            const Icon = section.icon
            const isExpanded = expandedSection === section.key
            
            return (
              <div
                key={section.key}
                className={`rounded-xl border-2 transition-all duration-200 ${
                  isExpanded 
                    ? `${colors.border} ${colors.light} shadow-sm` 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : section.key)}
                  className="w-full flex items-center justify-between p-5"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-sm font-medium">
                        {index + 1}
                      </span>
                      <div className={`p-2.5 rounded-xl ${isExpanded ? colors.bg : 'bg-gray-100'}`}>
                        <Icon className={`h-5 w-5 ${isExpanded ? colors.text : 'text-gray-500'}`} />
                      </div>
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">{section.label}</h3>
                      <p className="text-sm text-gray-500">{section.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {sections[section.key] && (
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-500 text-xs rounded-lg font-medium">
                        {sections[section.key].length} caracteres
                      </span>
                    )}
                    <div className={`p-1 rounded-lg ${isExpanded ? colors.bg : 'bg-gray-100'}`}>
                      {isExpanded ? (
                        <ChevronUp className={`h-5 w-5 ${colors.text}`} />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4">
                    <textarea
                      value={sections[section.key]}
                      onChange={(e) => setSections({ ...sections, [section.key]: e.target.value })}
                      placeholder={section.placeholder}
                      rows={4}
                      className={`w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${colors.ring} resize-none transition-all`}
                    />
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setSections({ ...sections, [section.key]: DEFAULT_SECTIONS[section.key] })}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Restaurar original
                      </button>
                      <button
                        onClick={() => handleImprove(section.key)}
                        disabled={improving === section.key}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${colors.bg} ${colors.text} hover:opacity-80 disabled:opacity-50`}
                      >
                        {improving === section.key ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="h-4 w-4" />
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
      </section>

      {/* Preview Section */}
      <section>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
          >
            <div>
              <h3 className="font-semibold text-gray-900">Vista Previa del Prompt Completo</h3>
              <p className="text-sm text-gray-500">Ve cómo se verá el prompt final que usará el agente</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); copyPrompt(); }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-indigo-600" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </button>
          
          {showPreview && (
            <div className="p-5 pt-0">
              <pre className="p-5 bg-gray-900 text-gray-100 rounded-xl text-sm overflow-auto max-h-96 whitespace-pre-wrap font-mono leading-relaxed">
                {buildFullPrompt()}
              </pre>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
