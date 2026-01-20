import { useState, useEffect } from 'react'
import { configApi } from '../../api/client'

const TRIGGERS = [
  { id: 'frustration', label: 'Frustración del cliente', desc: 'Detecta enojo o molestia' },
  { id: 'complaint', label: 'Quejas o reclamos', desc: 'Problemas con servicio/producto' },
  { id: 'human_request', label: 'Solicitud explícita', desc: '"Quiero hablar con alguien"' },
  { id: 'urgency', label: 'Urgencia alta', desc: 'Situaciones que requieren atención inmediata' },
  { id: 'complexity', label: 'Caso complejo', desc: 'La IA no puede resolver' },
  { id: 'negotiation', label: 'Negociación', desc: 'Descuentos, precios especiales' },
]

export default function HumanModeTab({ config, setConfig, onSave }) {
  return (
    <div className="space-y-6">
      {/* Tiempo de expiración */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Expiración automática (horas)
        </label>
        <input
          type="number"
          min="0"
          value={config.expire_hours || 0}
          onChange={(e) => setConfig({ ...config, expire_hours: parseInt(e.target.value) || 0 })}
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
          value={config.reactivar_command || '#reactivar'}
          onChange={(e) => setConfig({ ...config, reactivar_command: e.target.value })}
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
          {TRIGGERS.map((trigger) => (
            <label
              key={trigger.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                (config.triggers || []).includes(trigger.id)
                  ? 'border-orange-300 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={(config.triggers || []).includes(trigger.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setConfig({ ...config, triggers: [...(config.triggers || []), trigger.id] })
                  } else {
                    setConfig({ ...config, triggers: (config.triggers || []).filter(t => t !== trigger.id) })
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
          {(config.custom_triggers || '').split(',').filter(t => t.trim()).map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-medium"
            >
              {tag.trim()}
              <button
                type="button"
                onClick={() => {
                  const tags = config.custom_triggers.split(',').filter(t => t.trim())
                  tags.splice(idx, 1)
                  setConfig({ ...config, custom_triggers: tags.join(',') })
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
                  const currentTags = config.custom_triggers ? config.custom_triggers.split(',').filter(t => t.trim()) : []
                  if (!currentTags.includes(value)) {
                    setConfig({ 
                      ...config, 
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
  )
}
