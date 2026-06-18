import { useState, useEffect } from 'react'
import {
  BookOpen, Plus, Search, Trash2, Pencil, X, Loader2, Check,
  ChevronDown, Tag, Clock, MapPin, Wrench, ShieldCheck, MoreHorizontal,
  Lightbulb,
} from 'lucide-react'
import { conocimientoApi } from '../api/client'
import { ConfirmDialog } from '../components/ui'

// Categorías sugeridas (chips) → cada una con su look y un icono amable.
const CATEGORIAS = [
  { id: 'precios', label: 'Precios', icon: Tag },
  { id: 'horarios', label: 'Horarios', icon: Clock },
  { id: 'ubicacion', label: 'Ubicación', icon: MapPin },
  { id: 'servicios', label: 'Servicios', icon: Wrench },
  { id: 'politicas', label: 'Políticas', icon: ShieldCheck },
  { id: 'otro', label: 'Otro', icon: MoreHorizontal },
]

const catMeta = (id) => CATEGORIAS.find((c) => c.id === id) || CATEGORIAS[CATEGORIAS.length - 1]

// Ideas para arrancar (estado vacío). Prellenan el formulario.
const SUGERENCIAS = [
  { titulo: '¿Cuánto cuesta?', categoria: 'precios' },
  { titulo: '¿Qué horarios manejan?', categoria: 'horarios' },
  { titulo: '¿Dónde están ubicados?', categoria: 'ubicacion' },
  { titulo: '¿Qué servicios ofrecen?', categoria: 'servicios' },
  { titulo: '¿Aceptan tarjeta?', categoria: 'politicas' },
]

