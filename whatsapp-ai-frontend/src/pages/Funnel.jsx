import { useState, useEffect } from 'react'
import {
  Route, Plus, Pencil, Trash2, X, Users, Loader2, Check,
  Sparkles, Tag, ArrowDown, UserRound, Bell, Wand2,
} from 'lucide-react'
import { funnelApi, captureApi } from '../api/client'
import { ConfirmDialog } from '../components/ui'

// Acciones al entrar a una etapa (simple, en lenguaje de usuario)
const ENTRY_ACTIONS = [
  { id: '', label: 'Nada especial', desc: 'Solo seguir la conversación' },
  { id: 'pasar_a_humano', label: 'Pasar a un humano', desc: 'La IA se aparta y avisas tú' },
  { id: 'notificarme', label: 'Avisarme', desc: 'Te llega una notificación' },
]

// Tipos de dato para crear un campo de captura nuevo (lenguaje claro)
const FIELD_TYPES = [
  { id: 'texto', label: 'Texto' },
  { id: 'numero', label: 'Número' },
  { id: 'email', label: 'Correo' },
  { id: 'telefono', label: 'Teléfono' },
  { id: 'fecha', label: 'Fecha' },
]

// Camino típico sugerido para el estado vacío
const DEFAULT_PATH = [
  {
    titulo: 'Saludo',
    descripcion: 'El primer contacto con el cliente.',
    instrucciones_agente: 'Saluda con calidez, preséntate y pregunta en qué puedes ayudar.',
    condiciones_avance: [],
  },
  {
    titulo: 'Calificar',
    descripcion: 'Entender qué necesita el cliente.',
    instrucciones_agente: 'Haz preguntas para entender qué busca el cliente y si encaja con lo que ofreces. Pide sus datos de contacto.',
    condiciones_avance: [{ tipo: 'datos_capturados', campos: ['nombre'] }],
  },
  {
    titulo: 'Cerrar',
    descripcion: 'Concretar la venta o el agendamiento.',
    instrucciones_agente: 'Ayuda al cliente a dar el último paso: agendar, comprar o confirmar. Resuelve sus dudas finales.',
    condiciones_avance: [],
  },
]

const slugify = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'etapa'

// Extrae los nombres de campo requeridos de las condiciones_avance
const getRequiredFields = (step) => {
  const cond = (step.condiciones_avance || []).find((c) => c.tipo === 'datos_capturados')
  return cond?.campos || []
}

