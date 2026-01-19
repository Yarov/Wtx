import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Play, Pause, X, Eye, Loader2, Send, Clock, CheckCircle, XCircle, Users, Wand2, Search, User } from 'lucide-react'
import Button from '../components/Button'
import { campanasApi, contactosApi } from '../api/client'
import { ConfirmDialog } from '../components/ui'

const ESTADOS_BADGE = {
  borrador: { color: 'bg-gray-100 text-gray-700', label: 'Borrador' },
  programada: { color: 'bg-blue-100 text-blue-700', label: 'Programada' },
  enviando: { color: 'bg-amber-100 text-amber-700', label: 'Enviando' },
  pausada: { color: 'bg-orange-100 text-orange-700', label: 'Pausada' },
  completada: { color: 'bg-emerald-100 text-emerald-700', label: 'Completada' },
  cancelada: { color: 'bg-red-100 text-red-700', label: 'Cancelada' },
}

const VELOCIDADES = [
  { value: 10, label: 'Rápido (10s)', desc: 'Riesgo de ban' },
  { value: 30, label: 'Normal (30s)', desc: 'Recomendado' },
  { value: 60, label: 'Lento (60s)', desc: 'Más seguro' },
]

const FILTROS = [
  { value: 'todos', label: 'Todos los contactos activos' },
  { value: 'actividad', label: 'Activos recientemente', desc: 'Que escribieron en X días' },
  { value: 'sin_actividad', label: 'Para reactivar', desc: 'Que NO han escrito en X días' },
  { value: 'tag', label: 'Por etiqueta' },
  { value: 'tag_actividad', label: 'Etiqueta + Actividad' },
  { value: 'manual', label: 'Selección manual' },
]

const PERIODOS = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'ultimos_3_dias', label: 'Últimos 3 días' },
  { value: 'ultima_semana', label: 'Última semana' },
  { value: 'ultimas_2_semanas', label: 'Últimas 2 semanas' },
  { value: 'ultimo_mes', label: 'Último mes' },
  { value: 'ultimos_3_meses', label: 'Últimos 3 meses' },
]

const PERIODOS_SIN_ACTIVIDAD = [
  { value: 'ultima_semana', label: 'Más de 1 semana' },
  { value: 'ultimas_2_semanas', label: 'Más de 2 semanas' },
  { value: 'ultimo_mes', label: 'Más de 1 mes' },
  { value: 'ultimos_3_meses', label: 'Más de 3 meses' },
]

