import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Loader2, Check, Edit2, Sparkles, ArrowRight } from 'lucide-react'
import { businessApi } from '../api/client'

export default function Setup() {
  const navigate = useNavigate()
  const [started, setStarted] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [configReady, setConfigReady] = useState(false)
  const [config, setConfig] = useState(null)
  const [prompts, setPrompts] = useState(null)
  const [applying, setApplying] = useState(false)
  const [configuring, setConfiguring] = useState(false)
  const [configStep, setConfigStep] = useState(0)
  const [editingConfig, setEditingConfig] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (started) inputRef.current?.focus()
  }, [started, loading])

  const startChat = () => {
    setStarted(true)
    setMessages([
      { 
        role: 'assistant', 
        content: '¡Hola! 👋 Cuéntame, ¿qué tipo de negocio tienes?' 
      }
    ])
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const response = await businessApi.setupChat({ message: userMessage, history })
      
      setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }])
      
      if (response.data.config_ready) {
        setConfigReady(true)
        setConfig(response.data.config)
        setPrompts(response.data.prompts)
      }
      
      if (response.data.needs_api_key) {
        setTimeout(() => navigate('/settings'), 2000)
      }
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Hubo un error. ¿Puedes intentar de nuevo?' 
      }])
    } finally {
      setLoading(false)
    }
  }

  const SETUP_STEPS = [
    'Analizando tu negocio...',
    'Configurando personalidad del asistente...',
    'Activando herramientas...',
    'Preparando tu entorno...',
    '¡Listo!'
  ]

  const handleApply = async () => {
    setApplying(true)
    setConfiguring(true)
    setConfigStep(0)
    
    try {
      // Iniciar la configuración en paralelo
      const applyPromise = businessApi.setupApply({ config, prompts })
      
      // Mostrar cada paso con tiempo suficiente para leer
      for (let i = 0; i < SETUP_STEPS.length - 1; i++) {
        setConfigStep(i)
        await new Promise(resolve => setTimeout(resolve, 1200))
      }
      
      // Esperar a que termine la API si aún no terminó
      await applyPromise
      
      // Mostrar "¡Listo!"
      setConfigStep(SETUP_STEPS.length - 1)
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      navigate('/')
    } catch (err) {
      console.error('Error applying config:', err)
      setApplying(false)
      setConfiguring(false)
    }
  }

  const handleSkip = async () => {
    try {
      await businessApi.skipOnboarding()
      navigate('/')
    } catch (err) {
      navigate('/')
    }
  }

  const toggleModule = (key) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Configuring screen
  if (configuring) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          {/* Animated orb */}
          <div className="relative mx-auto w-40 h-40 mb-10">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 blur-3xl opacity-50 animate-pulse" />
            <div className="absolute inset-4 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 blur-2xl opacity-70 animate-pulse" style={{ animationDelay: '0.3s' }} />
            <div className="absolute inset-8 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 blur-xl opacity-80 animate-pulse" style={{ animationDelay: '0.6s' }} />
            <div className="relative w-full h-full rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-violet-500/50 animate-spin" style={{ animationDuration: '3s' }}>
              <div className="absolute inset-2 rounded-full bg-slate-900/50 backdrop-blur" />
              <Sparkles className="relative h-14 w-14 text-white" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-6">
            Configurando tu asistente
          </h2>

          {/* Steps */}
          <div className="space-y-3 text-left max-w-xs mx-auto">
            {SETUP_STEPS.map((step, i) => (
              <div 
                key={i} 
                className={`flex items-center gap-3 transition-all duration-300 ${
                  i <= configStep ? 'opacity-100' : 'opacity-30'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  i < configStep 
                    ? 'bg-emerald-500' 
                    : i === configStep 
                      ? 'bg-violet-500 animate-pulse' 
                      : 'bg-slate-700'
                }`}>
                  {i < configStep ? (
                    <Check className="h-4 w-4 text-white" />
                  ) : i === configStep ? (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  ) : (
                    <div className="w-2 h-2 bg-slate-500 rounded-full" />
                  )}
                </div>
                <span className={`text-sm ${
                  i <= configStep ? 'text-white' : 'text-slate-500'
                }`}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Landing screen before chat
  if (!started) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full text-center">
          {/* Animated orb */}
          <div className="relative mx-auto w-32 h-32 mb-8">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 blur-2xl opacity-40 animate-pulse" />
            <div className="absolute inset-4 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 blur-xl opacity-60 animate-pulse" style={{ animationDelay: '0.5s' }} />
            <div className="relative w-full h-full rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-violet-500/30">
              <Sparkles className="h-12 w-12 text-white" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white mb-3">
            Crea tu asistente
          </h1>
          <p className="text-lg text-slate-400 mb-8 max-w-md mx-auto">
            Describe tu negocio y la IA configurará todo automáticamente. 
            Sin formularios, sin complicaciones.
          </p>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            <div className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10">
              <div className="text-2xl mb-2">💬</div>
              <p className="text-sm text-slate-300">Solo conversa</p>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10">
              <div className="text-2xl mb-2">🤖</div>
              <p className="text-sm text-slate-300">IA configura</p>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10">
              <div className="text-2xl mb-2">✨</div>
              <p className="text-sm text-slate-300">Listo en segundos</p>
            </div>
          </div>

          <button
            onClick={startChat}
            className="group inline-flex items-center gap-3 px-8 py-4 bg-white text-slate-900 rounded-2xl font-semibold text-lg hover:bg-slate-100 transition-all shadow-xl shadow-white/10"
          >
            Comenzar
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={handleSkip}
            className="block mx-auto mt-6 text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            Configurar después
          </button>
        </div>
      </div>
    )
  }

  // Chat interface
  return (
    <div className="min-h-screen relative">
      {/* Background: App Preview */}
      <div className="absolute inset-0 bg-slate-100">
        <div className="absolute left-0 top-0 bottom-0 w-64 bg-slate-900" />
        <div className="absolute left-64 right-0 top-0 h-14 bg-white border-b border-slate-200" />
        <div className="absolute left-64 right-0 top-14 bottom-0 p-8">
          <div className="h-8 w-48 bg-slate-200 rounded-lg mb-6" />
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="h-28 bg-white rounded-2xl shadow-sm" />
            <div className="h-28 bg-white rounded-2xl shadow-sm" />
            <div className="h-28 bg-white rounded-2xl shadow-sm" />
          </div>
          <div className="h-72 bg-white rounded-2xl shadow-sm" />
        </div>
      </div>
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />

      {/* Chat Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-xl">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col" style={{ height: '600px' }}>
          {/* Header */}
          <div className="px-6 py-5 bg-gradient-to-r from-violet-500 to-fuchsia-500">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Asistente de configuración</h2>
                <p className="text-sm text-white/70">Cuéntame sobre tu negocio</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mr-2 flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                )}
                <div className={`max-w-[75%] px-4 py-3 ${
                  msg.role === 'user' 
                    ? 'bg-slate-900 text-white rounded-2xl rounded-br-md' 
                    : 'bg-white text-slate-800 rounded-2xl rounded-bl-md shadow-sm'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mr-2">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Config Summary */}
            {configReady && config && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Check className="h-4 w-4 text-emerald-600" />
                    </div>
                    <span className="font-medium text-slate-900">Configuración lista</span>
                  </div>
                  <button 
                    onClick={() => setEditingConfig(!editingConfig)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-slate-500 text-sm">Negocio</span>
                    <span className="font-medium text-slate-900">{config.business_name}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-slate-500 text-sm">Tipo</span>
                    <span className="font-medium text-slate-900">{config.business_type}</span>
                  </div>
                  
                  {editingConfig ? (
                    <div className="pt-2 space-y-3">
                      {[
                        { key: 'has_inventory', label: 'Catálogo de productos' },
                        { key: 'has_appointments', label: 'Sistema de citas' },
                        { key: 'has_schedule', label: 'Horarios de atención' }
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">{label}</span>
                          <button
                            onClick={() => toggleModule(key)}
                            className={`w-11 h-6 rounded-full transition-colors relative ${
                              config[key] ? 'bg-violet-500' : 'bg-slate-200'
                            }`}
                          >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                              config[key] ? 'left-6' : 'left-1'
                            }`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {config.has_inventory && (
                        <span className="px-3 py-1.5 bg-violet-50 text-violet-700 rounded-full text-xs font-medium">Inventario</span>
                      )}
                      {config.has_appointments && (
                        <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">Citas</span>
                      )}
                      {config.has_schedule && (
                        <span className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">Horarios</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input or Apply */}
          <div className="p-4 bg-white border-t border-slate-100">
            {configReady ? (
              <button
                onClick={handleApply}
                disabled={applying}
                className="w-full py-3.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25"
              >
                {applying ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creando tu asistente...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Activar asistente
                  </>
                )}
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Escribe tu respuesta..."
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-slate-100 border-0 rounded-xl focus:ring-2 focus:ring-violet-500 disabled:opacity-50 placeholder-slate-400"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="px-4 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