export default function Funnel() {
  const [steps, setSteps] = useState([])
  const [stats, setStats] = useState({ steps: [], sin_paso: 0 })
  const [captureFields, setCaptureFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null) // { type: 'success'|'error', msg }

  const [editStep, setEditStep] = useState(null) // step en edición, o {} para nuevo
  const [creatingDefault, setCreatingDefault] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { loadData() }, [])

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [stepsRes, statsRes, fieldsRes] = await Promise.all([
        funnelApi.getSteps(),
        funnelApi.stats(),
        captureApi.getFields(),
      ])
      setSteps(stepsRes.data)
      setStats(statsRes.data)
      setCaptureFields(fieldsRes.data)
    } catch (e) {
      console.error(e)
      showToast('error', 'No se pudo cargar el camino del cliente')
    }
    setLoading(false)
  }

  const sortedSteps = [...steps].sort((a, b) => a.orden - b.orden)
  const getStepContactCount = (stepName) =>
    stats.steps?.find((s) => s.paso === stepName)?.contactos || 0
  const totalInFunnel =
    steps.reduce((sum, s) => sum + getStepContactCount(s.nombre), 0) + (stats.sin_paso || 0)

  const fieldLabel = (nombre) =>
    captureFields.find((f) => f.nombre === nombre)?.etiqueta || nombre

  const handleSaved = async () => {
    setEditStep(null)
    await loadData()
    showToast('success', 'Etapa guardada')
  }

  const handleCreateDefaultPath = async () => {
    setCreatingDefault(true)
    try {
      // Asegura que el campo "nombre" exista para la etapa de calificar
      let fields = captureFields
      if (!fields.some((f) => f.nombre === 'nombre')) {
        try {
          const res = await captureApi.createField({ nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', orden: 0 })
          fields = [...fields, res.data]
        } catch (e) { /* puede existir ya, ignorar */ }
      }
      for (let i = 0; i < DEFAULT_PATH.length; i++) {
        const p = DEFAULT_PATH[i]
        await funnelApi.createStep({
          nombre: slugify(p.titulo),
          titulo: p.titulo,
          orden: i,
          descripcion: p.descripcion,
          instrucciones_agente: p.instrucciones_agente,
          condiciones_avance: p.condiciones_avance,
          accion_al_entrar: '',
          activo: true,
        })
      }
      await loadData()
      showToast('success', 'Camino creado. Ya puedes personalizarlo.')
    } catch (e) {
      console.error(e)
      showToast('error', e.response?.data?.detail || 'No se pudo crear el camino')
    }
    setCreatingDefault(false)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await funnelApi.deleteStep(deleteTarget.id)
      setDeleteTarget(null)
      await loadData()
      showToast('success', 'Etapa eliminada')
    } catch (e) {
      console.error(e)
      showToast('error', 'No se pudo eliminar la etapa')
    }
    setDeleting(false)
  }

  const startNew = () =>
    setEditStep({
      titulo: '',
      orden: steps.length,
      descripcion: '',
      instrucciones_agente: '',
      condiciones_avance: [],
      accion_al_entrar: '',
      activo: true,
    })

  return (
    <div className="space-y-8">
      {/* Encabezado contextual pequeño (el hub ya trae el header de página) */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
            <Route className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">El camino del cliente</h2>
            <p className="text-sm text-gray-500 mt-0.5 max-w-xl">
              Las etapas por las que tu agente lleva a cada cliente. En cada etapa decides
              qué hace el agente y qué datos necesita para avanzar.
            </p>
          </div>
        </div>
        {sortedSteps.length > 0 && (
          <button
            onClick={startNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 shadow-sm transition-all shrink-0"
          >
            <Plus className="h-4 w-4" /> Agregar etapa
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      ) : sortedSteps.length === 0 ? (
        <EmptyState
          onCreateDefault={handleCreateDefaultPath}
          onCreateFirst={startNew}
          creating={creatingDefault}
        />
      ) : (
        <div className="relative">
          {sortedSteps.map((step, idx) => {
            const count = getStepContactCount(step.nombre)
            const pct = totalInFunnel > 0 ? Math.round((count / totalInFunnel) * 100) : 0
            const required = getRequiredFields(step)
            const action = ENTRY_ACTIONS.find((a) => a.id === (step.accion_al_entrar || ''))
            const isLast = idx === sortedSteps.length - 1
            return (
              <div key={step.id} className="flex gap-4">
                {/* Línea + número del timeline */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                    {idx + 1}
                  </div>
                  {!isLast && <div className="w-0.5 flex-1 bg-violet-100 my-1" />}
                </div>

                {/* Tarjeta de la etapa */}
                <div className={`flex-1 mb-4 ${step.activo ? '' : 'opacity-60'}`}>
                  <div className="rounded-xl border border-gray-200 bg-white p-5 hover:border-violet-200 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{step.titulo}</h3>
                          {!step.activo && (
                            <span className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded-full">
                              Pausada
                            </span>
                          )}
                        </div>
                        {step.descripcion && (
                          <p className="text-sm text-gray-500 mt-0.5">{step.descripcion}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setEditStep(step)}
                          className="p-2 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors"
                          title="Editar etapa"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(step)}
                          className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="Eliminar etapa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Qué hace el agente */}
                    {step.instrucciones_agente && (
                      <div className="mt-3 rounded-lg bg-violet-50/60 border border-violet-100 p-3">
                        <p className="text-[11px] font-medium text-violet-600 uppercase tracking-wide mb-1">
                          El agente aquí
                        </p>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {step.instrucciones_agente}
                        </p>
                      </div>
                    )}

                    {/* Datos que pide para avanzar */}
                    <div className="mt-3">
                      {required.length > 0 ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-500">Para avanzar pide:</span>
                          {required.map((f) => (
                            <span
                              key={f}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-fuchsia-50 text-fuchsia-700 rounded-full border border-fuchsia-100 font-medium"
                            >
                              <Tag className="h-3 w-3" />
                              {fieldLabel(f)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">
                          Avanza cuando el agente lo considere oportuno.
                        </p>
                      )}
                    </div>

                    {/* Pie: acción al entrar + contactos */}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                      {action && action.id ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                          {action.id === 'pasar_a_humano' ? (
                            <UserRound className="h-3.5 w-3.5 text-violet-500" />
                          ) : (
                            <Bell className="h-3.5 w-3.5 text-violet-500" />
                          )}
                          Al entrar: {action.label.toLowerCase()}
                        </span>
                      ) : (
                        <span />
                      )}
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-gray-400" />
                        <div className="w-28 bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                          {count} {count === 1 ? 'cliente' : 'clientes'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Conector hacia la siguiente etapa */}
                  {!isLast && (
                    <div className="flex justify-center py-1 text-violet-300">
                      <ArrowDown className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {(stats.sin_paso || 0) > 0 && (
            <p className="text-xs text-gray-400 mt-2 ml-12 pl-1">
              {stats.sin_paso} {stats.sin_paso === 1 ? 'cliente aún no entra' : 'clientes aún no entran'} al camino.
            </p>
          )}
        </div>
      )}

      {/* Editor de etapa (un solo lugar) */}
      {editStep && (
        <StepEditor
          step={editStep}
          stepsCount={steps.length}
          captureFields={captureFields}
          onCaptureFieldsChange={setCaptureFields}
          onClose={() => setEditStep(null)}
          onSaved={handleSaved}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Eliminar etapa"
        message={`Se eliminará "${deleteTarget?.titulo}". Los clientes en esta etapa quedarán sin etapa asignada.`}
        confirmText="Eliminar"
        variant="danger"
      />

      {/* Toast de feedback */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── Estado vacío ─────────────────────────── */
function EmptyState({ onCreateDefault, onCreateFirst, creating }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mb-4">
        <Route className="h-7 w-7 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900">Aún no defines el camino</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
        Estas son las etapas por las que tu agente llevará a cada cliente. Empieza con un
        camino típico y ajústalo, o crea tu primera etapa desde cero.
      </p>

      {/* Vista previa del camino típico */}
      <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
        {DEFAULT_PATH.map((p, i) => (
          <div key={p.titulo} className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 text-sm font-medium border border-violet-100">
              {p.titulo}
            </span>
            {i < DEFAULT_PATH.length - 1 && (
              <span className="text-violet-300 text-sm">→</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-7 flex items-center justify-center gap-3 flex-wrap">
        <button
          onClick={onCreateDefault}
          disabled={creating}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 shadow-sm transition-all disabled:opacity-60"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          Crear este camino
        </button>
        <button
          onClick={onCreateFirst}
          disabled={creating}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> Crear etapa desde cero
        </button>
      </div>
    </div>
  )
}

/* ─────────────────── Editor de etapa (con captura adentro) ─────────────────── */
function StepEditor({ step, stepsCount, captureFields, onCaptureFieldsChange, onClose, onSaved, onError }) {
  const isNew = !step.id
  const initialRequired = getRequiredFields(step)

  const [titulo, setTitulo] = useState(step.titulo || '')
  const [descripcion, setDescripcion] = useState(step.descripcion || '')
  const [instrucciones, setInstrucciones] = useState(step.instrucciones_agente || '')
  const [accion, setAccion] = useState(step.accion_al_entrar || '')
  const [selectedFields, setSelectedFields] = useState(initialRequired)
  const [saving, setSaving] = useState(false)

  // Crear campo nuevo en línea
  const [showNewField, setShowNewField] = useState(false)
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState('texto')
  const [creatingField, setCreatingField] = useState(false)

  const toggleField = (nombre) => {
    setSelectedFields((prev) =>
      prev.includes(nombre) ? prev.filter((f) => f !== nombre) : [...prev, nombre]
    )
  }

  const handleCreateField = async () => {
    const etiqueta = newFieldLabel.trim()
    if (!etiqueta) return
    setCreatingField(true)
    try {
      const nombre = slugify(etiqueta)
      const res = await captureApi.createField({
        nombre,
        etiqueta,
        tipo: newFieldType,
        orden: captureFields.length,
      })
      const created = res.data || { nombre, etiqueta, tipo: newFieldType }
      onCaptureFieldsChange([...captureFields, created])
      setSelectedFields((prev) => (prev.includes(created.nombre) ? prev : [...prev, created.nombre]))
      setNewFieldLabel('')
      setNewFieldType('texto')
      setShowNewField(false)
    } catch (e) {
      console.error(e)
      onError(e.response?.data?.detail || 'No se pudo crear el dato')
    }
    setCreatingField(false)
  }

  const handleSave = async () => {
    if (!titulo.trim()) {
      onError('Ponle un título a la etapa')
      return
    }
    setSaving(true)
    // Construye condiciones_avance: una sola condición tipo datos_capturados (si hay campos)
    const condiciones_avance =
      selectedFields.length > 0
        ? [{ tipo: 'datos_capturados', campos: selectedFields }]
        : []

    const payload = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      instrucciones_agente: instrucciones.trim(),
      condiciones_avance,
      accion_al_entrar: accion,
    }

    try {
      if (isNew) {
        await funnelApi.createStep({
          ...payload,
          nombre: slugify(titulo),
          orden: typeof step.orden === 'number' ? step.orden : stepsCount,
          activo: true,
        })
      } else {
        // El nombre interno NO se edita (autogenerado al crear); se conserva.
        await funnelApi.updateStep(step.id, payload)
      }
      onSaved()
    } catch (e) {
      console.error(e)
      onError(e.response?.data?.detail || 'No se pudo guardar la etapa')
      setSaving(false)
    }
  }

  const labelFor = (nombre) =>
    captureFields.find((f) => f.nombre === nombre)?.etiqueta || nombre

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50">
      <div className="flex min-h-full items-start justify-center p-4 py-10">
        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {isNew ? 'Nueva etapa' : 'Editar etapa'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Título */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ¿Cómo se llama esta etapa?
              </label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej: Calificar al cliente"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
              />
            </div>

            {/* Descripción corta (opcional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resumen corto <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="En una línea, qué pasa en esta etapa"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
              />
            </div>

            {/* Qué debe lograr el agente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ¿Qué debe lograr el agente en esta etapa?
              </label>
              <textarea
                value={instrucciones}
                onChange={(e) => setInstrucciones(e.target.value)}
                rows={4}
                placeholder="Ej: Entender qué busca el cliente y pedir su nombre y teléfono para poder ayudarlo."
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-none transition-all"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Esto guía al agente mientras el cliente esté en esta etapa.
              </p>
            </div>

            {/* Datos para avanzar (CAPTURA integrada) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ¿Qué datos necesita para avanzar?
              </label>
              <p className="text-xs text-gray-400 mb-3">
                El agente no pasará a la siguiente etapa hasta tener estos datos. Si no eliges
                ninguno, avanza cuando lo considere oportuno.
              </p>

              <div className="flex flex-wrap gap-2">
                {captureFields.map((field) => {
                  const active = selectedFields.includes(field.nombre)
                  return (
                    <button
                      key={field.nombre}
                      type="button"
                      onClick={() => toggleField(field.nombre)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                        active
                          ? 'bg-violet-100 border-violet-300 text-violet-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {active && <Check className="h-3.5 w-3.5" />}
                      {field.etiqueta}
                    </button>
                  )
                })}

                {/* Botón para crear dato nuevo aquí mismo */}
                {!showNewField && (
                  <button
                    type="button"
                    onClick={() => setShowNewField(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-violet-300 text-sm font-medium text-violet-600 hover:bg-violet-50 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Nuevo dato
                  </button>
                )}
              </div>

              {/* Formulario inline de campo nuevo */}
              {showNewField && (
                <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
                  <p className="text-xs font-medium text-violet-700 mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Crear un dato nuevo
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={newFieldLabel}
                      onChange={(e) => setNewFieldLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateField() } }}
                      placeholder="Ej: Ciudad"
                      autoFocus
                      className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                    />
                    <select
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value)}
                      className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={handleCreateField}
                      disabled={creatingField || !newFieldLabel.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 transition-all disabled:opacity-50"
                    >
                      {creatingField ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Agregar
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowNewField(false); setNewFieldLabel(''); setNewFieldType('texto') }}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Resumen de seleccionados */}
              {selectedFields.length > 0 && (
                <p className="text-xs text-gray-500 mt-3">
                  Pedirá: {selectedFields.map(labelFor).join(', ')}.
                </p>
              )}
            </div>

            {/* Acción al entrar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Al entrar a esta etapa…
              </label>
              <select
                value={accion}
                onChange={(e) => setAccion(e.target.value)}
                className="w-full max-w-sm px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              >
                {ENTRY_ACTIONS.map((a) => (
                  <option key={a.id || 'none'} value={a.id}>{a.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1.5">
                {ENTRY_ACTIONS.find((a) => a.id === accion)?.desc}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 shadow-sm transition-all disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isNew ? 'Crear etapa' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
