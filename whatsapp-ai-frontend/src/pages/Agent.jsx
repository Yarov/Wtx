import { useState, useEffect } from 'react'
import {
  Bot, BookOpen, UserRound, MessageCircle, Loader2, Check,
  ChevronDown, Settings2, X, ListChecks, ShieldAlert,
} from 'lucide-react'
import {
  FichaSection,
  CaptureFieldsSection,
  HumanModeSection,
  AdvancedSettingsSection,
  buildSectionsFromFicha,
  buildSystemPromptFromSections,
  deriveFichaFromSections,
} from '../components/agent/PersonalityTab'
import TestChat from '../components/agent/TestChat'
import Conocimiento from './Conocimiento'
import { useAuth } from '../contexts/AuthContext'
import { promptApi, configApi, whatsappApi, conocimientoApi, captureApi } from '../api/client'

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

/* Encabezado de sección numerada */
function SectionHeader({ n, icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-white border border-violet-200 text-violet-600 text-[11px] font-bold flex items-center justify-center shadow-sm">
          {n}
        </span>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

export default function Agent() {
  const { perfilActivo } = useAuth()
  const [ficha, setFicha] = useState(DEFAULT_FICHA)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [humanConfig, setHumanConfig] = useState(DEFAULT_HUMAN)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [testOpen, setTestOpen] = useState(false)

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
    let captureOk = false
    let whatsappOk = false
    try {
      const docs = await conocimientoApi.list()
      knowledgeOk = (docs.data || []).length > 0
    } catch (_) {}
    try {
      const f = await captureApi.getFields()
      captureOk = (f.data || []).length > 0
    } catch (_) {}
    try {
      const st = await whatsappApi.getStatus()
      whatsappOk = ['connected', 'WORKING', 'authenticated'].includes(st.data?.status)
    } catch (_) {}

    checks.push({ id: 'knowledge', name: 'Conocimiento', ok: knowledgeOk })
    checks.push({ id: 'capture', name: 'Datos a reunir', ok: captureOk })
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
      identity: 'darle personalidad a tu asistente',
      personality: 'darle nombre y describir tu negocio',
      knowledge: 'agregar información de tu negocio',
      capture: 'elegir qué datos debe reunir antes de pasarte la conversación',
      ai_config: 'ajustar la configuración del asistente',
      human_mode: 'configurar cuándo pasar a humano',
      whatsapp: 'conectar tu WhatsApp',
      tools: 'activar las herramientas del asistente',
    }
    const first = health.sections.find((s) => s.status !== 'ok')
    if (!first) return null
    return labels[first.id] || first.name
  })()

  const handleSave = async () => {
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
          <p className="text-gray-500">Cargando tu asistente...</p>
        </div>
      </div>
    )
  }

  const score = health?.score ?? 0

  return (
    <div className="max-w-3xl mx-auto pb-16">
      {/* ─── Header ─── */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">Tu Agente</h1>
              {perfilActivo && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-100 text-violet-700 text-xs font-medium">
                  <span className="text-sm leading-none">{perfilActivo.emoji || '📱'}</span>
                  <span className="max-w-[140px] truncate">{perfilActivo.nombre}</span>
                </span>
              )}
            </div>
            <p className="text-gray-500 text-sm mt-1">
              Atiende el primer contacto, reúne los datos clave y te pasa la conversación
            </p>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 shrink-0">
            {saved && (
              <span className="hidden sm:inline-flex items-center gap-1 text-sm text-emerald-600 font-medium">
                <Check className="h-4 w-4" /> Guardado
              </span>
            )}
            <button
              onClick={() => setTestOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              Probar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 transition-all disabled:opacity-50 shadow-lg shadow-violet-500/25"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </button>
          </div>
        </div>

        {/* Medidor de progreso */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
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
            <p className="text-xs text-emerald-600 mt-1.5 font-medium">¡Todo listo! Tu asistente está completo.</p>
          )}
        </div>
      </div>

      {/* ─── Sección 1 ─── */}
      <section className="mt-12">
        <SectionHeader
          n={1}
          icon={Bot}
          title="¿Quién es tu asistente?"
          subtitle="Cuéntale lo básico. Con esto sabrá cómo presentarse y atender a tus clientes."
        />
        <FichaSection ficha={ficha} setFicha={setFicha} config={config} setConfig={setConfig} />
      </section>

      {/* ─── Sección 2 ─── */}
      <section className="mt-14 border-t border-gray-200 pt-10">
        <SectionHeader
          n={2}
          icon={BookOpen}
          title="¿Qué debe saber para responder?"
          subtitle="Las preguntas y datos de tu negocio que tu asistente usa para responder bien."
        />
        <Conocimiento />
      </section>

      {/* ─── Sección 3 ─── */}
      <section className="mt-14 border-t border-gray-200 pt-10">
        <SectionHeader
          n={3}
          icon={UserRound}
          title="¿Cuándo te paso la conversación a ti?"
          subtitle="El asistente atiende el primer contacto y filtra. Cuando reúne los datos clave —o el cliente lo necesita— te pasa la conversación."
        />

        {/* 3a — Datos que el agente reúne antes de pasártelo */}
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
              <ListChecks className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Datos que el agente reúne antes de pasártelo
              </h3>
              <p className="text-sm text-gray-500">
                Los datos mínimos que necesitas de cada cliente. Al tenerlos, te paso la conversación.
              </p>
            </div>
          </div>
          <CaptureFieldsSection />
        </div>

        {/* 3b — Además, pásame al cliente si… */}
        <div className="mt-10 pt-8 border-t border-gray-100 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Además, pásame al cliente si…
              </h3>
              <p className="text-sm text-gray-500">
                Si pasa algo de esto, el asistente deja de responder y te avisa de inmediato.
              </p>
            </div>
          </div>
          <HumanModeSection humanConfig={humanConfig} setHumanConfig={setHumanConfig} />
        </div>
      </section>

      {/* ─── Sección final: Pruébalo ─── */}
      <section id="probar" className="mt-14 border-t border-gray-200 pt-10">
        <SectionHeader
          n={4}
          icon={MessageCircle}
          title="Pruébalo"
          subtitle="Escribe como si fueras un cliente y mira cómo responde tu asistente."
        />
        <TestChat embedded />
      </section>

      {/* ─── Opciones avanzadas ─── */}
      <section className="mt-12">
        <details
          className="rounded-2xl border border-gray-200 bg-white overflow-hidden"
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
        >
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none select-none hover:bg-gray-50 transition-colors">
            <span className="flex items-center gap-2.5 text-sm font-medium text-gray-700">
              <Settings2 className="h-4 w-4 text-gray-400" />
              Opciones avanzadas
            </span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          </summary>

          <div className="px-5 pb-8 pt-2 border-t border-gray-100">
            {/* Ajustes técnicos */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">Ajustes técnicos</h3>
              <p className="text-sm text-gray-500 mb-5">
                Solo si quieres afinar cómo responde. Los valores recomendados ya están listos.
              </p>
              <AdvancedSettingsSection config={config} setConfig={setConfig} />
            </div>
          </div>
        </details>
      </section>

      {/* ─── Panel de prueba (lateral) ─── */}
      {testOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setTestOpen(false)} />
          <div
            className="fixed top-0 right-0 h-full w-full max-w-md bg-gray-50 shadow-2xl z-50 flex flex-col"
            style={{ animation: 'slideIn 0.2s ease-out' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-white">
              <h3 className="font-semibold text-gray-900">Probar tu asistente</h3>
              <button
                onClick={() => setTestOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <TestChat embedded />
            </div>
          </div>
          <style>{`
            @keyframes slideIn {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </>
      )}
    </div>
  )
}
