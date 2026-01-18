import { useState, useEffect } from 'react'
import { Search, RefreshCw, Download, Plus, User, Loader2, Check, X, MoreVertical, Trash2, UserRound } from 'lucide-react'
import Button from '../components/Button'
import { contactosApi } from '../api/client'

const ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'activo', label: 'Activos' },
  { value: 'inactivo', label: 'Inactivos' },
  { value: 'bloqueado', label: 'Bloqueados' },
  { value: 'modo_humano', label: '🧑 Modo Humano' },
]

export default function Contactos() {
  const [contactos, setContactos] = useState([])
  const [stats, setStats] = useState({ total: 0, activos: 0, inactivos: 0 })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [cleaning, setCleaning] = useState(false)
  const [verifyJob, setVerifyJob] = useState(null)
  
  // Filtros
  const [buscar, setBuscar] = useState('')
  const [estado, setEstado] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  
  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [formData, setFormData] = useState({ telefono: '', nombre: '', email: '', notas: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadContactos()
    loadStats()
    checkVerifyJobStatus()
  }, [page, estado])

  // Polling para verificar estado del job
  useEffect(() => {
    if (verifyJob && (verifyJob.estado === 'pendiente' || verifyJob.estado === 'procesando')) {
      const interval = setInterval(() => {
        checkVerifyJobStatus()
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [verifyJob])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      loadContactos()
    }, 300)
    return () => clearTimeout(timer)
  }, [buscar])

  const loadContactos = async () => {
    setLoading(true)
    try {
      // Si el filtro es modo_humano, usar endpoint especial
      if (estado === 'modo_humano') {
        const response = await contactosApi.listModoHumano()
        setContactos(response.data)
        setTotalPages(1)
      } else {
        const response = await contactosApi.list({ page, limit: 20, estado, buscar })
        setContactos(response.data.contactos)
        setTotalPages(response.data.pages)
      }
    } catch (error) {
      console.error('Error loading contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await contactosApi.stats()
      setStats(response.data)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const response = await contactosApi.sync()
      setSyncResult(response.data)
      loadContactos()
      loadStats()
      setTimeout(() => setSyncResult(null), 5000)
    } catch (error) {
      setSyncResult({ error: error.response?.data?.detail || 'Error de sincronización' })
    } finally {
      setSyncing(false)
    }
  }

  const handleLimpiarDuplicados = async () => {
    if (!confirm('¿Fusionar contactos duplicados? Esto combinará contactos con el mismo número de teléfono.')) return
    setCleaning(true)
    setSyncResult(null)
    try {
      const response = await contactosApi.limpiarDuplicados()
      setSyncResult({ 
        message: `Limpieza completada: ${response.data.grupos_fusionados} grupos fusionados, ${response.data.contactos_eliminados} duplicados eliminados` 
      })
      loadContactos()
      loadStats()
      setTimeout(() => setSyncResult(null), 5000)
    } catch (error) {
      setSyncResult({ error: error.response?.data?.detail || 'Error limpiando duplicados' })
    } finally {
      setCleaning(false)
    }
  }

  const checkVerifyJobStatus = async () => {
    try {
      const response = await contactosApi.verificarActivosEstado()
      if (response.data.job) {
        setVerifyJob(response.data.job)
        // Si el job terminó, recargar datos
        if (response.data.job.estado === 'completado') {
          loadContactos()
          loadStats()
        }
      }
    } catch (error) {
      console.error('Error checking job status:', error)
    }
  }

  const handleVerificarActivos = async () => {
    if (verifyJob && (verifyJob.estado === 'pendiente' || verifyJob.estado === 'procesando')) {
      alert('Ya hay una verificación en proceso')
      return
    }
    if (!confirm('¿Verificar todos los contactos activos? Este proceso corre en segundo plano y puede tardar varios minutos.')) return
    
    try {
      const response = await contactosApi.verificarActivos()
      if (response.data.job) {
        setVerifyJob(response.data.job)
      } else if (response.data.job_id) {
        checkVerifyJobStatus()
      }
      setSyncResult({ message: response.data.message })
      setTimeout(() => setSyncResult(null), 5000)
    } catch (error) {
      setSyncResult({ error: error.response?.data?.detail || 'Error iniciando verificación' })
    }
  }

  const handleExport = async () => {
    try {
      const response = await contactosApi.exportCsv()
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'contactos.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Error exporting:', error)
    }
  }

  const openCreateModal = () => {
    setEditingContact(null)
    setFormData({ telefono: '', nombre: '', email: '', notas: '' })
    setShowModal(true)
  }

  const openEditModal = (contact) => {
    setEditingContact(contact)
    setFormData({
      telefono: contact.telefono,
      nombre: contact.nombre || '',
      email: contact.email || '',
      notas: contact.notas || ''
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingContact) {
        await contactosApi.update(editingContact.id, formData)
      } else {
        await contactosApi.create(formData)
      }
      setShowModal(false)
      loadContactos()
      loadStats()
    } catch (error) {
      console.error('Error saving:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este contacto?')) return
    try {
      await contactosApi.delete(id)
      loadContactos()
      loadStats()
    } catch (error) {
      console.error('Error deleting:', error)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Nunca'
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now - date
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return 'Hoy'
    if (days === 1) return 'Ayer'
    if (days < 7) return `Hace ${days} días`
    if (days < 30) return `Hace ${Math.floor(days / 7)} sem`
    return `Hace ${Math.floor(days / 30)} meses`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contactos</h1>
          <p className="text-gray-500 text-sm">Gestiona tus contactos de WhatsApp</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button 
            variant="secondary" 
            onClick={handleVerificarActivos} 
            loading={verifyJob && (verifyJob.estado === 'pendiente' || verifyJob.estado === 'procesando')}
          >
            Verificar activos
          </Button>
          <Button variant="secondary" onClick={handleLimpiarDuplicados} loading={cleaning}>
            <Trash2 className="h-4 w-4 mr-2" />
            Limpiar duplicados
          </Button>
          <Button variant="secondary" onClick={handleSync} loading={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar
          </Button>
        </div>
      </div>

      {/* Job de Verificación en Progreso */}
      {verifyJob && (verifyJob.estado === 'pendiente' || verifyJob.estado === 'procesando') && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
              <span className="font-medium text-blue-800">Verificando contactos...</span>
            </div>
            <span className="text-sm text-blue-600">
              {verifyJob.procesados} de {verifyJob.total} ({verifyJob.progreso}%)
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${verifyJob.progreso}%` }}
            />
          </div>
          <p className="text-xs text-blue-600 mt-2">
            ✓ {verifyJob.exitosos} activos · ✗ {verifyJob.fallidos} inactivos
          </p>
        </div>
      )}

      {/* Job Completado */}
      {verifyJob && verifyJob.estado === 'completado' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-emerald-800">✓ Verificación completada</p>
            <p className="text-sm text-emerald-600">{verifyJob.mensaje}</p>
          </div>
          <button 
            onClick={() => setVerifyJob(null)}
            className="text-emerald-600 hover:text-emerald-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Sync Result */}
      {syncResult && (
        <div className={`p-4 rounded-lg ${syncResult.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {syncResult.error ? (
            <p>{syncResult.error}</p>
          ) : syncResult.message ? (
            <p>{syncResult.message}</p>
          ) : (
            <p>
              Sincronización completada: {syncResult.nuevos} nuevos, {syncResult.actualizados} actualizados
            </p>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-sm text-gray-500">Total</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-emerald-600">{stats.activos}</p>
          <p className="text-sm text-gray-500">Activos</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-amber-600">{stats.inactivos}</p>
          <p className="text-sm text-gray-500">Inactivos</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-red-600">{stats.sin_actividad_30d || 0}</p>
          <p className="text-sm text-gray-500">Sin actividad 30d</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por teléfono o nombre..."
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <select
          value={estado}
          onChange={(e) => { setEstado(e.target.value); setPage(1) }}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          {ESTADOS.map((e) => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
          </div>
        ) : contactos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No hay contactos</p>
            <p className="text-sm">Sincroniza desde WhatsApp o agrega manualmente</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Contacto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Último mensaje</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Mensajes</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contactos.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                        {contact.foto_url ? (
                          <img src={contact.foto_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-violet-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{contact.nombre || 'Sin nombre'}</p>
                        <p className="text-sm text-gray-500">{contact.telefono}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(contact.ultimo_mensaje)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {contact.total_mensajes || 0}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        contact.estado === 'activo' ? 'bg-emerald-100 text-emerald-700' :
                        contact.estado === 'inactivo' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {contact.estado}
                      </span>
                      {contact.modo_humano && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                          <UserRound className="h-3 w-3" />
                          Humano
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(contact)}
                        className="p-1 text-gray-400 hover:text-violet-600"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editingContact ? 'Editar Contacto' : 'Nuevo Contacto'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  disabled={!!editingContact}
                  placeholder="+52 55 1234 5678"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Juan Pérez"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="juan@ejemplo.com"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  rows={3}
                  placeholder="Notas sobre el contacto..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Modo Humano */}
              {editingContact && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Modo Humano</p>
                      <p className="text-xs text-gray-500">
                        {editingContact.modo_humano 
                          ? `Activo desde ${new Date(editingContact.modo_humano_desde).toLocaleString()}` 
                          : 'La IA responde automáticamente'}
                      </p>
                      {editingContact.modo_humano && editingContact.modo_humano_razon && (
                        <p className="text-xs text-orange-600 mt-1">Razón: {editingContact.modo_humano_razon}</p>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          if (editingContact.modo_humano) {
                            await contactosApi.desactivarModoHumano(editingContact.id)
                          } else {
                            await contactosApi.activarModoHumano(editingContact.id, 'Activado manualmente')
                          }
                          loadContactos()
                          setEditingContact({ ...editingContact, modo_humano: !editingContact.modo_humano })
                        } catch (err) {
                          console.error('Error toggling modo humano:', err)
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        editingContact.modo_humano
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      }`}
                    >
                      {editingContact.modo_humano ? 'Reactivar IA' : 'Activar Modo Humano'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              {editingContact && (
                <button
                  onClick={() => { handleDelete(editingContact.id); setShowModal(false) }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                >
                  Eliminar
                </button>
              )}
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} loading={saving}>
                {editingContact ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
