import { useState, useEffect } from 'react'
import {
  Bot, Sparkles, Loader2,
  ClipboardList, BookOpen, UserRound, Check,
  Plus, Pencil, Trash2, X, GripVertical, ListChecks,
} from 'lucide-react'
import { promptApi, captureApi } from '../../api/client'
import { ConfirmDialog } from '../ui'

const TONOS = [
  { id: 'formal', label: 'Formal', desc: 'Profesional y respetuoso' },
  { id: 'cercano', label: 'Cercano', desc: 'Amigable y natural' },
  { id: 'divertido', label: 'Divertido', desc: 'Relajado y con chispa' },
]

const TONO_TEMPERATURE = { formal: 0.4, cercano: 0.7, divertido: 0.85 }

const HUMAN_TRIGGERS = [
  { id: 'frustration', label: 'Cliente molesto', desc: 'Se nota enojo o frustración' },
  { id: 'complaint', label: 'Una queja', desc: 'Algo salió mal con tu servicio' },
  { id: 'human_request', label: 'Pide hablar contigo', desc: '"Quiero hablar con una persona"' },
  { id: 'urgency', label: 'Algo urgente', desc: 'Necesita atención de inmediato' },
  { id: 'complexity', label: 'Caso complicado', desc: 'El agente no logra resolverlo' },
  { id: 'negotiation', label: 'Quiere negociar', desc: 'Pide descuentos o precios especiales' },
]

const AUTO_SKILLS = [
  { icon: ClipboardList, label: 'Capturar datos', desc: 'Guarda nombre, teléfono y lo que necesites del cliente' },
  { icon: BookOpen, label: 'Usar el conocimiento', desc: 'Responde con la información de tu negocio' },
  { icon: UserRound, label: 'Pasar a humano', desc: 'Te avisa y se aparta cuando hace falta' },
]

/* ──────────────────────────────────────────────────────────────────────────
   Sección 1 — ¿Quién es tu asistente? (la "ficha")
   ────────────────────────────────────────────────────────────────────────── */
