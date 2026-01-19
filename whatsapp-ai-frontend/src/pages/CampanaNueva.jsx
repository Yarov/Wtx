import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Users, Clock, Send, Wand2, Loader2, 
  CheckCircle, Calendar, Tag, Filter, Zap, Eye,
  MessageSquare, Settings, Sparkles
} from 'lucide-react'
import Button from '../components/Button'
import { campanasApi } from '../api/client'

const FILTROS = [
  { 
    value: 'todos', 
    label: 'Todos los activos', 
    desc: 'Todos los contactos con estado activo',
    icon: Users,
    color: 'indigo'
  },
  { 
    value: 'actividad', 
    label: 'Activos recientemente', 
    desc: 'Que escribieron en los últimos días',
    icon: Zap,
    color: 'blue'
  },
  { 
    value: 'sin_actividad', 
    label: 'Para reactivar', 
    desc: 'Que NO han escrito en un tiempo',
    icon: Clock,
    color: 'amber'
  },
  { 
    value: 'tag', 
    label: 'Por etiqueta', 
    desc: 'Filtrar por tag específico',
    icon: Tag,
    color: 'violet'
  },
]

const PERIODOS_ACTIVIDAD = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'ultimos_3_dias', label: 'Últimos 3 días' },
  { value: 'ultima_semana', label: 'Última semana' },
  { value: 'ultimas_2_semanas', label: 'Últimas 2 semanas' },
  { value: 'ultimo_mes', label: 'Último mes' },
]

const PERIODOS_SIN_ACTIVIDAD = [
  { value: 'ultima_semana', label: 'Más de 1 semana' },
  { value: 'ultimas_2_semanas', label: 'Más de 2 semanas' },
  { value: 'ultimo_mes', label: 'Más de 1 mes' },
  { value: 'ultimos_3_meses', label: 'Más de 3 meses' },
]

const VELOCIDADES = [
  { value: 30, label: 'Normal', desc: '30 seg', recommended: true },
  { value: 45, label: 'Moderado', desc: '45 seg', recommended: false },
  { value: 60, label: 'Seguro', desc: '60 seg', recommended: false },
]

const OBJETIVOS_IA = [
  { value: 'promocion', label: 'Promoción' },
  { value: 'reactivacion', label: 'Reactivación' },
  { value: 'informativo', label: 'Informativo' },
  { value: 'recordatorio', label: 'Recordatorio' },
  { value: 'agradecimiento', label: 'Agradecimiento' },
]

