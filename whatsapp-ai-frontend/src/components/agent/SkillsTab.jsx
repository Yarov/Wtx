import { useState, useEffect } from 'react'
import {
  ClipboardList, BookOpen, UserRound,
  AlertTriangle, Check, ChevronDown, ChevronUp, Plus, Trash2, X
} from 'lucide-react'
import Toggle from '../Toggle'
import { captureApi } from '../../api/client'

const TOGGLEABLE_SKILLS = []

const ALWAYS_ON_SKILLS = [
  { key: 'data_capture', name: 'Captura de Datos', icon: ClipboardList, color: 'emerald', description: 'Extrae datos del cliente' },
  { key: 'faq', name: 'Conocimiento', icon: BookOpen, color: 'amber', description: 'Responde con documentos del negocio' },
  { key: 'human_handoff', name: 'Modo Humano', icon: UserRound, color: 'orange', description: 'Transfiere a asesor humano' },
]

const C = {
  blue:    { border: 'border-l-blue-500',    bg: 'bg-blue-50',    bgTint: 'bg-blue-50/30',    text: 'text-blue-600',    ring: 'ring-blue-200'    },
  violet:  { border: 'border-l-violet-500',  bg: 'bg-violet-50',  bgTint: 'bg-violet-50/30',  text: 'text-violet-600',  ring: 'ring-violet-200'  },
  rose:    { border: 'border-l-rose-500',    bg: 'bg-rose-50',    bgTint: 'bg-rose-50/30',    text: 'text-rose-600',    ring: 'ring-rose-200'    },
  emerald: { border: 'border-l-emerald-500', bg: 'bg-emerald-50', bgTint: 'bg-emerald-50/30', text: 'text-emerald-600', ring: 'ring-emerald-200' },
  amber:   { border: 'border-l-amber-500',   bg: 'bg-amber-50',   bgTint: 'bg-amber-50/30',   text: 'text-amber-600',   ring: 'ring-amber-200'   },
  orange:  { border: 'border-l-orange-500',  bg: 'bg-orange-50',  bgTint: 'bg-orange-50/30',  text: 'text-orange-600',  ring: 'ring-orange-200'  },
}

const SIDEBAR_META = {
  data_capture: { title: 'Captura de Datos', subtitle: 'Configura que datos extraer', icon: ClipboardList, color: 'emerald' },
  faq: { title: 'Conocimiento', subtitle: 'Documentos del negocio', icon: BookOpen, color: 'amber' },
  human_handoff: { title: 'Modo Humano', subtitle: 'Configura cuando transferir', icon: UserRound, color: 'orange' },
}

const HUMAN_TRIGGERS = [
  { id: 'frustration', label: 'Frustracion', desc: 'Enojo o molestia' },
  { id: 'complaint', label: 'Quejas', desc: 'Problemas con servicio' },
  { id: 'human_request', label: 'Solicitud directa', desc: '"Quiero hablar con alguien"' },
  { id: 'urgency', label: 'Urgencia', desc: 'Atencion inmediata' },
  { id: 'complexity', label: 'Caso complejo', desc: 'IA no puede resolver' },
  { id: 'negotiation', label: 'Negociacion', desc: 'Descuentos, precios' },
]

// ─── Inline config: FAQ / Conocimiento ──────────────────────────────

