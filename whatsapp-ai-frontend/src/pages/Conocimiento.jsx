import { useState, useEffect } from 'react'
import { BookOpen, Plus, Search, RefreshCw, Trash2, Edit, X, Loader2 } from 'lucide-react'
import Button from '../components/Button'
import Toggle from '../components/Toggle'
import { conocimientoApi } from '../api/client'
import { ConfirmDialog } from '../components/ui'

export default function Conocimiento() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [syncing, setSyncing] = useState(false)

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [editDoc, setEditDoc] = useState(null)
  const [form, setForm] = useState({ titulo: '', contenido: '', categoria: 'general', activo: true })
  const [saving, setSaving] = useState(false)

  // Delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [docToDelete, setDocToDelete] = useState(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await conocimientoApi.list()
      setDocs(res.data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const openNew = () => {
    setEditDoc(null)
    setForm({ titulo: '', contenido: '', categoria: 'general', activo: true })
    setSidebarOpen(true)
  }

  const openEdit = (doc) => {
    setEditDoc(doc)
    setForm({ titulo: doc.titulo, contenido: doc.contenido, categoria: doc.categoria, activo: doc.activo })
    setSidebarOpen(true)
  }

  const closeSidebar = () => {
    setSidebarOpen(false)
    setEditDoc(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editDoc) await conocimientoApi.update(editDoc.id, form)
      else await conocimientoApi.create(form)
      closeSidebar()
      loadData()
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!docToDelete) return
    setShowDeleteConfirm(false)
    try {
      await conocimientoApi.delete(docToDelete)
      setDocToDelete(null)
      if (editDoc && editDoc.id === docToDelete) closeSidebar()
      loadData()
    } catch (e) { console.error(e) }
  }

  const handleSync = async () => {
    setSyncing(true)
    try { await conocimientoApi.sync(); loadData() } catch (e) { console.error(e) }
    setSyncing(false)
  }

  const categories = [...new Set(docs.map(d => d.categoria))]
  const filtered = docs.filter(d => {
    if (filterCat && d.categoria !== filterCat) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return d.titulo.toLowerCase().includes(q) || d.contenido.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="space-y-6 mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Base de Conocimiento</h1>
          <p className="text-gray-500 text-sm mt-1">Informacion que tu agente usa para responder a los clientes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleSync} loading={syncing} size="sm">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Sincronizar
          </Button>
          <Button onClick={openNew} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Nuevo
          </Button>
        </div>
      </div>

      {/* Search + filter + count */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todas</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-sm text-gray-400 whitespace-nowrap">{filtered.length} documentos</span>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-200" />
          <p className="text-gray-500">No hay documentos.</p>
          <button onClick={openNew} className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            Crear el primero
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {filtered.map(doc => (
            <div
              key={doc.id}
              className={`group flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer ${!doc.activo ? 'opacity-50' : ''}`}
              onClick={() => openEdit(doc)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-indigo-100 text-indigo-700">
                    {doc.categoria}
                  </span>
                  {!doc.activo && <span className="text-[11px] text-gray-400">Inactivo</span>}
                </div>
                <h4 className="font-medium text-gray-900 text-sm">{doc.titulo}</h4>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">{doc.contenido}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(doc) }}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-gray-100"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDocToDelete(doc.id); setShowDeleteConfirm(true) }}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help text */}
      <p className="text-xs text-gray-400">
        Escribe informacion como si hablaras con un cliente: precios, horarios, politicas, preguntas frecuentes.
        El agente la usara para responder automaticamente.
      </p>

      {/* Sidebar */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={closeSidebar} />
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col" style={{ animation: 'slideIn 0.2s ease-out' }}>
            <div className="px-6 py-4 border-b bg-indigo-50 border-indigo-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{editDoc ? 'Editar Documento' : 'Nuevo Documento'}</h3>
                  <p className="text-xs text-gray-500">{editDoc ? 'Modifica la informacion' : 'Agrega informacion para tu agente'}</p>
                </div>
              </div>
              <button onClick={closeSidebar} className="p-2 rounded-lg hover:bg-white/60 text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titulo</label>
                <input
                  value={form.titulo}
                  onChange={e => setForm({ ...form, titulo: e.target.value })}
                  required
                  placeholder="Ej: Precios y Planes"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <input
                  value={form.categoria}
                  onChange={e => setForm({ ...form, categoria: e.target.value })}
                  placeholder="general, precios, faq..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contenido</label>
                <textarea
                  value={form.contenido}
                  onChange={e => setForm({ ...form, contenido: e.target.value })}
                  required
                  rows={14}
                  placeholder="Escribe la informacion que el agente debe saber..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              {editDoc && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-700">Documento activo</span>
                  <Toggle enabled={form.activo} onChange={() => setForm({ ...form, activo: !form.activo })} />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeSidebar} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : editDoc ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
          <style>{`
            @keyframes slideIn {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setDocToDelete(null) }}
        onConfirm={handleDelete}
        title="Eliminar documento"
        message="El agente ya no podra usar esta informacion."
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  )
}