export function FichaSection({ ficha, setFicha, config, setConfig }) {
  const [improving, setImproving] = useState(false)

  const handleImprove = async () => {
    if (!ficha.negocio.trim()) return
    setImproving(true)
    try {
      const res = await promptApi.improvePrompt({
        section: 'context',
        current_content: ficha.negocio,
        business_name: ficha.nombre || 'el negocio',
        business_type: ficha.negocio.slice(0, 60),
      })
      if (res.data?.improved) {
        setFicha({ ...ficha, negocio: res.data.improved })
      }
    } catch (e) {
      console.error('Error improving description:', e)
    } finally {
      setImproving(false)
    }
  }

  const selectTono = (tonoId) => {
    setFicha({ ...ficha, tono: tonoId })
    // Reflect the tone in temperature so the advanced override stays in sync
    setConfig({ ...config, temperature: TONO_TEMPERATURE[tonoId] })
  }

  return (
    <div className="space-y-6">
      {/* Nombre */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nombre del asistente
        </label>
        <input
          type="text"
          value={ficha.nombre}
          onChange={(e) => setFicha({ ...ficha, nombre: e.target.value })}
          placeholder="Ej: Sofía"
          className="w-full max-w-sm px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
        />
        <p className="text-xs text-gray-400 mt-1.5">Así se presentará con tus clientes.</p>
      </div>

      {/* Qué hace el negocio */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            ¿A qué se dedica tu negocio?
          </label>
          <button
            onClick={handleImprove}
            disabled={improving || !ficha.negocio.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {improving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Mejorar con IA
          </button>
        </div>
        <textarea
          value={ficha.negocio}
          onChange={(e) => setFicha({ ...ficha, negocio: e.target.value })}
          placeholder="Ej: Somos una barbería en el centro. Cortamos cabello y barba, y atendemos de lunes a sábado."
          rows={4}
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-none transition-all"
        />
        <p className="text-xs text-gray-400 mt-1.5">
          Descríbelo con tus palabras. El asistente lo usará para responder a tus clientes.
        </p>
      </div>

      {/* Tono */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">¿Cómo habla?</label>
        <div className="grid grid-cols-3 gap-3 max-w-xl">
          {TONOS.map((tono) => {
            const active = ficha.tono === tono.id
            return (
              <button
                key={tono.id}
                type="button"
                onClick={() => selectTono(tono.id)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  active
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${active ? 'text-violet-700' : 'text-gray-800'}`}>
                    {tono.label}
                  </span>
                  {active && <Check className="h-4 w-4 text-violet-600" />}
                </div>
                <p className="text-xs text-gray-500 mt-1">{tono.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Qué NO debe hacer */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ¿Qué NO debe hacer? <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          value={ficha.no_hacer}
          onChange={(e) => setFicha({ ...ficha, no_hacer: e.target.value })}
          placeholder="Ej: No prometer descuentos. No dar información que no esté en lo que sabe."
          rows={3}
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-none transition-all"
        />
        <p className="text-xs text-gray-400 mt-1.5">
          Reglas y límites. El asistente las respetará siempre.
        </p>
      </div>

      {/* Skills automáticos */}
      <div className="pt-2">
        <p className="text-sm font-medium text-gray-700 mb-3">Esto ya lo hace solo</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {AUTO_SKILLS.map((skill) => {
            const Icon = skill.icon
            return (
              <div
                key={skill.label}
                className="rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-violet-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm">{skill.label}</h3>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{skill.desc}</p>
                <span className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Siempre activo
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   Sección 3a — Datos que el agente reúne antes de pasártelo (captura)
   ────────────────────────────────────────────────────────────────────────── */
const CAPTURE_FIELD_TYPES = [
  { id: 'texto', label: 'Texto' },
  { id: 'email', label: 'Correo' },
  { id: 'telefono', label: 'Teléfono' },
  { id: 'numero', label: 'Número' },
  { id: 'fecha', label: 'Fecha' },
]

const CAPTURE_SUGGESTIONS = [
  { etiqueta: 'Nombre', tipo: 'texto' },
  { etiqueta: 'Servicio de interés', tipo: 'texto' },
  { etiqueta: 'Teléfono', tipo: 'telefono' },
]

const slugifyField = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'dato'

const typeLabel = (tipo) =>
  CAPTURE_FIELD_TYPES.find((t) => t.id === tipo)?.label || 'Texto'

export function CaptureFieldsSection() {
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null) // { type, msg }

  // Editor inline: null | {} (nuevo) | {id, ...} (editar)
  const [editing, setEditing] = useState(null)
  const [labelDraft, setLabelDraft] = useState('')
  const [typeDraft, setTypeDraft] = useState('texto')
  const [requiredDraft, setRequiredDraft] = useState(true)
  const [savingField, setSavingField] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { loadFields() }, [])

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 2800)
  }

  const loadFields = async () => {
    setLoading(true)
    try {
      const res = await captureApi.getFields()
      setFields(res.data || [])
    } catch (e) {
      console.error('Error loading capture fields:', e)
      showToast('error', 'No se pudieron cargar los datos')
    }
    setLoading(false)
  }

  const isRequired = (f) => f.obligatorio ?? f.requerido ?? true

  const startNew = (preset) => {
    setEditing({})
    setLabelDraft(preset?.etiqueta || '')
    setTypeDraft(preset?.tipo || 'texto')
    setRequiredDraft(true)
  }

  const startEdit = (f) => {
    setEditing(f)
    setLabelDraft(f.etiqueta || '')
    setTypeDraft(f.tipo || 'texto')
    setRequiredDraft(isRequired(f))
  }

  const cancelEdit = () => {
    setEditing(null)
    setLabelDraft('')
    setTypeDraft('texto')
    setRequiredDraft(true)
  }

  const handleSaveField = async () => {
    const etiqueta = labelDraft.trim()
    if (!etiqueta) return
    setSavingField(true)
    try {
      if (editing?.id) {
        const res = await captureApi.updateField(editing.id, {
          etiqueta,
          tipo: typeDraft,
          obligatorio: requiredDraft,
        })
        const updated = res.data || { ...editing, etiqueta, tipo: typeDraft, obligatorio: requiredDraft }
        setFields((prev) => prev.map((f) => (f.id === editing.id ? { ...f, ...updated } : f)))
        showToast('success', 'Dato actualizado')
      } else {
        const res = await captureApi.createField({
          nombre: slugifyField(etiqueta),
          etiqueta,
          tipo: typeDraft,
          obligatorio: requiredDraft,
          orden: fields.length,
        })
        const created = res.data || { nombre: slugifyField(etiqueta), etiqueta, tipo: typeDraft, obligatorio: requiredDraft }
        setFields((prev) => [...prev, created])
        showToast('success', 'Dato agregado')
      }
      cancelEdit()
    } catch (e) {
      console.error('Error saving capture field:', e)
      showToast('error', e.response?.data?.detail || 'No se pudo guardar el dato')
    }
    setSavingField(false)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await captureApi.deleteField(deleteTarget.id)
      setFields((prev) => prev.filter((f) => f.id !== deleteTarget.id))
      setDeleteTarget(null)
      showToast('success', 'Dato eliminado')
    } catch (e) {
      console.error('Error deleting capture field:', e)
      showToast('error', 'No se pudo eliminar el dato')
    }
    setDeleting(false)
  }

  const requiredCount = fields.filter(isRequired).length

  return (
    <div>
      <div className="rounded-xl bg-violet-50/60 border border-violet-100 p-4 mb-5">
        <p className="text-sm text-gray-700 leading-relaxed">
          Cuando el agente reúna estos datos, te paso la conversación automáticamente. Si el
          cliente solo pregunta y no los da, el agente sigue respondiendo (no te molesta).
        </p>
        {fields.length > 0 && (
          <p className="text-xs text-violet-700 mt-2 font-medium">
            {requiredCount > 0
              ? `Datos mínimos para pasarte la conversación: ${requiredCount}.`
              : 'Ningún dato está marcado como obligatorio: marca al menos uno como obligatorio para que te pase la conversación.'}
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
        </div>
      ) : fields.length === 0 && !editing ? (
        <CaptureEmptyState onPick={startNew} onCreateBlank={() => startNew()} />
      ) : (
        <div className="space-y-2.5">
          {fields.map((field) => {
            const required = isRequired(field)
            return (
              <div
                key={field.id || field.nombre}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3.5 hover:border-violet-200 transition-colors"
              >
                <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{field.etiqueta}</span>
                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-gray-100 text-gray-500 font-medium">
                      {typeLabel(field.tipo)}
                    </span>
                    {required ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100 font-medium">
                        <Check className="h-2.5 w-2.5" /> Obligatorio
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-gray-50 text-gray-400 font-medium">
                        Opcional
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(field)}
                    className="p-2 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors"
                    title="Editar dato"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(field)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    title="Eliminar dato"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}

          {/* Botón para agregar (cuando no se está editando algo nuevo) */}
          {!editing && (
            <button
              type="button"
              onClick={() => startNew()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-dashed border-violet-300 text-sm font-medium text-violet-600 hover:bg-violet-50 transition-colors"
            >
              <Plus className="h-4 w-4" /> Agregar dato
            </button>
          )}
        </div>
      )}

      {/* Editor inline (crear / editar) */}
      {editing && (
        <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
          <p className="text-xs font-medium text-violet-700 mb-3 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            {editing?.id ? 'Editar dato' : 'Nuevo dato'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveField() } }}
              placeholder="Ej: Nombre"
              autoFocus
              className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
            <select
              value={typeDraft}
              onChange={(e) => setTypeDraft(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            >
              {CAPTURE_FIELD_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2.5 mt-3 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={requiredDraft}
              onClick={() => setRequiredDraft((v) => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                requiredDraft ? 'bg-violet-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  requiredDraft ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span className="text-sm text-gray-700">
              Obligatorio <span className="text-gray-400">(es uno de los datos mínimos para pasarte la conversación)</span>
            </span>
          </label>

          <div className="flex items-center gap-2 mt-4">
            <button
              type="button"
              onClick={handleSaveField}
              disabled={savingField || !labelDraft.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 transition-all disabled:opacity-50"
            >
              {savingField ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {editing?.id ? 'Guardar' : 'Agregar'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={savingField}
              className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Eliminar dato"
        message={`Se eliminará "${deleteTarget?.etiqueta}". El agente dejará de reunir este dato.`}
        confirmText="Eliminar"
        variant="danger"
      />

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function CaptureEmptyState({ onPick, onCreateBlank }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mb-4">
        <ListChecks className="h-6 w-6 text-white" />
      </div>
      <h3 className="text-base font-semibold text-gray-900">Aún no eliges qué datos reunir</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
        Elige los datos mínimos que el agente debe reunir del cliente. Cuando los tenga, te
        paso la conversación. Empieza con una sugerencia:
      </p>
      <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
        {CAPTURE_SUGGESTIONS.map((s) => (
          <button
            key={s.etiqueta}
            type="button"
            onClick={() => onPick(s)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-violet-50 text-violet-700 text-sm font-medium border border-violet-100 hover:bg-violet-100 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> {s.etiqueta}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onCreateBlank}
        className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-violet-700 hover:bg-violet-50 transition-colors"
      >
        <Plus className="h-4 w-4" /> Crear un dato desde cero
      </button>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   Sección 3b — Además, pásame al cliente si… (modo humano)
   ────────────────────────────────────────────────────────────────────────── */
export function HumanModeSection({ humanConfig, setHumanConfig }) {
  const toggleTrigger = (id) => {
    const current = humanConfig.triggers || []
    const updated = current.includes(id)
      ? current.filter((t) => t !== id)
      : [...current, id]
    setHumanConfig({ ...humanConfig, triggers: updated })
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {HUMAN_TRIGGERS.map((trigger) => {
          const active = (humanConfig.triggers || []).includes(trigger.id)
          return (
            <button
              key={trigger.id}
              type="button"
              onClick={() => toggleTrigger(trigger.id)}
              className={`text-left p-3.5 rounded-xl border-2 transition-all ${
                active
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${active ? 'text-violet-700' : 'text-gray-800'}`}>
                  {trigger.label}
                </span>
                {active && <Check className="h-4 w-4 text-violet-600" />}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{trigger.desc}</p>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Palabra para que el asistente retome
          </label>
          <input
            type="text"
            value={humanConfig.reactivar_command || '#reactivar'}
            onChange={(e) => setHumanConfig({ ...humanConfig, reactivar_command: e.target.value })}
            placeholder="#reactivar"
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            Escribe esto en el chat para que el asistente vuelva a responder.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Que retome solo después de (horas)
          </label>
          <input
            type="number"
            min="0"
            value={humanConfig.expire_hours || 0}
            onChange={(e) => setHumanConfig({ ...humanConfig, expire_hours: parseInt(e.target.value) || 0 })}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            0 = nunca. Solo retoma cuando tú quieras o con la palabra.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   Ajustes técnicos (van dentro de "Opciones avanzadas")
   ────────────────────────────────────────────────────────────────────────── */
export function AdvancedSettingsSection({ config, setConfig }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
      {/* Modelo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Modelo de IA</label>
        <select
          value={config.model}
          onChange={(e) => setConfig({ ...config, model: e.target.value })}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
        >
          <option value="gpt-4o-mini">Rápido y económico (recomendado)</option>
          <option value="gpt-4o">Más inteligente</option>
          <option value="gpt-4-turbo">Alta capacidad</option>
          <option value="gpt-3.5-turbo">Básico</option>
        </select>
        <p className="text-xs text-gray-400 mt-1.5">
          El cerebro del asistente. El recomendado funciona bien para la mayoría.
        </p>
      </div>

      {/* Temperatura */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Creatividad de las respuestas
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range" min="0" max="1" step="0.05"
            value={config.temperature}
            onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
          />
          <span className="text-sm font-medium text-gray-700 w-10 text-right">{config.temperature}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Bajo = respuestas más predecibles. Alto = más variadas. El tono ya ajusta esto por ti.
        </p>
      </div>

      {/* Max tokens */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Largo de las respuestas
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range" min="100" max="2000" step="100"
            value={config.max_tokens}
            onChange={(e) => setConfig({ ...config, max_tokens: parseInt(e.target.value) })}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
          />
          <span className="text-sm font-medium text-gray-700 w-14 text-right">{config.max_tokens}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Cuánto puede extenderse. Más alto = respuestas más largas.
        </p>
      </div>

      {/* Response delay */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Espera antes de responder
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range" min="0" max="10" step="1"
            value={config.response_delay ?? 3}
            onChange={(e) => setConfig({ ...config, response_delay: parseInt(e.target.value) })}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
          />
          <span className="text-sm font-medium text-gray-700 w-10 text-right">{config.response_delay ?? 3}s</span>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Espera unos segundos antes de responder, para que se sienta más humano.
        </p>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   Helpers de guardado (sin cambios de contrato)
   ────────────────────────────────────────────────────────────────────────── */
const TONO_TEXT = {
  formal: 'Mantén un tono formal, profesional y respetuoso. Trata al cliente de usted.',
  cercano: 'Mantén un tono cercano, amigable y natural. Habla como una persona real, cálida y servicial.',
  divertido: 'Mantén un tono relajado y divertido, con chispa y buen humor, sin perder profesionalismo. Usa emojis con moderación.',
}

export const TONO_TO_TEMPERATURE = TONO_TEMPERATURE

export function buildSectionsFromFicha(ficha) {
  const nombre = (ficha.nombre || 'Asistente').trim()
  const negocio = (ficha.negocio || '').trim()
  const noHacer = (ficha.no_hacer || '').trim()
  const tono = ficha.tono || 'cercano'

  const role = `Eres ${nombre}, el asistente virtual que atiende a los clientes de este negocio por WhatsApp.`

  const context = negocio
    ? `Esto es lo que hace el negocio:\n${negocio}`
    : 'Trabajas para un negocio que atiende a sus clientes por WhatsApp.'

  const task = `Tu objetivo es atender a los clientes: responder sus preguntas, darles información del negocio, ayudarlos en lo que necesiten y ofrecer una experiencia de atención excelente.`

  const baseConstraints = 'No inventes información: si no sabes algo, dilo con honestidad. No compartas datos de otros clientes. Responde siempre en español.'
  const constraints = noHacer
    ? `${baseConstraints}\nAdemás, ten en cuenta estas reglas del negocio:\n${noHacer}`
    : baseConstraints

  const tone = TONO_TEXT[tono] || TONO_TEXT.cercano

  // Raw ficha stored to rebuild the UI on reload.
  const _ficha = { nombre, negocio, tono, no_hacer: noHacer }

  return { role, context, task, constraints, tone, _ficha }
}

export function buildSystemPromptFromSections(sections) {
  return `## ROL
${sections.role}

## CONTEXTO
${sections.context}

## TAREA
${sections.task}

## RESTRICCIONES
${sections.constraints}

## TONO
${sections.tone}`
}

// Try to reconstruct the ficha when there's no stored _ficha (legacy configs).
export function deriveFichaFromSections(sections, config) {
  if (!sections) return null
  if (sections._ficha) return sections._ficha

  // Derive a name from the role text if possible
  let nombre = ''
  const roleMatch = (sections.role || '').match(/eres\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]*)/i)
  if (roleMatch) nombre = roleMatch[1]

  // Map temperature back to a tono
  let tono = 'cercano'
  const t = config?.temperature ?? 0.7
  if (t <= 0.5) tono = 'formal'
  else if (t >= 0.8) tono = 'divertido'

  return {
    nombre: nombre || config?.business_name || '',
    negocio: sections.context || '',
    tono,
    no_hacer: sections.constraints || '',
  }
}
