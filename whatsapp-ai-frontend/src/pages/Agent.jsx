import { useState, useEffect } from 'react'
import { Bot, BookOpen, GitBranch, MessageCircle, Loader2, Check } from 'lucide-react'
import PersonalityTab, {
  buildSectionsFromFicha,
  buildSystemPromptFromSections,
  deriveFichaFromSections,
} from '../components/agent/PersonalityTab'
import TestChat from '../components/agent/TestChat'
import Conocimiento from './Conocimiento'
import Funnel from './Funnel'
import { promptApi, configApi, whatsappApi, conocimientoApi, funnelApi } from '../api/client'

const DEFAULT_FICHA = {
  nombre: '',
  negocio: '',
  tono: 'cercano',
  no_hacer: '',
}

const DEFAULT_CONFIG = {
  model: 'gpt-4o-mini',
  temperature: 0.7,
  max_tokens: 500,
  response_delay: 3,
  business_name: '',
  business_type: '',
}

const DEFAULT_HUMAN = {
  expire_hours: 0,
  reactivar_command: '#reactivar',
  triggers: ['frustration', 'complaint', 'human_request'],
  custom_triggers: '',
}

const TABS = [
  { id: 'personality', label: 'Personalidad', icon: Bot },
  { id: 'knowledge', label: 'Lo que sabe', icon: BookOpen },
  { id: 'journey', label: 'El camino del cliente', icon: GitBranch },
  { id: 'test', label: 'Probar', icon: MessageCircle },
]