// Toggle violeta (en línea con la identidad de marca).
function VioletToggle({ enabled, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 ${
        enabled ? 'bg-violet-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function Conocimiento() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Secciones colapsadas (por categoría id)
  const [collapsed, setCollapsed] = useState({})

  // Panel lateral
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [editDoc, setEditDoc] = useState(null)
  const [form, setForm] = useState({ titulo: '', contenido: '', categoria: 'precios', activo: true })
  const [customCat, setCustomCat] = useState('')
  const [saving, setSaving] = useState(false)

  // Borrado
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [docToDelete, setDocToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Feedback de guardado
  const [toast, setToast] = useState(null) // { msg }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [toast])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await conocimientoApi.list()
      setDocs(res.data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  // Normaliza la categoría de un doc a una de las conocidas (o "otro").
  const normalizeCat = (raw) => {
    const v = (raw || '').toString().trim().toLowerCase()
    const known = CATEGORIAS.find((c) => c.id === v)
    if (known) return v
    // intentos suaves de mapeo de configs antiguas
    if (['general', 'faq', 'preguntas'].includes(v)) return 'otro'
    return v ? 'otro' : 'otro'
  }

  const openNew = (preset = {}) => {
    setEditDoc(null)
    setForm({
      titulo: preset.titulo || '',
      contenido: preset.contenido || '',
      categoria: preset.categoria || 'precios',
      activo: true,
    })
    setCustomCat('')
    setSidebarOpen(true)
  }

  const openEdit = (doc) => {
    const cat = normalizeCat(doc.categoria)
    const isKnown = CATEGORIAS.some((c) => c.id === cat && c.id !== 'otro')
    setEditDoc(doc)
    setForm({
      titulo: doc.titulo || '',
      contenido: doc.contenido || '',
      categoria: isKnown ? cat : 'otro',
      activo: doc.activo ?? true,
    })
    // Si la categoría original no era una conocida, mostrarla en el campo libre.
    setCustomCat(isKnown ? '' : (doc.categoria || ''))
    setSidebarOpen(true)
  }

  const closeSidebar = () => {
    setSidebarOpen(false)
    setEditDoc(null)
  }

  const resolveCategoria = () => {
    if (form.categoria === 'otro' && customCat.trim()) return customCat.trim().toLowerCase()
    return form.categoria
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, categoria: resolveCategoria() }
      if (editDoc) {
        await conocimientoApi.update(editDoc.id, payload)
        setToast({ msg: 'Cambios guardados' })
      } else {
        await conocimientoApi.create(payload)
        setToast({ msg: 'Agregado. Tu agente ya lo sabe.' })
      }
      closeSidebar()
      await loadData()
    } catch (e) {
      console.error(e)
      setToast({ msg: 'No se pudo guardar. Intenta de nuevo.' })
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!docToDelete) return
    setDeleting(true)
    try {
      await conocimientoApi.delete(docToDelete)
      if (editDoc && editDoc.id === docToDelete) closeSidebar()
      setShowDeleteConfirm(false)
      setDocToDelete(null)
      await loadData()
      setToast({ msg: 'Eliminado' })
    } catch (e) {
      console.error(e)
      setToast({ msg: 'No se pudo eliminar. Intenta de nuevo.' })
    }
    setDeleting(false)
  }

  // Cambia activo/inactivo directo desde la lista.
  const toggleActivo = async (doc) => {
    const next = !doc.activo
    // Optimista
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, activo: next } : d)))
    try {
      await conocimientoApi.update(doc.id, { ...doc, activo: next })
      setToast({ msg: next ? 'Activado' : 'Desactivado' })
    } catch (e) {
      console.error(e)
      // revertir
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, activo: doc.activo } : d)))
      setToast({ msg: 'No se pudo actualizar.' })
    }
  }

  // Filtro de búsqueda
  const q = searchQuery.trim().toLowerCase()
  const filtered = docs.filter((d) => {
    if (!q) return true
    return (d.titulo || '').toLowerCase().includes(q) || (d.contenido || '').toLowerCase().includes(q)
  })

  // Agrupar por categoría normalizada, en el orden de CATEGORIAS (+ extras al final)
  const groups = (() => {
    const map = {}
    filtered.forEach((d) => {
      const cat = normalizeCat(d.categoria)
      if (!map[cat]) map[cat] = []
      map[cat].push(d)
    })
    const ordered = []
    CATEGORIAS.forEach((c) => {
      if (map[c.id]) {
        ordered.push({ id: c.id, label: c.label, items: map[c.id] })
        delete map[c.id]
      }
    })
    // Cualquier categoría custom restante
    Object.keys(map).forEach((id) => {
      ordered.push({ id, label: id.charAt(0).toUpperCase() + id.slice(1), items: map[id] })
    })
    return ordered
  })()

  const totalActivos = docs.filter((d) => d.activo).length

  return (
    <div className="space-y-6">
      {/* Encabezado contextual (sin header de página: el hub ya tiene el suyo) */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Lo que tu agente sabe</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Las preguntas y datos de tu negocio que tu agente usa para responder bien.
          </p>
        </div>
        {docs.length > 0 && (
          <button
            onClick={() => openNew()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 transition-all shadow-lg shadow-violet-500/25 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Agregar
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      ) : docs.length === 0 ? (
        /* ─── Estado vacío ─── */
        <div className="rounded-2xl border border-violet-100 bg-gradient-to-b from-violet-50/60 to-white px-6 py-12 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mb-5 shadow-lg shadow-violet-500/25">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            Agrega lo primero que te preguntan tus clientes
          </h3>
          <p className="text-sm text-gray-500 mt-1.5 max-w-md mx-auto">
            Mientras más sepa tu agente, mejor responderá. Empieza con precios, horarios o
            lo que más te pregunten.
          </p>

          <button
            onClick={() => openNew()}
            className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 transition-all shadow-lg shadow-violet-500/25"
          >
            <Plus className="h-4 w-4" />
            Agregar lo primero
          </button>

          <div className="mt-8">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-3">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              O empieza con una de estas
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s.titulo}
                  onClick={() => openNew(s)}
                  className="px-3.5 py-1.5 rounded-full text-sm font-medium text-violet-700 bg-white border border-violet-200 hover:border-violet-400 hover:bg-violet-50 transition-colors"
                >
                  {s.titulo}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Búsqueda */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por tema o respuesta..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
              />
            </div>
            <span className="text-sm text-gray-400 whitespace-nowrap">
              {totalActivos} {totalActivos === 1 ? 'activo' : 'activos'}
            </span>
          </div>

          {/* Listas agrupadas por categoría */}
          {groups.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">
              No encontramos nada con "{searchQuery}".
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => {
                const meta = catMeta(group.id)
                const Icon = meta.icon
                const isCollapsed = !!collapsed[group.id]
                return (
                  <div key={group.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    {/* Encabezado de categoría (colapsable) */}
                    <button
                      onClick={() => setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-violet-600" />
                        </span>
                        <span className="text-sm font-semibold text-gray-900">{group.label}</span>
                        <span className="text-xs font-medium text-gray-400">{group.items.length}</span>
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-gray-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                      />
                    </button>

                    {!isCollapsed && (
                      <div className="divide-y divide-gray-100 border-t border-gray-100">
                        {group.items.map((doc) => (
                          <div
                            key={doc.id}
                            className={`group flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors ${
                              !doc.activo ? 'opacity-60' : ''
                            }`}
                          >
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => openEdit(doc)}
                            >
                              <h4 className="font-medium text-gray-900 text-sm">{doc.titulo}</h4>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{doc.contenido}</p>
                              {!doc.activo && (
                                <span className="inline-block mt-1.5 text-[11px] font-medium text-gray-400">
                                  No lo está usando
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 pl-1">
                              {/* Toggle activo */}
                              <VioletToggle enabled={!!doc.activo} onChange={() => toggleActivo(doc)} />

                              {/* Acciones (siempre visibles en móvil, en hover en desktop) */}
                              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openEdit(doc)}
                                  className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50"
                                  title="Editar"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => { setDocToDelete(doc.id); setShowDeleteConfirm(true) }}
                                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-xs text-gray-400">
            Escríbelo como si le respondieras a un cliente. Tu agente lo usa solo cuando hace falta.
          </p>
        </>
      )}

      {/* ─── Panel lateral (alta / edición) ─── */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={closeSidebar} />
          <div
            className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
            style={{ animation: 'slideIn 0.2s ease-out' }}
          >
            <div className="px-6 py-4 border-b border-violet-100 bg-violet-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {editDoc ? 'Editar' : 'Algo que tu agente debe saber'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {editDoc ? 'Ajusta la pregunta o la respuesta' : 'Una pregunta frecuente o un dato del negocio'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeSidebar}
                className="p-2 rounded-lg hover:bg-white/60 text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Tema o pregunta */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tema o pregunta</label>
                <input
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  required
                  placeholder="Ej: ¿Cuánto cuesta un corte?"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                />
                <p className="text-xs text-gray-400 mt-1.5">Lo que el cliente preguntaría.</p>
              </div>

              {/* Categoría como chips */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIAS.map((c) => {
                    const Icon = c.icon
                    const active = form.categoria === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setForm({ ...form, categoria: c.id })}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          active
                            ? 'border-violet-500 bg-violet-50 text-violet-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {c.label}
                        {active && <Check className="h-3.5 w-3.5" />}
                      </button>
                    )
                  })}
                </div>
                {form.categoria === 'otro' && (
                  <input
                    value={customCat}
                    onChange={(e) => setCustomCat(e.target.value)}
                    placeholder="Nombre de la categoría (opcional)"
                    className="mt-3 w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                  />
                )}
              </div>

              {/* Respuesta / información */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Respuesta / información</label>
                <textarea
                  value={form.contenido}
                  onChange={(e) => setForm({ ...form, contenido: e.target.value })}
                  required
                  rows={10}
                  placeholder="Escribe la respuesta como se la darías a un cliente..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-none transition-all"
                />
                <p className="text-xs text-gray-400 mt-1.5">Tu agente usará esto para responder.</p>
              </div>

              {/* Activo */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <span className="text-sm font-medium text-gray-700">Activo</span>
                  <p className="text-xs text-gray-400">Si lo apagas, el agente deja de usarlo.</p>
                </div>
                <VioletToggle enabled={form.activo} onChange={() => setForm({ ...form, activo: !form.activo })} />
              </div>
            </form>

            {/* Acciones fijas abajo */}
            <div className="border-t border-gray-100 p-4 flex items-center gap-2 sm:gap-3 shrink-0">
              {editDoc && (
                <button
                  type="button"
                  onClick={() => { setDocToDelete(editDoc.id); setShowDeleteConfirm(true) }}
                  className="px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                  Eliminar
                </button>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={closeSidebar}
                className="px-3 sm:px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 transition-all disabled:opacity-50 shadow-lg shadow-violet-500/25"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editDoc ? 'Guardar' : 'Agregar'}
              </button>
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

      {/* Confirmación de borrado */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => { if (!deleting) { setShowDeleteConfirm(false); setDocToDelete(null) } }}
        onConfirm={handleDelete}
        loading={deleting}
        title="Eliminar"
        message="El agente ya no podrá usar esta información para responder."
        confirmText="Eliminar"
        variant="danger"
      />

      {/* Toast de feedback */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium shadow-xl">
          <Check className="h-4 w-4 text-emerald-400" />
          {toast.msg}
        </div>
      )}
    </div>
  )
}
