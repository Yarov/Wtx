import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, MessageSquare, Loader2, RotateCcw } from 'lucide-react'
import Button from '../components/Button'
import Toggle from '../components/Toggle'
import { PersonalityTab, SkillsTab, TestChat } from '../components/agent'
import { toolsApi, promptApi, businessApi, configApi } from '../api/client'
import { ConfirmDialog } from '../components/ui'

const DEFAULT_SECTIONS = {
  role: 'Eres un asistente virtual profesional especializado en atención al cliente.',
  context: 'Trabajas para un negocio que atiende clientes via WhatsApp.',
  task: 'Tu objetivo es responder preguntas de los clientes, brindar información sobre el negocio y ofrecer una experiencia de atención excepcional.',
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
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('skills')
  const [sections, setSections] = useState(DEFAULT_SECTIONS)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [tools, setTools] = useState([])
  const [skills, setSkills] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)
  const [humanModeConfig, setHumanModeConfig] = useState({
    expire_hours: 0,
    reactivar_command: '#reactivar',
    triggers: ['frustration', 'complaint', 'human_request'],
    custom_triggers: '',
  })
  const [editMode, setEditMode] = useState('sections')
  const [manualPrompt, setManualPrompt] = useState('')

  const handleRestartOnboarding = async () => {
    setShowRestartConfirm(false)
    try {
      await businessApi.restartOnboarding()
      navigate('/setup')
    } catch (error) {
      console.error('Error restarting onboarding:', error)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)

    try {
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
        if (promptRes.data.edit_mode) {
          setEditMode(promptRes.data.edit_mode)
        }
        if (promptRes.data.manual_prompt) {
          setManualPrompt(promptRes.data.manual_prompt)
        }
      }
    } catch (error) {
      console.error('Error loading prompt:', error)
    }

    try {
      const toolsRes = await toolsApi.getTools()
      setTools(toolsRes.data.map(t => ({
        id: t.id,
        enabled: t.enabled,
        description: t.description,
      })))
    } catch (error) {
      console.error('Error loading tools:', error)
    }

    try {
      const humanRes = await configApi.getHumanModeConfig()
      if (humanRes.data) {
        setHumanModeConfig(prev => ({ ...prev, ...humanRes.data }))
      }
    } catch (error) {
      console.error('Error loading human mode config:', error)
    }

    try {
      const skillsRes = await configApi.getSkillsStatus()
      if (skillsRes.data) {
        setSkills(skillsRes.data.skills || {})
        if (skillsRes.data.orchestrator_mode !== undefined) {
          setConfig(prev => ({ ...prev, orchestrator_mode: skillsRes.data.orchestrator_mode }))
        }
      }
    } catch (error) {
      console.error('Error loading skills status:', error)
    }

    setLoading(false)
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
      const systemPrompt = editMode === 'manual' ? manualPrompt : buildFullPrompt()

      await Promise.all([
        promptApi.updatePrompt({
          system_prompt: systemPrompt,
          prompt_sections: sections,
          edit_mode: editMode,
          manual_prompt: manualPrompt,
          ...config
        }),
        configApi.updateHumanModeConfig(humanModeConfig)
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error saving:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleSkill = async (skillName) => {
    const skill = skills[skillName]
    if (!skill) return

    const newEnabled = !skill.enabled

    const SKILL_TO_TOOL = {}

    const toolId = SKILL_TO_TOOL[skillName]
    if (!toolId) return

    setSkills(prev => ({
      ...prev,
      [skillName]: { ...prev[skillName], enabled: newEnabled }
    }))

    try {
      await toolsApi.toggleTool(toolId, newEnabled)
      window.dispatchEvent(new Event('modules-changed'))
    } catch (error) {
      console.error('Error toggling skill:', error)
      setSkills(prev => ({
        ...prev,
        [skillName]: { ...prev[skillName], enabled: !newEnabled }
      }))
    }
  }

  const tabs = [
    { id: 'skills', label: 'Skills', icon: Zap },
    { id: 'personality', label: 'Personalidad', icon: MessageSquare },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Cargando configuracion...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agente IA</h1>
          <p className="text-gray-500 text-sm">Configura el comportamiento y capacidades de tu agente</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-indigo-600 font-medium">
              Guardado
            </span>
          )}
          <Button onClick={handleSave} loading={saving}>
            {saved ? 'Guardado' : 'Guardar'}
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'skills' && (
        <SkillsTab
          skills={skills}
          onToggleSkill={handleToggleSkill}
          humanConfig={humanModeConfig}
          setHumanConfig={setHumanModeConfig}
        />
      )}

      {activeTab === 'personality' && (
        <div className="space-y-8">
          <PersonalityTab
            sections={sections}
            setSections={setSections}
            config={config}
            setConfig={setConfig}
            manualPrompt={manualPrompt}
            setManualPrompt={setManualPrompt}
            editMode={editMode}
            setEditMode={setEditMode}
          />

          {/* Model Settings Inline */}
          <div className="border-t border-gray-200 pt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Modelo y Parametros</h2>
            <p className="text-sm text-gray-500 mb-6">Configuracion tecnica del agente</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Model Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Modelo</label>
                <select
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini (rapido, economico)</option>
                  <option value="gpt-4o">GPT-4o (mas inteligente)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo (alta capacidad)</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (basico)</option>
                </select>
              </div>

              {/* Temperature */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Creatividad: {config.temperature}
                </label>
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={config.temperature}
                  onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between mt-1 text-xs text-gray-400">
                  <span>Preciso</span>
                  <span>Creativo</span>
                </div>
              </div>

              {/* Max Tokens */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Largo maximo: {config.max_tokens} tokens
                </label>
                <input
                  type="range" min="100" max="2000" step="100"
                  value={config.max_tokens}
                  onChange={(e) => setConfig({ ...config, max_tokens: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between mt-1 text-xs text-gray-400">
                  <span>Corto</span>
                  <span>Largo</span>
                </div>
              </div>

              {/* Response Delay */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Espera antes de responder: {config.response_delay}s
                </label>
                <input
                  type="range" min="0" max="10" step="1"
                  value={config.response_delay || 3}
                  onChange={(e) => setConfig({ ...config, response_delay: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between mt-1 text-xs text-gray-400">
                  <span>Inmediato</span>
                  <span>10s</span>
                </div>
              </div>
            </div>

            {/* Spacer */}
            <div className="mt-6">
            </div>
          </div>

          {/* Restart Onboarding */}
          <div className="border-t border-gray-200 pt-6">
            <button
              onClick={() => setShowRestartConfirm(true)}
              className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reiniciar asistente de configuracion
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showRestartConfirm}
        onClose={() => setShowRestartConfirm(false)}
        onConfirm={handleRestartOnboarding}
        title="Reiniciar configuracion?"
        message="Esto te llevara al asistente de configuracion inicial. Tu configuracion actual se mantendra hasta que la modifiques."
        confirmText="Reiniciar"
        cancelText="Cancelar"
        variant="warning"
      />

      {/* Test Chat Widget */}
      <TestChat />
    </div>
  )
}