function FaqConfig() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadDocs() }, [])

  const loadDocs = async () => {
    try {
      const { conocimientoApi } = await import('../../api/client')
      const res = await conocimientoApi.list()
      setDocs(res.data || [])
    } catch (e) {
      console.error('Error loading docs:', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-400 py-2">Cargando documentos...</p>

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Documentos que el agente usa para responder preguntas.
      </p>

      {docs.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No hay documentos configurados</p>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
              <div>
                <span className="text-sm font-medium text-gray-700">{doc.titulo || doc.title}</span>
                {(doc.categoria || doc.category) && (
                  <span className="text-xs text-gray-400 ml-2">{doc.categoria || doc.category}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <a
        href="/conocimiento"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-800 transition-colors"
      >
        Ir a base de conocimiento
        <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
      </a>
    </div>
  )
}

// ─── Inline config: Data Capture ────────────────────────────────────

function DataCaptureConfig() {
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [newField, setNewField] = useState('')

  useEffect(() => { loadFields() }, [])

  const loadFields = async () => {
    try {
      const res = await captureApi.getFields()
      setFields(res.data || [])
    } catch (e) {
      console.error('Error loading capture fields:', e)
    } finally {
      setLoading(false)
    }
  }

  const toggleField = async (field) => {
    try {
      await captureApi.updateField(field.id, { ...field, activo: !field.activo })
      setFields(fields.map(f => f.id === field.id ? { ...f, activo: !f.activo } : f))
    } catch (e) {
      console.error('Error toggling field:', e)
    }
  }

  const addField = async () => {
    if (!newField.trim()) return
    try {
      const res = await captureApi.createField({
        nombre: newField.trim().toLowerCase().replace(/\s+/g, '_'),
        etiqueta: newField.trim(),
        tipo: 'texto',
        obligatorio: false,
        activo: true,
      })
      setFields([...fields, res.data])
      setNewField('')
    } catch (e) {
      console.error('Error adding field:', e)
    }
  }

  const deleteField = async (id) => {
    try {
      await captureApi.deleteField(id)
      setFields(fields.filter(f => f.id !== id))
    } catch (e) {
      console.error('Error deleting field:', e)
    }
  }

  if (loading) return <p className="text-sm text-gray-400 py-2">Cargando campos...</p>

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Elige que datos capturar del cliente. Desactiva todo si no quieres guardar datos por privacidad.
      </p>

      {fields.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No hay campos configurados</p>
      ) : (
        <div className="space-y-2">
          {fields.map(field => (
            <div key={field.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-gray-50">
              <div className="flex items-center gap-3">
                <Toggle
                  enabled={field.activo}
                  onChange={() => toggleField(field)}
                />
                <span className={`text-sm ${field.activo ? 'text-gray-700' : 'text-gray-400'}`}>
                  {field.etiqueta}
                </span>
                {field.obligatorio && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                    Requerido
                  </span>
                )}
              </div>
              {!field.obligatorio && (
                <button
                  onClick={() => deleteField(field.id)}
                  className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={newField}
          onChange={(e) => setNewField(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addField()}
          placeholder="Nuevo campo (ej: empresa, ciudad)"
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
        />
        <button
          onClick={addField}
          disabled={!newField.trim()}
          className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Inline config: Human Handoff ───────────────────────────────────

function HumanHandoffConfig({ humanConfig, setHumanConfig }) {
  if (!humanConfig) return null

  const toggleTrigger = (triggerId) => {
    const current = humanConfig.triggers || []
    const updated = current.includes(triggerId)
      ? current.filter(t => t !== triggerId)
      : [...current, triggerId]
    setHumanConfig({ ...humanConfig, triggers: updated })
  }

  const addCustomTrigger = (e) => {
    if (e.key !== 'Enter') return
    const value = e.target.value.trim()
    if (!value) return
    const current = humanConfig.custom_triggers
      ? humanConfig.custom_triggers.split(',').filter(t => t.trim())
      : []
    if (!current.includes(value)) {
      setHumanConfig({
        ...humanConfig,
        custom_triggers: [...current, value].join(',')
      })
    }
    e.target.value = ''
  }

  const removeCustomTrigger = (idx) => {
    const tags = humanConfig.custom_triggers.split(',').filter(t => t.trim())
    tags.splice(idx, 1)
    setHumanConfig({ ...humanConfig, custom_triggers: tags.join(',') })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-500 mb-2">Cuando el cliente exprese esto, se transfiere a un humano:</p>
        <div className="grid grid-cols-2 gap-2">
          {HUMAN_TRIGGERS.map(trigger => (
            <label
              key={trigger.id}
              className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                (humanConfig.triggers || []).includes(trigger.id)
                  ? 'border-orange-300 bg-orange-50 text-orange-800'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={(humanConfig.triggers || []).includes(trigger.id)}
                onChange={() => toggleTrigger(trigger.id)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <div>
                <span className="font-medium">{trigger.label}</span>
                <span className="text-xs text-gray-400 block">{trigger.desc}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-2">Palabras clave adicionales:</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(humanConfig.custom_triggers || '').split(',').filter(t => t.trim()).map((tag, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
              {tag.trim()}
              <button onClick={() => removeCustomTrigger(idx)} className="hover:bg-orange-200 rounded-full p-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          placeholder="Escribe y presiona Enter..."
          onKeyDown={addCustomTrigger}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
        />
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-600 block mb-1">Expira en (horas)</label>
          <input
            type="number" min="0"
            value={humanConfig.expire_hours || 0}
            onChange={(e) => setHumanConfig({ ...humanConfig, expire_hours: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
          />
          <p className="text-[10px] text-gray-400 mt-1">0 = sin expiracion</p>
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-600 block mb-1">Comando reactivar</label>
          <input
            type="text"
            value={humanConfig.reactivar_command || '#reactivar'}
            onChange={(e) => setHumanConfig({ ...humanConfig, reactivar_command: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Status Line ────────────────────────────────────────────────────

function SkillStatus({ skill, toggleable }) {
  const isActive = skill?.enabled || !toggleable
  if (!isActive) return null

  if (toggleable && !skill?.config_complete) {
    return (
      <div className="flex items-center gap-1.5 text-amber-600 mt-3">
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="text-sm">Requiere configuracion</span>
      </div>
    )
  }

  if (skill?.summary || skill?.detail) {
    return (
      <div className="mt-3 space-y-1">
        {skill.summary && (
          <div className="flex items-center gap-1.5 text-gray-700">
            <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
            <span className="text-sm font-medium">{skill.summary}</span>
          </div>
        )}
        {skill.detail && (
          <span className="text-xs text-gray-500 ml-5 block">{skill.detail}</span>
        )}
      </div>
    )
  }
  return null
}

// ─── Main Component ─────────────────────────────────────────────────

export default function SkillsTab({ skills, onToggleSkill, humanConfig, setHumanConfig }) {
  const [expandedSkill, setExpandedSkill] = useState(null)

  const toggleExpand = (key) => {
    setExpandedSkill(expandedSkill === key ? null : key)
  }

  return (
    <div className="space-y-8">
      {/* Section 1: Capacidades (toggleable) */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Capacidades</h2>
        <p className="text-sm text-gray-500 mt-1">Habilidades que puedes activar o desactivar</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {TOGGLEABLE_SKILLS.map((meta) => {
            const skill = skills[meta.key]
            const isDisabled = !skill?.enabled
            const Icon = meta.icon
            const c = C[meta.color]

            return (
              <div
                key={meta.key}
                className={`bg-white rounded-xl border border-gray-200 border-l-4 ${
                  isDisabled ? 'border-l-gray-300 opacity-50' : c.border
                }`}
              >
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isDisabled ? 'bg-gray-100' : c.bg
                    }`}>
                      <Icon className={`h-5 w-5 ${isDisabled ? 'text-gray-400' : c.text}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{meta.name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{meta.description}</p>
                    </div>
                  </div>

                  <SkillStatus skill={skill} toggleable={true} />

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <Toggle enabled={!!skill?.enabled} onChange={() => onToggleSkill(meta.key)} />
                    <button
                      onClick={() => toggleExpand(meta.key)}
                      className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
                        expandedSkill === meta.key ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Configurar
                      {expandedSkill === meta.key
                        ? <ChevronUp className="h-3.5 w-3.5" />
                        : <ChevronDown className="h-3.5 w-3.5" />
                      }
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 2: Automaticos (always-on) */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Automaticos</h2>
        <p className="text-sm text-gray-500 mt-1">Se ejecutan automaticamente en cada conversacion</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {ALWAYS_ON_SKILLS.map((meta) => {
            const skill = skills[meta.key]
            const Icon = meta.icon
            const isExpanded = expandedSkill === meta.key
            const c = C[meta.color]

            return (
              <div
                key={meta.key}
                className={`rounded-xl border border-gray-200 border-l-4 ${c.border} ${c.bgTint} ${
                  isExpanded ? `ring-2 ${c.ring}` : ''
                }`}
              >
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.bg}`}>
                      <Icon className={`h-5 w-5 ${c.text}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{meta.name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{meta.description}</p>
                    </div>
                  </div>

                  <SkillStatus skill={skill} toggleable={false} />

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Siempre activo
                    </span>

                    <button
                      onClick={() => toggleExpand(meta.key)}
                      className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
                        isExpanded ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Configurar
                      {isExpanded
                        ? <ChevronUp className="h-3.5 w-3.5" />
                        : <ChevronDown className="h-3.5 w-3.5" />
                      }
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

      </div>

      {/* Sidebar Panel */}
      {expandedSkill && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/20 z-40 transition-opacity"
            onClick={() => setExpandedSkill(null)}
          />

          {/* Sidebar */}
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-slide-in">
            {/* Header */}
            {(() => {
              const meta = SIDEBAR_META[expandedSkill]
              if (!meta) return null
              const SidebarIcon = meta.icon
              const sc = C[meta.color]
              return (
                <div className={`px-6 py-4 border-b flex items-center justify-between ${sc.bgTint}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${sc.bg} flex items-center justify-center`}>
                      <SidebarIcon className={`h-5 w-5 ${sc.text}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{meta.title}</h3>
                      <p className="text-xs text-gray-500">{meta.subtitle}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedSkill(null)}
                    className="p-2 rounded-lg hover:bg-white/60 transition-colors text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )
            })()}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {expandedSkill === 'data_capture' && <DataCaptureConfig />}
              {expandedSkill === 'faq' && <FaqConfig />}
              {expandedSkill === 'human_handoff' && (
                <HumanHandoffConfig humanConfig={humanConfig} setHumanConfig={setHumanConfig} />
              )}
            </div>
          </div>

          <style>{`
            @keyframes slideIn {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
            .animate-slide-in {
              animation: slideIn 0.2s ease-out;
            }
          `}</style>
        </>
      )}
    </div>
  )
}