export default function Agent() {
  const [activeTab, setActiveTab] = useState('personality')
  const [ficha, setFicha] = useState(DEFAULT_FICHA)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [humanConfig, setHumanConfig] = useState(DEFAULT_HUMAN)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)

    let loadedConfig = { ...DEFAULT_CONFIG }
    let loadedSections = null

    try {
      const res = await promptApi.getPrompt()
      if (res.data) {
        loadedConfig = {
          model: res.data.model || DEFAULT_CONFIG.model,
          temperature: res.data.temperature ?? DEFAULT_CONFIG.temperature,
          max_tokens: res.data.max_tokens || DEFAULT_CONFIG.max_tokens,
          response_delay: res.data.response_delay ?? DEFAULT_CONFIG.response_delay,
          business_name: res.data.business_name || DEFAULT_CONFIG.business_name,
          business_type: res.data.business_type || DEFAULT_CONFIG.business_type,
        }
        loadedSections = res.data.prompt_sections || null
      }
    } catch (e) {
      console.error('Error loading prompt:', e)
    }

    setConfig(loadedConfig)

    const derived = deriveFichaFromSections(loadedSections, loadedConfig)
    setFicha(derived ? { ...DEFAULT_FICHA, ...derived } : DEFAULT_FICHA)

    try {
      const humanRes = await configApi.getHumanModeConfig()
      if (humanRes.data) {
        setHumanConfig((prev) => ({ ...prev, ...humanRes.data }))
      }
    } catch (e) {
      console.error('Error loading human mode config:', e)
    }

    await loadHealth()
    setLoading(false)
  }

  const loadHealth = async () => {
    try {
      const res = await configApi.agentHealth()
      if (res.data && typeof res.data.score === 'number') {
        setHealth(res.data)
        return
      }
    } catch (e) {
      console.error('Error loading agent health:', e)
    }
    // Fallback: compute a simple local score
    await computeFallbackHealth()
  }

  const computeFallbackHealth = async () => {
    const checks = []
    checks.push({ id: 'personality', name: 'Personalidad', ok: !!(ficha.nombre && ficha.negocio) })

    let knowledgeOk = false
    let funnelOk = false
    let whatsappOk = false
    try {
      const docs = await conocimientoApi.list()
      knowledgeOk = (docs.data || []).length > 0
    } catch (_) {}
    try {
      const steps = await funnelApi.getSteps()
      funnelOk = (steps.data || []).length > 0
    } catch (_) {}
    try {
      const st = await whatsappApi.getStatus()
      whatsappOk = ['connected', 'WORKING', 'authenticated'].includes(st.data?.status)
    } catch (_) {}

    checks.push({ id: 'knowledge', name: 'Conocimiento', ok: knowledgeOk })
    checks.push({ id: 'funnel', name: 'Camino del cliente', ok: funnelOk })
    checks.push({ id: 'whatsapp', name: 'WhatsApp conectado', ok: whatsappOk })

    const done = checks.filter((c) => c.ok).length
    const score = Math.round((done / checks.length) * 100)
    setHealth({
      score,
      sections: checks.map((c) => ({ id: c.id, name: c.name, status: c.ok ? 'ok' : 'warning', score: c.ok ? 100 : 0 })),
    })
  }

  // First thing the owner still needs to do.
  const pending = (() => {
    if (!health?.sections) {
      if (!ficha.nombre || !ficha.negocio) return 'darle nombre y describir tu negocio'
      return null
    }
    const labels = {
      identity: 'darle personalidad a tu agente',
      personality: 'darle nombre y describir tu negocio',
      knowledge: 'agregar información de tu negocio',
      funnel: 'definir el camino del cliente',
      capture: 'elegir qué datos capturar',
      ai_config: 'ajustar la configuración del agente',
      human_mode: 'configurar cuándo pasar a humano',
      whatsapp: 'conectar tu WhatsApp',
      tools: 'activar las herramientas del agente',
    }
    const first = health.sections.find((s) => s.status !== 'ok')
    if (!first) return null
    return labels[first.id] || first.name
  })()

  const handleSave = async () => {
    if (activeTab !== 'personality') return
    setSaving(true)
    try {
      const sections = buildSectionsFromFicha(ficha)
      const systemPrompt = buildSystemPromptFromSections(sections)

      await Promise.all([
        promptApi.updatePrompt({
          system_prompt: systemPrompt,
          prompt_sections: sections,
          edit_mode: 'sections',
          model: config.model,
          temperature: config.temperature,
          max_tokens: config.max_tokens,
          response_delay: config.response_delay,
          business_name: ficha.nombre || config.business_name,
          business_type: config.business_type,
        }),
        configApi.updateHumanModeConfig(humanConfig),
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      loadHealth()
    } catch (e) {
      console.error('Error saving:', e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-violet-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Cargando tu agente...</p>
        </div>
      </div>
    )
  }

  const score = health?.score ?? 0

  return (
    <div className="space-y-6 mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tu Agente</h1>
          <p className="text-gray-500 text-sm mt-0.5">Enséñale a atender como lo harías tú</p>
        </div>

        {/* Progress meter */}
        <div className="w-full lg:max-w-sm">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500">Listo para atender</span>
            <span className="text-sm font-bold text-violet-600">{score}%</span>
          </div>
          <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
              style={{ width: `${score}%` }}
            />
          </div>
          {pending ? (
            <p className="text-xs text-gray-500 mt-1.5">
              Te falta: <span className="font-medium text-gray-700">{pending}</span>
            </p>
          ) : (
            <p className="text-xs text-emerald-600 mt-1.5 font-medium">¡Todo listo! Tu agente está completo.</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <nav className="flex gap-6 lg:gap-8 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-violet-600 text-violet-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>

        {activeTab === 'personality' && (
          <div className="hidden sm:flex items-center gap-3 pb-2">
            {saved && (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-600 font-medium">
                <Check className="h-4 w-4" /> Guardado
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 transition-all disabled:opacity-50 shadow-lg shadow-violet-500/25"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </button>
          </div>
        )}
      </div>

      {/* Mobile save button */}
      {activeTab === 'personality' && (
        <div className="sm:hidden">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 transition-all disabled:opacity-50 shadow-lg shadow-violet-500/25"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
            {saved ? 'Guardado' : 'Guardar'}
          </button>
        </div>
      )}

      {/* Content */}
      {activeTab === 'personality' && (
        <PersonalityTab
          ficha={ficha}
          setFicha={setFicha}
          config={config}
          setConfig={setConfig}
          humanConfig={humanConfig}
          setHumanConfig={setHumanConfig}
        />
      )}

      {activeTab === 'knowledge' && <Conocimiento />}

      {activeTab === 'journey' && <Funnel />}

      {activeTab === 'test' && (
        <div className="max-w-2xl">
          <TestChat embedded />
        </div>
      )}
    </div>
  )
}