export default function CampanaNueva() {
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    nombre: '',
    mensaje: '',
    filtro_tipo: 'todos',
    filtro_valor: {},
    velocidad: 30,
  })
  
  const [previewCount, setPreviewCount] = useState(null)
  const [previewMuestra, setPreviewMuestra] = useState([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [improving, setImproving] = useState(false)
  const [aiObjective, setAiObjective] = useState('promocion')
  
  // Cargar preview cuando cambian los filtros
  useEffect(() => {
    loadPreview()
  }, [formData.filtro_tipo, formData.filtro_valor])
  
  const loadPreview = async () => {
    setLoadingPreview(true)
    try {
      const response = await campanasApi.previewDestinatarios({
        filtro_tipo: formData.filtro_tipo,
        filtro_valor: formData.filtro_valor
      })
      setPreviewCount(response.data.total)
      setPreviewMuestra(response.data.muestra || [])
    } catch (error) {
      console.error('Error loading preview:', error)
      setPreviewCount(null)
    } finally {
      setLoadingPreview(false)
    }
  }
  
  const handleImproveMessage = async () => {
    if (improving) return
    setImproving(true)
    try {
      const response = await campanasApi.mejorarMensaje({
        mensaje: formData.mensaje,
        objetivo: aiObjective,
      })
      if (response.data?.mensaje) {
        setFormData({ ...formData, mensaje: response.data.mensaje })
      }
    } catch (error) {
      alert(error.response?.data?.detail || 'Error al mejorar mensaje')
    } finally {
      setImproving(false)
    }
  }
  
  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      alert('Ingresa un nombre para la campaña')
      return
    }
    if (!formData.mensaje.trim()) {
      alert('Escribe el mensaje de la campaña')
      return
    }
    
    setSaving(true)
    try {
      await campanasApi.create(formData)
      navigate('/campanas')
    } catch (error) {
      alert(error.response?.data?.detail || 'Error al crear campaña')
    } finally {
      setSaving(false)
    }
  }
  
  const updateFiltroValor = (key, value) => {
    setFormData({
      ...formData,
      filtro_valor: { ...formData.filtro_valor, [key]: value }
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/campanas')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Nueva Campaña</h1>
                <p className="text-sm text-gray-500">Configura y envía mensajes masivos</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={() => navigate('/campanas')}>
                Cancelar
              </Button>
              <Button onClick={handleSave} loading={saving}>
                <Send className="h-4 w-4 mr-2" />
                Crear Campaña
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-3 gap-8">
          
          {/* Columna izquierda - Configuración */}
          <div className="col-span-2 space-y-6">
            
            {/* Nombre */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de la campaña
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: Promoción Febrero, Reactivación Clientes..."
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            
            {/* Destinatarios */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-gray-900">Destinatarios</h2>
              </div>
              
              {/* Filtros principales */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {FILTROS.map((filtro) => {
                  const Icon = filtro.icon
                  const isSelected = formData.filtro_tipo === filtro.value
                  return (
                    <button
                      key={filtro.value}
                      onClick={() => setFormData({ ...formData, filtro_tipo: filtro.value, filtro_valor: {} })}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? `border-${filtro.color}-500 bg-${filtro.color}-50`
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isSelected ? `bg-${filtro.color}-100` : 'bg-gray-100'}`}>
                          <Icon className={`h-5 w-5 ${isSelected ? `text-${filtro.color}-600` : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <p className={`font-medium ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                            {filtro.label}
                          </p>
                          <p className="text-xs text-gray-500">{filtro.desc}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              
              {/* Opciones según filtro */}
              {formData.filtro_tipo === 'actividad' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <label className="block text-sm font-medium text-blue-800 mb-2">
                    Que escribieron en:
                  </label>
                  <select
                    value={formData.filtro_valor.periodo || 'ultima_semana'}
                    onChange={(e) => updateFiltroValor('periodo', e.target.value)}
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white"
                  >
                    {PERIODOS_ACTIVIDAD.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {formData.filtro_tipo === 'sin_actividad' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <label className="block text-sm font-medium text-amber-800 mb-2">
                    Que NO han escrito en:
                  </label>
                  <select
                    value={formData.filtro_valor.periodo || 'ultimo_mes'}
                    onChange={(e) => updateFiltroValor('periodo', e.target.value)}
                    className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white"
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
              
              {formData.filtro_tipo === 'tag' && (
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 mb-4">
                  <label className="block text-sm font-medium text-violet-800 mb-2">
                    Etiqueta:
                  </label>
                  <input
                    type="text"
                    value={formData.filtro_valor.tag || ''}
                    onChange={(e) => updateFiltroValor('tag', e.target.value)}
                    placeholder="Ej: vip, cliente, interesado..."
                    className="w-full px-3 py-2 border border-violet-200 rounded-lg text-sm bg-white"
                  />
                </div>
              )}
              
              {/* Opciones adicionales */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="excluir-campana"
                    checked={!!formData.filtro_valor.excluir_campana_dias}
                    onChange={(e) => updateFiltroValor('excluir_campana_dias', e.target.checked ? 7 : null)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="excluir-campana" className="text-sm text-gray-700 flex items-center gap-2">
                    Excluir si recibió campaña en últimos
                    {formData.filtro_valor.excluir_campana_dias && (
                      <input
                        type="number"
                        value={formData.filtro_valor.excluir_campana_dias}
                        onChange={(e) => updateFiltroValor('excluir_campana_dias', parseInt(e.target.value) || 7)}
                        className="w-16 px-2 py-1 border border-gray-200 rounded text-sm"
                      />
                    )}
                    {formData.filtro_valor.excluir_campana_dias && <span>días</span>}
                  </label>
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="limite"
                    checked={!!formData.filtro_valor.limite}
                    onChange={(e) => updateFiltroValor('limite', e.target.checked ? 100 : null)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="limite" className="text-sm text-gray-700 flex items-center gap-2">
                    Limitar a máximo
                    {formData.filtro_valor.limite && (
                      <input
                        type="number"
                        value={formData.filtro_valor.limite}
                        onChange={(e) => updateFiltroValor('limite', parseInt(e.target.value) || 100)}
                        className="w-20 px-2 py-1 border border-gray-200 rounded text-sm"
                      />
                    )}
                    {formData.filtro_valor.limite && <span>contactos</span>}
                  </label>
                </div>
              </div>
            </div>
            
            {/* Mensaje */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Mensaje</h2>
                </div>
                
                <div className="flex items-center gap-2">
                  <select
                    value={aiObjective}
                    onChange={(e) => setAiObjective(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
                  >
                    {OBJETIVOS_IA.map((obj) => (
                      <option key={obj.value} value={obj.value}>{obj.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleImproveMessage}
                    disabled={improving}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm rounded-lg hover:from-violet-600 hover:to-purple-700 disabled:opacity-50"
                  >
                    {improving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {formData.mensaje ? 'Mejorar con IA' : 'Generar con IA'}
                  </button>
                </div>
              </div>
              
              <textarea
                value={formData.mensaje}
                onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })}
                rows={6}
                placeholder="Escribe tu mensaje aquí...

Usa variables para personalizar:
• {nombre} - Nombre del contacto
• {telefono} - Teléfono del contacto"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              
              <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{'{nombre}'}</code>
                  Nombre
                </span>
                <span className="flex items-center gap-1">
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{'{telefono}'}</code>
                  Teléfono
                </span>
              </div>
            </div>
            
            {/* Velocidad */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-gray-900">Velocidad de envío</h2>
              </div>
              
              {/* Explicación */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-800">
                  <strong>¿Por qué esperar entre mensajes?</strong><br />
                  WhatsApp detecta envíos masivos muy rápidos y puede bloquear tu número. 
                  Recomendamos mínimo 30 segundos entre cada mensaje para simular un comportamiento humano natural.
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                {VELOCIDADES.map((vel) => (
                  <button
                    key={vel.value}
                    onClick={() => setFormData({ ...formData, velocidad: vel.value })}
                    className={`p-4 rounded-xl border-2 text-center transition-all relative ${
                      formData.velocidad === vel.value
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {vel.recommended && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">
                        Recomendado
                      </span>
                    )}
                    <p className="text-2xl font-bold text-gray-900 mt-1">{vel.desc}</p>
                    <p className="font-medium text-gray-700">{vel.label}</p>
                  </button>
                ))}
              </div>
              
              <p className="text-xs text-gray-500 mt-3 text-center">
                A mayor tiempo de espera, menor riesgo de que WhatsApp bloquee tu número
              </p>
            </div>
          </div>
          
          {/* Columna derecha - Preview */}
          <div className="space-y-6">
            {/* Preview de destinatarios */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-24">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-gray-900">Vista previa</h2>
              </div>
              
              {/* Contador de destinatarios */}
              <div className="text-center py-4 bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-200 rounded-xl mb-4">
                {loadingPreview ? (
                  <Loader2 className="h-6 w-6 text-indigo-500 animate-spin mx-auto" />
                ) : (
                  <>
                    <p className="text-3xl font-bold text-indigo-600">
                      {previewCount !== null ? previewCount.toLocaleString() : '--'}
                    </p>
                    <p className="text-sm text-indigo-700">destinatarios</p>
                  </>
                )}
              </div>
              
              {/* Preview del mensaje - Mockup WhatsApp */}
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Vista del mensaje:</p>
                <div className="bg-[#0b141a] rounded-2xl p-3 shadow-lg">
                  {/* Header del chat */}
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
                    <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">TN</span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">Tu Negocio</p>
                      <p className="text-gray-400 text-xs">en línea</p>
                    </div>
                  </div>
                  
                  {/* Mensaje */}
                  <div className="pt-3 pb-2">
                    <div className="bg-[#005c4b] rounded-lg rounded-tl-none p-3 max-w-[90%] ml-auto shadow">
                      <p className="text-white text-sm whitespace-pre-wrap break-words">
                        {formData.mensaje 
                          ? formData.mensaje
                              .replace('{nombre}', 'Juan')
                              .replace('{telefono}', '+52 55 1234 5678')
                          : 'Tu mensaje aparecerá aquí...'}
                      </p>
                      <p className="text-right text-[10px] text-indigo-200 mt-1">
                        {new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} ✓✓
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Muestra de contactos */}
              {previewMuestra.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Muestra:</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {previewMuestra.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                          <span className="text-indigo-700 text-sm font-medium">
                            {(c.nombre || c.telefono || '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {c.nombre || 'Sin nombre'}
                          </p>
                          <p className="text-xs text-gray-500">{c.telefono}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Resumen de configuración */}
              <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-700 mb-2">Configuración:</p>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>• Filtro: {FILTROS.find(f => f.value === formData.filtro_tipo)?.label}</p>
                  <p>• Velocidad: {formData.velocidad} seg entre mensajes</p>
                  {formData.filtro_valor.excluir_campana_dias && (
                    <p>• Excluir campañas: últimos {formData.filtro_valor.excluir_campana_dias} días</p>
                  )}
                  {formData.filtro_valor.limite && (
                    <p>• Límite: {formData.filtro_valor.limite} contactos</p>
                  )}
                </div>
              </div>
              
              {/* Tiempo estimado */}
              {previewCount && previewCount > 0 && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-900">Tiempo estimado</span>
                  </div>
                  <div className="text-center">
                    {(() => {
                      const totalSeconds = previewCount * formData.velocidad
                      const hours = Math.floor(totalSeconds / 3600)
                      const minutes = Math.ceil((totalSeconds % 3600) / 60)
                      
                      if (hours > 0) {
                        return (
                          <p className="text-2xl font-bold text-blue-700">
                            {hours}h {minutes}min
                          </p>
                        )
                      }
                      return (
                        <p className="text-2xl font-bold text-blue-700">
                          {minutes} minutos
                        </p>
                      )
                    })()}
                    <p className="text-xs text-blue-600 mt-1">
                      {previewCount.toLocaleString()} mensajes × {formData.velocidad} seg
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
