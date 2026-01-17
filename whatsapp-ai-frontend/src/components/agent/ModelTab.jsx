const MODELS = [
  { 
    value: 'gpt-4o-mini', 
    name: 'GPT-4o Mini', 
    description: 'Rápido y económico',
    speed: 'Muy rápido',
    cost: '$',
    recommended: true
  },
  { 
    value: 'gpt-4o', 
    name: 'GPT-4o', 
    description: 'Más inteligente',
    speed: 'Rápido',
    cost: '$$$',
    recommended: false
  },
  { 
    value: 'gpt-4-turbo', 
    name: 'GPT-4 Turbo', 
    description: 'Alta capacidad',
    speed: 'Medio',
    cost: '$$$$',
    recommended: false
  },
  { 
    value: 'gpt-3.5-turbo', 
    name: 'GPT-3.5 Turbo', 
    description: 'Más económico',
    speed: 'Muy rápido',
    cost: '$',
    recommended: false
  },
]

export default function ModelTab({ config, setConfig }) {
  const selectedModel = MODELS.find(m => m.value === config.model) || MODELS[0]

  return (
    <div className="space-y-8">
      {/* Model Selection */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Modelo de Inteligencia Artificial</h2>
        <p className="text-sm text-gray-500 mb-4">Elige el cerebro que potenciará tu agente</p>

        <div className="grid gap-3 md:grid-cols-2">
          {MODELS.map((model) => (
            <button
              key={model.value}
              onClick={() => setConfig({ ...config, model: model.value })}
              className={`relative p-5 rounded-xl border-2 text-left transition-all ${
                config.model === model.value
                  ? 'border-violet-500 bg-violet-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {model.recommended && (
                <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-emerald-500 text-white text-xs font-medium rounded-full">
                  Recomendado
                </span>
              )}
              
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{model.name}</h3>
                  <p className="text-sm text-gray-500">{model.description}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  config.model === model.value
                    ? 'border-violet-500 bg-violet-500'
                    : 'border-gray-300'
                }`}>
                  {config.model === model.value && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{model.speed}</span>
                <span>•</span>
                <span>{model.cost}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Parameters */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Parámetros de Respuesta</h2>
        <p className="text-sm text-gray-500 mb-4">Ajusta cómo responde el agente</p>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Temperature */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-medium text-gray-900">Creatividad</h3>
                <p className="text-xs text-gray-500">Qué tan variadas son las respuestas</p>
              </div>
              <span className="text-2xl font-bold text-orange-600">{config.temperature}</span>
            </div>
            
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.temperature}
              onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Preciso (0.0)</span>
              <span>Creativo (1.0)</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-medium text-gray-900">Longitud Máxima</h3>
                <p className="text-xs text-gray-500">Límite de tokens por respuesta</p>
              </div>
              <span className="text-2xl font-bold text-blue-600">{config.max_tokens}</span>
            </div>
            
            <input
              type="range"
              min="100"
              max="2000"
              step="100"
              value={config.max_tokens}
              onChange={(e) => setConfig({ ...config, max_tokens: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Corto (~75 palabras)</span>
              <span>Largo (~1500 palabras)</span>
            </div>
          </div>

          {/* Delay */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-medium text-gray-900">Tiempo de Espera</h3>
                <p className="text-xs text-gray-500">Segundos antes de responder (espera que termine de escribir)</p>
              </div>
              <span className="text-2xl font-bold text-violet-600">{config.response_delay || 3}s</span>
            </div>
            
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={config.response_delay || 3}
              onChange={(e) => setConfig({ ...config, response_delay: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />
            
            <div className="flex justify-between mt-3 text-xs text-gray-500">
              <span>Inmediato</span>
              <span>5s</span>
              <span>10s</span>
            </div>
          </div>
        </div>
      </section>

      {/* Response Time Estimate */}
      <section>
        <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-emerald-900">Tiempo de Respuesta Estimado</h3>
              <p className="text-sm text-emerald-700">
                Con {selectedModel.name} y {config.max_tokens} tokens
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-emerald-600">
                {selectedModel.value.includes('mini') || selectedModel.value.includes('3.5') ? '1-2' : '2-4'}s
              </p>
              <p className="text-xs text-emerald-600">+ {config.response_delay || 3}s de espera</p>
            </div>
          </div>
        </div>
      </section>

      {/* Help */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Guía Rápida</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Modelo</h4>
            <p className="text-sm text-gray-600">
              <strong>GPT-4o Mini</strong> es ideal para la mayoría. Usa GPT-4o solo para respuestas más complejas.
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Creatividad</h4>
            <p className="text-sm text-gray-600">
              <strong>0.3-0.5</strong> para negocios formales. <strong>0.6-0.8</strong> para casuales.
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Tiempo de Espera</h4>
            <p className="text-sm text-gray-600">
              <strong>3-5 segundos</strong> es ideal para que el cliente termine de escribir su mensaje completo.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
