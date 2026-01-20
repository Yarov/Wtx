import { useState, useEffect } from 'react'
import { Loader2, ChevronDown, ChevronUp, UserRound } from 'lucide-react'
import Button from '../components/Button'
import { configApi } from '../api/client'


export default function Settings() {
  // Modo Humano
  const [humanModeConfig, setHumanModeConfig] = useState({
    expire_hours: 0,
    reactivar_command: '#reactivar',
    triggers: ['frustration', 'complaint', 'human_request'],
    custom_triggers: '',
  })
  
  // UI State
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expandedSection, setExpandedSection] = useState('human_mode')

  useEffect(() => {
    loadAllConfig()
  }, [])

  const loadAllConfig = async () => {
    try {
      const humanRes = await configApi.getHumanModeConfig().catch(() => ({ data: {} }))
      if (humanRes.data) {
        setHumanModeConfig(prev => ({ ...prev, ...humanRes.data }))
      }
    } catch (error) {
      console.error('Error loading config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await configApi.updateHumanModeConfig(humanModeConfig)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error saving:', error)
      alert('Error al guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-gray-500 text-sm">Gestiona las conexiones y credenciales del sistema</p>
        </div>
      </div>

      {/* Sticky Save Bar */}
      <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-200 px-8 py-4 z-20">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Los cambios no se guardan automáticamente
          </p>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-sm text-indigo-600 font-medium">
                ✓ Guardado correctamente
              </span>
            )}
            <Button onClick={handleSave} loading={saving}>
              Guardar Cambios
            </Button>
          </div>
        </div>
      </div>

      {/* Modo Humano Section */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('human_mode')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <UserRound className="h-5 w-5 text-orange-600" />
            </div>
            <div className="text-left">
              <h2 className="font-semibold text-gray-900">Modo Humano</h2>
              <p className="text-sm text-gray-500">Configuración de transferencia a atención humana</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {expandedSection === 'human_mode' ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </button>

        {expandedSection === 'human_mode' && (
          <div className="px-6 pb-6 space-y-6 border-t border-gray-100">
            {/* Tiempo de expiración */}
            <div className="pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiración automática (horas)
              </label>
              <input
                type="number"
                min="0"
                value={humanModeConfig.expire_hours}
                onChange={(e) => setHumanModeConfig({ ...humanModeConfig, expire_hours: parseInt(e.target.value) || 0 })}
                className="w-32 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                0 = sin expiración automática. El modo humano se desactiva manualmente o por comando.
              </p>
            </div>

            {/* Comando de reactivación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comando para reactivar IA
              </label>
              <input
                type="text"
                value={humanModeConfig.reactivar_command}
                onChange={(e) => setHumanModeConfig({ ...humanModeConfig, reactivar_command: e.target.value })}
                placeholder="#reactivar"
                className="w-48 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Envía este comando desde WhatsApp para reactivar la IA en un contacto.
              </p>
            </div>

            {/* Triggers */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Triggers automáticos
              </label>
              <p className="text-xs text-gray-500 mb-3">
                La IA activará el modo humano cuando detecte estas situaciones:
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'frustration', label: 'Frustración del cliente', desc: 'Detecta enojo o molestia' },
                  { id: 'complaint', label: 'Quejas o reclamos', desc: 'Problemas con servicio/producto' },
                  { id: 'human_request', label: 'Solicitud explícita', desc: '"Quiero hablar con alguien"' },
                  { id: 'urgency', label: 'Urgencia alta', desc: 'Situaciones que requieren atención inmediata' },
                  { id: 'complexity', label: 'Caso complejo', desc: 'La IA no puede resolver' },
                  { id: 'negotiation', label: 'Negociación', desc: 'Descuentos, precios especiales' },
                ].map((trigger) => (
                  <label
                    key={trigger.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      humanModeConfig.triggers.includes(trigger.id)
                        ? 'border-orange-300 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={humanModeConfig.triggers.includes(trigger.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setHumanModeConfig({ ...humanModeConfig, triggers: [...humanModeConfig.triggers, trigger.id] })
                        } else {
                          setHumanModeConfig({ ...humanModeConfig, triggers: humanModeConfig.triggers.filter(t => t !== trigger.id) })
                        }
                      }}
                      className="mt-0.5 w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-700">{trigger.label}</p>
                      <p className="text-xs text-gray-500">{trigger.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom Triggers */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Palabras clave personalizadas
              </label>
              
              {/* Tags display */}
              <div className="flex flex-wrap gap-2 mb-3">
                {(humanModeConfig.custom_triggers || '').split(',').filter(t => t.trim()).map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-medium"
                  >
                    {tag.trim()}
                    <button
                      type="button"
                      onClick={() => {
                        const tags = humanModeConfig.custom_triggers.split(',').filter(t => t.trim())
                        tags.splice(idx, 1)
                        setHumanModeConfig({ ...humanModeConfig, custom_triggers: tags.join(',') })
                      }}
                      className="hover:bg-orange-200 rounded-full p-0.5 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
              
              {/* Input for new tags */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Escribe una palabra y presiona Enter..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      const value = e.target.value.trim()
                      if (value) {
                        const currentTags = humanModeConfig.custom_triggers ? humanModeConfig.custom_triggers.split(',').filter(t => t.trim()) : []
                        if (!currentTags.includes(value)) {
                          setHumanModeConfig({ 
                            ...humanModeConfig, 
                            custom_triggers: [...currentTags, value].join(',') 
                          })
                        }
                        e.target.value = ''
                      }
                    }
                  }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  Enter para agregar
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Si el cliente menciona alguna de estas palabras, se activará el modo humano.
              </p>
            </div>

            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>¿Cómo funciona?</strong> Cuando la IA detecta un trigger o se activa manualmente, 
                el contacto entra en "modo humano" y la IA deja de responder automáticamente. 
                Un asesor puede atender al cliente y luego reactivar la IA desde la UI o enviando el comando configurado.
              </p>
            </div>
          </div>
        )}
      </section>

    </div>
  )
}
