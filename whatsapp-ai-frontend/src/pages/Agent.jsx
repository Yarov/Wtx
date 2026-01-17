import { useState, useEffect } from 'react'
import { MessageSquare, Wrench, Settings, Brain, Zap, Loader2 } from 'lucide-react'
import Button from '../components/Button'
import { PersonalityTab, ToolsTab, ModelTab } from '../components/agent'
import { toolsApi, promptApi } from '../api/client'

const DEFAULT_SECTIONS = {
  role: 'Eres un asistente virtual profesional especializado en atención al cliente.',
  context: 'Trabajas para un negocio que atiende clientes via WhatsApp. Tienes acceso a herramientas para agendar citas y consultar inventario.',
  task: 'Tu objetivo es ayudar a los clientes a agendar citas, responder preguntas sobre servicios y precios, y ofrecer una experiencia de atención excepcional.',
  constraints: 'No inventes información. Si no sabes algo, indícalo. No compartas datos de otros clientes. Responde siempre en español.',
  tone: 'Mantén un tono amigable, profesional y cercano. Usa emojis con moderación. Sé conciso pero cálido.',
}

const DEFAULT_CONFIG = {
  model: 'gpt-4o-mini',
  temperature: 0.7,
  max_tokens: 500,
  response_delay: 3,
  business_name: 'Mi Negocio',
  business_type: 'barbería',
}

export default function Agent() {
  const [activeTab, setActiveTab] = useState('personality')
  const [sections, setSections] = useState(DEFAULT_SECTIONS)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load prompt config
      const promptRes = await promptApi.getPrompt()
      if (promptRes.data) {
        if (promptRes.data.prompt_sections) {
          setSections(promptRes.data.prompt_sections)
        }
        setConfig({
          model: promptRes.data.model || DEFAULT_CONFIG.model,
          temperature: promptRes.data.temperature ?? DEFAULT_CONFIG.temperature,
          max_tokens: promptRes.data.max_tokens || DEFAULT_CONFIG.max_tokens,
          response_delay: promptRes.data.response_delay ?? DEFAULT_CONFIG.response_delay,
          business_name: promptRes.data.business_name || DEFAULT_CONFIG.business_name,
          business_type: promptRes.data.business_type || DEFAULT_CONFIG.business_type,
        })
      }
      
      // Load tools
      const toolsRes = await toolsApi.getTools()
      setTools(toolsRes.data.map(t => ({
        id: t.id,
        enabled: t.enabled,
        description: t.description,
      })))
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
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
    setSaving(true)
    try {
      await promptApi.updatePrompt({
        system_prompt: buildFullPrompt(),
        prompt_sections: sections,
        ...config
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error saving:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleTool = async (id) => {
    const tool = tools.find(t => t.id === id)
    const newEnabled = !tool.enabled
    
    // Optimistic update
    setTools(tools.map(t => t.id === id ? { ...t, enabled: newEnabled } : t))
    
    try {
      await toolsApi.toggleTool(id, newEnabled)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Error toggling tool:', error)
      // Revert on error
      setTools(tools.map(t => t.id === id ? { ...t, enabled: !newEnabled } : t))
    }
  }

  const enabledToolsCount = tools.filter(t => t.enabled).length

  const tabs = [
    { 
      id: 'personality', 
      label: 'Personalidad', 
      icon: MessageSquare,
      color: 'violet',
      description: 'Define cómo se comporta tu agente'
    },
    { 
      id: 'tools', 
      label: 'Herramientas', 
      icon: Wrench,
      color: 'blue',
      badge: enabledToolsCount,
      description: 'Capacidades del agente'
    },
    { 
      id: 'model', 
      label: 'Modelo IA', 
      icon: Settings,
      color: 'emerald',
      description: 'Configuración técnica'
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-violet-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Cargando configuración...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración del Agente</h1>
          <p className="text-gray-500 text-sm">Define la personalidad, capacidades y comportamiento de tu IA</p>
        </div>
      </div>

      {/* Sticky Save Bar */}
      <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-200 px-8 py-4 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Los cambios no se guardan automáticamente
          </p>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-sm text-emerald-600 font-medium">
                ✓ Guardado correctamente
              </span>
            )}
            <Button onClick={handleSave} loading={saving}>
              Guardar Cambios
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-3 bg-violet-100 rounded-xl">
            <Brain className="h-6 w-6 text-violet-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{config.model.replace('gpt-', '').replace('-', ' ')}</p>
            <p className="text-sm text-gray-500">Modelo IA</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-3 bg-blue-100 rounded-xl">
            <Wrench className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{enabledToolsCount} de {tools.length}</p>
            <p className="text-sm text-gray-500">Herramientas activas</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-3 bg-emerald-100 rounded-xl">
            <Zap className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{config.temperature}</p>
            <p className="text-sm text-gray-500">Nivel de creatividad</p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 text-sm font-medium transition-all relative ${
                    isActive 
                      ? `text-${tab.color}-600 bg-${tab.color}-50/50` 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? `text-${tab.color}-600` : ''}`} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      isActive 
                        ? `bg-${tab.color}-100 text-${tab.color}-700` 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                  {isActive && (
                    <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-${tab.color}-600`} />
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6 lg:p-8">
          {activeTab === 'personality' && (
            <PersonalityTab
              sections={sections}
              setSections={setSections}
              config={config}
              setConfig={setConfig}
            />
          )}
          
          {activeTab === 'tools' && (
            <ToolsTab
              tools={tools}
              onToggle={handleToggleTool}
            />
          )}
          
          {activeTab === 'model' && (
            <ModelTab
              config={config}
              setConfig={setConfig}
            />
          )}
        </div>
      </div>
    </div>
  )
}