export default function Campanas() {
  const navigate = useNavigate()
  const [campanas, setCampanas] = useState([])
  const [stats, setStats] = useState({ total: 0, enviando: 0, completadas: 0 })
  const [contactosStats, setContactosStats] = useState({ total: 0 })
  const [loading, setLoading] = useState(true)
  
  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editingCampana, setEditingCampana] = useState(null)
  const [formData, setFormData] = useState({
    nombre: '',
    mensaje: '',
    filtro_tipo: 'todos',
    filtro_valor: {},
    velocidad: 30,
  })
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState('')
  
  // Confirm dialogs
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showIniciarConfirm, setShowIniciarConfirm] = useState(false)
  const [showCancelarConfirm, setShowCancelarConfirm] = useState(false)
  const [campanaToAction, setCampanaToAction] = useState(null)
  
  // Modal de prueba
  const [showTestModal, setShowTestModal] = useState(false)
  const [testMessage, setTestMessage] = useState('')
  const [selectedContacts, setSelectedContacts] = useState([])
  const [sendingTest, setSendingTest] = useState(false)
  const [testResult, setTestResult] = useState(null)
  
  // Búsqueda de contactos
  const [contactSearch, setContactSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchingContacts, setSearchingContacts] = useState(false)
  
  // IA
  const [improving, setImproving] = useState(false)
  const [aiObjective, setAiObjective] = useState('promocion')
  const [aiInstructions, setAiInstructions] = useState('')

  useEffect(() => {
    loadCampanas()
    loadStats()
    loadContactosStats()
    
    // Polling para actualizar campañas en progreso
    const interval = setInterval(() => {
      loadCampanas()
    }, 10000)
    
    return () => clearInterval(interval)
  }, [])

  const loadCampanas = async () => {
    try {
      const response = await campanasApi.list()
      setCampanas(response.data.campanas)
    } catch (error) {
      console.error('Error loading campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await campanasApi.stats()
      setStats(response.data)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const loadContactosStats = async () => {
    try {
      const response = await contactosApi.stats()
      setContactosStats(response.data)
    } catch (error) {
      console.error('Error loading contacts stats:', error)
    }
  }

  const openCreateModal = () => {
    setEditingCampana(null)
    setFormData({
      nombre: '',
      mensaje: '',
      filtro_tipo: 'todos',
      filtro_valor: {},
      velocidad: 30,
    })
    setPreview('')
    setShowModal(true)
  }

  const openEditModal = (campana) => {
    setEditingCampana(campana)
    setFormData({
      nombre: campana.nombre,
      mensaje: campana.mensaje,
      filtro_tipo: campana.filtro_tipo || 'todos',
      filtro_valor: campana.filtro_valor || {},
      velocidad: campana.velocidad || 30,
    })
    setPreview('')
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingCampana) {
        await campanasApi.update(editingCampana.id, formData)
      } else {
        await campanasApi.create(formData)
      }
      setShowModal(false)
      loadCampanas()
      loadStats()
    } catch (error) {
      console.error('Error saving:', error)
      alert(error.response?.data?.detail || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const openDeleteConfirm = (id) => {
    setCampanaToAction(id)
    setShowDeleteConfirm(true)
  }

  const openIniciarConfirm = (id) => {
    setCampanaToAction(id)
    setShowIniciarConfirm(true)
  }

  const openCancelarConfirm = (id) => {
    setCampanaToAction(id)
    setShowCancelarConfirm(true)
  }

  const handleDelete = async () => {
    const id = campanaToAction
    setShowDeleteConfirm(false)
    setCampanaToAction(null)
    try {
      await campanasApi.delete(id)
      loadCampanas()
      loadStats()
    } catch (error) {
      console.error('Error deleting:', error)
    }
  }

  const handleIniciar = async () => {
    const id = campanaToAction
    setShowIniciarConfirm(false)
    setCampanaToAction(null)
    try {
      await campanasApi.iniciar(id)
      loadCampanas()
    } catch (error) {
      alert(error.response?.data?.detail || 'Error al iniciar')
    }
  }

  const handlePausar = async (id) => {
    try {
      await campanasApi.pausar(id)
      loadCampanas()
    } catch (error) {
      alert(error.response?.data?.detail || 'Error al pausar')
    }
  }

  const handleReanudar = async (id) => {
    try {
      await campanasApi.reanudar(id)
      loadCampanas()
    } catch (error) {
      alert(error.response?.data?.detail || 'Error al reanudar')
    }
  }

  const handleCancelar = async () => {
    const id = campanaToAction
    setShowCancelarConfirm(false)
    setCampanaToAction(null)
    try {
      await campanasApi.cancelar(id)
      loadCampanas()
    } catch (error) {
      alert(error.response?.data?.detail || 'Error al cancelar')
    }
  }

  const loadPreview = async () => {
    if (!editingCampana) {
      // Para nueva campaña, hacer preview local
      let msg = formData.mensaje
      msg = msg.replace('{nombre}', 'Juan Pérez')
      msg = msg.replace('{telefono}', '+52 55 1234 5678')
      setPreview(msg)
      return
    }
    try {
      const response = await campanasApi.preview(editingCampana.id)
      setPreview(response.data.preview)
    } catch (error) {
      console.error('Error loading preview:', error)
    }
  }

  const getProgress = (campana) => {
    if (campana.total_destinatarios === 0) return 0
    return Math.round((campana.enviados / campana.total_destinatarios) * 100)
  }

  const [previewCount, setPreviewCount] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const loadPreviewCount = async () => {
    setLoadingPreview(true)
    try {
      const response = await campanasApi.previewDestinatarios({
        filtro_tipo: formData.filtro_tipo,
        filtro_valor: formData.filtro_valor
      })
      setPreviewCount(response.data.total)
    } catch (error) {
      console.error('Error loading preview:', error)
      setPreviewCount(null)
    } finally {
      setLoadingPreview(false)
    }
  }

  // Auto-load preview when filter changes
  useEffect(() => {
    if (showModal) {
      loadPreviewCount()
    }
  }, [formData.filtro_tipo, formData.filtro_valor, showModal])

  const getDestinatariosCount = () => {
    if (loadingPreview) return '...'
    if (previewCount !== null) return previewCount
    if (formData.filtro_tipo === 'todos') return contactosStats.total
    return '?'
  }

  const openTestModal = () => {
    setTestMessage('')
    setSelectedContacts([])
    setTestResult(null)
    setContactSearch('')
    setSearchResults([])
    setShowTestModal(true)
  }

  const searchContacts = async (query) => {
    setContactSearch(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    
    setSearchingContacts(true)
    try {
      const response = await contactosApi.list({ buscar: query, limit: 10 })
      setSearchResults(response.data.contactos || [])
    } catch (error) {
      console.error('Error searching contacts:', error)
    } finally {
      setSearchingContacts(false)
    }
  }

  const addContact = (contact) => {
    if (!selectedContacts.find(c => c.id === contact.id)) {
      setSelectedContacts([...selectedContacts, contact])
    }
    setContactSearch('')
    setSearchResults([])
  }

  const removeContact = (contactId) => {
    setSelectedContacts(selectedContacts.filter(c => c.id !== contactId))
  }

  const handleSendTest = async () => {
    if (!testMessage.trim()) {
      alert('Escribe un mensaje')
      return
    }
    if (selectedContacts.length === 0) {
      alert('Selecciona al menos un contacto')
      return
    }

    const phones = selectedContacts.map(c => c.telefono)

    setSendingTest(true)
    setTestResult(null)
    try {
      const response = await campanasApi.enviarPrueba({
        mensaje: testMessage,
        telefonos: phones
      })
      setTestResult(response.data)
    } catch (error) {
      setTestResult({ error: error.response?.data?.detail || 'Error enviando prueba' })
    } finally {
      setSendingTest(false)
    }
  }

  const handleImproveMessage = async (target = 'form') => {
    setImproving(true)
    try {
      const currentMessage = target === 'test' ? testMessage : formData.mensaje
      const response = await campanasApi.mejorarMensaje({
        mensaje: currentMessage,
        objetivo: aiObjective,
        instrucciones: aiInstructions
      })
      if (response.data?.mensaje) {
        if (target === 'test') {
          setTestMessage(response.data.mensaje)
        } else {
          setFormData({ ...formData, mensaje: response.data.mensaje })
        }
      }
    } catch (error) {
      alert(error.response?.data?.detail || 'Error al mejorar mensaje')
    } finally {
      setImproving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campañas</h1>
          <p className="text-gray-500 text-sm">Envía mensajes masivos a tus contactos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={openTestModal}>
            <Send className="h-4 w-4 mr-2" />
            Probar mensaje
          </Button>
          <Button onClick={() => navigate('/campanas/nueva')}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Campaña
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-sm text-gray-500">Total</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-amber-600">{stats.enviando}</p>
          <p className="text-sm text-gray-500">En progreso</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-emerald-600">{stats.completadas}</p>
          <p className="text-sm text-gray-500">Completadas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-violet-600">{contactosStats.total}</p>
          <p className="text-sm text-gray-500">Contactos</p>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
          </div>
        ) : campanas.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Send className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No hay campañas</p>
            <p className="text-sm text-gray-400">Crea tu primera campaña para enviar mensajes masivos</p>
          </div>
        ) : (
          campanas.map((campana) => (
            <div key={campana.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{campana.nombre}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ESTADOS_BADGE[campana.estado]?.color}`}>
                      {ESTADOS_BADGE[campana.estado]?.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {campana.total_destinatarios} destinatarios
                    {campana.estado === 'enviando' || campana.estado === 'completada' ? (
                      <> • {campana.enviados} enviados • {campana.respondidos} respondidos</>
                    ) : null}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  {campana.estado === 'borrador' && (
                    <>
                      <button
                        onClick={() => openEditModal(campana)}
                        className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <Button size="sm" onClick={() => openIniciarConfirm(campana.id)}>
                        <Play className="h-4 w-4 mr-1" />
                        Iniciar
                      </Button>
                    </>
                  )}
                  {campana.estado === 'enviando' && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => handlePausar(campana.id)}>
                        <Pause className="h-4 w-4 mr-1" />
                        Pausar
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => openCancelarConfirm(campana.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {campana.estado === 'pausada' && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => handleReanudar(campana.id)}>
                        <Play className="h-4 w-4 mr-1" />
                        Reanudar
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => openCancelarConfirm(campana.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {(campana.estado === 'completada' || campana.estado === 'cancelada') && (
                    <button
                      onClick={() => openDeleteConfirm(campana.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar for active campaigns */}
              {(campana.estado === 'enviando' || campana.estado === 'pausada') && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-500">Progreso</span>
                    <span className="font-medium">{getProgress(campana)}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${campana.estado === 'pausada' ? 'bg-orange-500' : 'bg-violet-500'}`}
                      style={{ width: `${getProgress(campana)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Stats for completed */}
              {campana.estado === 'completada' && (
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span>{campana.enviados} enviados</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span>{campana.fallidos} fallidos</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-violet-500" />
                    <span>{campana.respondidos} respondidos</span>
                  </div>
                </div>
              )}

              {/* Message preview */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 line-clamp-2">{campana.mensaje}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {editingCampana ? 'Editar Campaña' : 'Nueva Campaña'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la campaña</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Reactivación Febrero"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Destinatarios */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Destinatarios</label>
                <div className="space-y-2">
                  {FILTROS.map((filtro) => (
                    <label key={filtro.value} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="filtro"
                        checked={formData.filtro_tipo === filtro.value}
                        onChange={() => setFormData({ ...formData, filtro_tipo: filtro.value, filtro_valor: {} })}
                        className="text-violet-600"
                      />
                      <span className="text-sm">{filtro.label}</span>
                    </label>
                  ))}
                </div>
                
                {/* Filtro por actividad */}
                {formData.filtro_tipo === 'actividad' && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contactos que escribieron en:
                    </label>
                    <select
                      value={formData.filtro_valor.periodo || 'ultima_semana'}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        filtro_valor: { ...formData.filtro_valor, periodo: e.target.value } 
                      })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                      {PERIODOS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Filtro por tag */}
                {formData.filtro_tipo === 'tag' && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Etiqueta:
                    </label>
                    <input
                      type="text"
                      value={formData.filtro_valor.tag || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        filtro_valor: { ...formData.filtro_valor, tag: e.target.value } 
                      })}
                      placeholder="Ej: vip, interesado, cliente"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                )}

                {/* Filtro combinado tag + actividad */}
                {formData.filtro_tipo === 'tag_actividad' && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Etiqueta:
                      </label>
                      <input
                        type="text"
                        value={formData.filtro_valor.tag || ''}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          filtro_valor: { ...formData.filtro_valor, tag: e.target.value } 
                        })}
                        placeholder="Ej: vip, interesado"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Que escribieron en:
                      </label>
                      <select
                        value={formData.filtro_valor.periodo || 'ultima_semana'}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          filtro_valor: { ...formData.filtro_valor, periodo: e.target.value } 
                        })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      >
                        {PERIODOS.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Filtro sin actividad (para reactivación) */}
                {formData.filtro_tipo === 'sin_actividad' && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <label className="block text-sm font-medium text-amber-800 mb-2">
                      Contactos que NO han escrito en:
                    </label>
                    <select
                      value={formData.filtro_valor.periodo || 'ultimo_mes'}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        filtro_valor: { ...formData.filtro_valor, periodo: e.target.value } 
                      })}
                      className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm"
                    >
                      {PERIODOS_SIN_ACTIVIDAD.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-amber-600">
                      Ideal para campañas de reactivación
                    </p>
                  </div>
                )}

                {/* Excluir contactos con campaña reciente */}
                <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="excluir-campana-check"
                      checked={!!formData.filtro_valor.excluir_campana_dias}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        filtro_valor: { 
                          ...formData.filtro_valor, 
                          excluir_campana_dias: e.target.checked ? 7 : null 
                        } 
                      })}
                      className="rounded text-emerald-600"
                    />
                    <label htmlFor="excluir-campana-check" className="text-sm text-gray-700">
                      Excluir si recibió campaña en últimos
                    </label>
                    {formData.filtro_valor.excluir_campana_dias && (
                      <>
                        <input
                          type="number"
                          value={formData.filtro_valor.excluir_campana_dias}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            filtro_valor: { ...formData.filtro_valor, excluir_campana_dias: parseInt(e.target.value) || 7 } 
                          })}
                          className="w-16 px-2 py-1 border border-gray-200 rounded text-sm"
                        />
                        <span className="text-sm text-gray-500">días</span>
                      </>
                    )}
                  </div>
                  
                  {/* Límite opcional */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="limite-check"
                      checked={!!formData.filtro_valor.limite}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        filtro_valor: { 
                          ...formData.filtro_valor, 
                          limite: e.target.checked ? 100 : null 
                        } 
                      })}
                      className="rounded text-emerald-600"
                    />
                    <label htmlFor="limite-check" className="text-sm text-gray-700">
                      Limitar a máximo
                    </label>
                    {formData.filtro_valor.limite && (
                      <>
                        <input
                          type="number"
                          value={formData.filtro_valor.limite}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            filtro_valor: { ...formData.filtro_valor, limite: parseInt(e.target.value) || 100 } 
                          })}
                          className="w-20 px-2 py-1 border border-gray-200 rounded text-sm"
                        />
                        <span className="text-sm text-gray-500">contactos</span>
                      </>
                    )}
                  </div>
                </div>

                <p className="mt-2 text-sm text-gray-500">
                  Aproximadamente <strong>{getDestinatariosCount()}</strong> contactos
                </p>
              </div>

              {/* Mensaje */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje</label>
                <textarea
                  value={formData.mensaje}
                  onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })}
                  rows={5}
                  placeholder="¡Hola {nombre}! Te extrañamos..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Variables disponibles: <code className="bg-gray-100 px-1 rounded">{'{nombre}'}</code> <code className="bg-gray-100 px-1 rounded">{'{telefono}'}</code>
                </p>
                
                {/* IA Controls */}
                <div className="mt-3 p-3 bg-violet-50 border border-violet-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Wand2 className="h-4 w-4 text-violet-600" />
                    <span className="text-sm font-medium text-violet-700">Asistente IA</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {[
                      { value: 'promocion', label: 'Promoción' },
                      { value: 'reactivacion', label: 'Reactivación' },
                      { value: 'informativo', label: 'Informativo' },
                      { value: 'recordatorio', label: 'Recordatorio' },
                      { value: 'agradecimiento', label: 'Agradecimiento' },
                    ].map((obj) => (
                      <button
                        key={obj.value}
                        onClick={() => setAiObjective(obj.value)}
                        className={`px-2 py-1 text-xs rounded-full transition-all ${
                          aiObjective === obj.value
                            ? 'bg-violet-600 text-white'
                            : 'bg-white text-violet-600 border border-violet-300 hover:bg-violet-100'
                        }`}
                      >
                        {obj.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiInstructions}
                      onChange={(e) => setAiInstructions(e.target.value)}
                      placeholder="Instrucciones adicionales (opcional)..."
                      className="flex-1 px-3 py-1.5 text-sm border border-violet-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <button
                      onClick={() => handleImproveMessage('form')}
                      disabled={improving}
                      className="px-3 py-1.5 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      {improving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      {formData.mensaje ? 'Mejorar' : 'Generar'}
                    </button>
                  </div>
                </div>
                
                <button
                  onClick={loadPreview}
                  className="mt-2 text-sm text-violet-600 hover:text-violet-700"
                >
                  Ver vista previa
                </button>
                
                {preview && (
                  <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-sm text-emerald-800 whitespace-pre-wrap">{preview}</p>
                  </div>
                )}
              </div>

              {/* Velocidad */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Velocidad de envío</label>
                <div className="grid grid-cols-3 gap-3">
                  {VELOCIDADES.map((vel) => (
                    <button
                      key={vel.value}
                      onClick={() => setFormData({ ...formData, velocidad: vel.value })}
                      className={`p-3 border-2 rounded-lg text-left transition-all ${
                        formData.velocidad === vel.value
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium text-sm">{vel.label}</p>
                      <p className="text-xs text-gray-500">{vel.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} loading={saving}>
                {editingCampana ? 'Guardar' : 'Crear Campaña'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Prueba */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Probar Mensaje</h2>
                <button onClick={() => setShowTestModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">Envía un mensaje de prueba antes de crear una campaña</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje</label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  rows={4}
                  placeholder="¡Hola {nombre}! Este es un mensaje de prueba..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Variables: <code className="bg-gray-100 px-1 rounded">{'{nombre}'}</code> <code className="bg-gray-100 px-1 rounded">{'{telefono}'}</code>
                </p>
                
                {/* IA Controls for Test */}
                <div className="mt-2 flex gap-2">
                  <select
                    value={aiObjective}
                    onChange={(e) => setAiObjective(e.target.value)}
                    className="px-2 py-1.5 text-sm border border-violet-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="promocion">Promoción</option>
                    <option value="reactivacion">Reactivación</option>
                    <option value="informativo">Informativo</option>
                    <option value="recordatorio">Recordatorio</option>
                    <option value="agradecimiento">Agradecimiento</option>
                  </select>
                  <button
                    onClick={() => handleImproveMessage('test')}
                    disabled={improving}
                    className="px-3 py-1.5 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {improving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {testMessage ? 'Mejorar con IA' : 'Generar con IA'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contactos de prueba</label>
                
                {/* Contactos seleccionados */}
                {selectedContacts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-1 px-2 py-1 bg-violet-100 text-violet-700 rounded-full text-sm"
                      >
                        <span>{contact.nombre || contact.telefono}</span>
                        <button
                          onClick={() => removeContact(contact.id)}
                          className="hover:text-violet-900"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Buscador */}
                <div className="relative">
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-violet-500">
                    <Search className="h-4 w-4 text-gray-400 ml-3" />
                    <input
                      type="text"
                      value={contactSearch}
                      onChange={(e) => searchContacts(e.target.value)}
                      placeholder="Buscar contacto por nombre o teléfono..."
                      className="flex-1 px-3 py-2 text-sm focus:outline-none"
                    />
                    {searchingContacts && <Loader2 className="h-4 w-4 text-gray-400 mr-3 animate-spin" />}
                  </div>
                  
                  {/* Resultados de búsqueda */}
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {searchResults.map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => addContact(contact)}
                          disabled={selectedContacts.find(c => c.id === contact.id)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-violet-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{contact.nombre || 'Sin nombre'}</p>
                            <p className="text-xs text-gray-500">{contact.telefono}</p>
                          </div>
                          {selectedContacts.find(c => c.id === contact.id) && (
                            <CheckCircle className="h-4 w-4 text-emerald-500 ml-auto" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <p className="mt-1 text-xs text-gray-500">
                  Busca y selecciona los contactos a los que enviar la prueba
                </p>
              </div>

              {/* Resultado */}
              {testResult && (
                <div className={`p-4 rounded-lg ${testResult.error ? 'bg-red-50' : 'bg-emerald-50'}`}>
                  {testResult.error ? (
                    <p className="text-red-700 text-sm">{testResult.error}</p>
                  ) : (
                    <div>
                      <p className="text-emerald-700 font-medium">
                        ✓ {testResult.exitosos} de {testResult.total} enviados
                      </p>
                      {testResult.resultados && (
                        <div className="mt-2 space-y-1">
                          {testResult.resultados.map((r, i) => (
                            <div key={i} className="text-sm flex items-center gap-2">
                              {r.enviado ? (
                                <CheckCircle className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                              <span className={r.enviado ? 'text-emerald-700' : 'text-red-700'}>
                                {r.telefono} {r.nombre && `(${r.nombre})`}
                              </span>
                              {r.error && <span className="text-red-500 text-xs">- {r.error}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowTestModal(false)}>
                Cerrar
              </Button>
              <Button onClick={handleSendTest} loading={sendingTest}>
                <Send className="h-4 w-4 mr-2" />
                Enviar prueba
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setCampanaToAction(null) }}
        onConfirm={handleDelete}
        title="¿Eliminar esta campaña?"
        message="Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
      <ConfirmDialog
        isOpen={showIniciarConfirm}
        onClose={() => { setShowIniciarConfirm(false); setCampanaToAction(null) }}
        onConfirm={handleIniciar}
        title="¿Iniciar envío de esta campaña?"
        message="Los mensajes comenzarán a enviarse según la velocidad configurada."
        confirmText="Iniciar"
        cancelText="Cancelar"
        variant="info"
      />
      <ConfirmDialog
        isOpen={showCancelarConfirm}
        onClose={() => { setShowCancelarConfirm(false); setCampanaToAction(null) }}
        onConfirm={handleCancelar}
        title="¿Cancelar esta campaña?"
        message="Se detendrá el envío y no se podrá reanudar."
        confirmText="Cancelar campaña"
        cancelText="Volver"
        variant="danger"
      />
    </div>
  )
}
