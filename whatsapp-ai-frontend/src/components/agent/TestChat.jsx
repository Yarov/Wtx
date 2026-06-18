import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Trash2, Send, Loader2, ChevronDown, ChevronUp, Wrench, GitBranch, Target, Database, Info } from 'lucide-react'
import { configApi } from '../../api/client'

const EVENT_LABELS = {
  datos_guardados: { label: 'Datos capturados', color: 'bg-emerald-100 text-emerald-700', icon: Database },
  paso_avanzado: { label: 'Funnel avanzó', color: 'bg-violet-100 text-violet-700', icon: GitBranch },
  intervencion_humana: { label: 'Transfer humano', color: 'bg-red-100 text-red-700', icon: Info },
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-green-500 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-800 rounded-bl-md'
        }`}
      >
        {msg.content}
      </div>
    </div>
  )
}

function SystemEvent({ event }) {
  if (event.type === 'tools' && event.detail) {
    // Grouped tools display — show as compact list
    const items = event.detail.split(' · ')
    return (
      <div className="flex justify-center">
        <div className="max-w-[90%] px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
          {items.map((item, i) => (
            <div key={i} className="text-[10px] text-gray-500 leading-relaxed">{item}</div>
          ))}
        </div>
      </div>
    )
  }
  const config = EVENT_LABELS[event.type] || { label: event.type, color: 'bg-gray-100 text-gray-600', icon: Info }
  const Icon = config.icon
  return (
    <div className="flex justify-center">
      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium ${config.color}`}>
        <Icon className="h-3 w-3" />
        {config.label}{event.detail ? `: ${event.detail}` : ''}
      </div>
    </div>
  )
}

function MetadataPanel({ meta, expanded, onToggle }) {
  if (!meta) return null
  const hasData = meta.tools_called?.length > 0 || meta.paso_funnel || meta.lead_score > 0 || meta.datos_capturados

  return (
    <div className="border-t border-gray-100 bg-gray-50">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-1.5 text-[11px] text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Wrench className="h-3 w-3" />
          {hasData ? 'Detalles internos' : 'Sin actividad de tools'}
        </span>
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="px-4 pb-2 space-y-2">
          {/* Tools called */}
          {meta.tools_called?.length > 0 && (
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">Tools ejecutados</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {meta.tools_called.map((tool, i) => (
                  <span key={i} className="px-2 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-medium rounded-full">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Funnel + Score */}
          <div className="flex items-center gap-3">
            {meta.paso_funnel && (
              <div className="flex items-center gap-1">
                <GitBranch className="h-3 w-3 text-blue-500" />
                <span className="text-[11px] text-blue-700 font-medium">{meta.paso_funnel}</span>
              </div>
            )}
            {meta.lead_score > 0 && (
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3 text-amber-500" />
                <span className="text-[11px] text-amber-700 font-medium">Score: {meta.lead_score}</span>
              </div>
            )}
          </div>

          {/* Captured data */}
          {meta.datos_capturados && Object.keys(meta.datos_capturados).length > 0 && (
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">Datos capturados</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {Object.entries(meta.datos_capturados).map(([key, val]) => (
                  <span key={key} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] rounded-full border border-emerald-200">
                    {key}: {val}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TestChat({ embedded = false, fill = false }) {
  const [isOpen, setIsOpen] = useState(embedded)
  const [messages, setMessages] = useState([])   // { role, content } or { role: 'event', type, detail }
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [lastMeta, setLastMeta] = useState(null)
  const [metaExpanded, setMetaExpanded] = useState(true)
  const [msgCount, setMsgCount] = useState(0)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setSending(true)

    try {
      const res = await configApi.testChat(text)
      const data = res.data

      const newMessages = []

      // Agent response only — tools/events go to metadata panel, not the chat
      const respuesta = data.respuesta || 'Sin respuesta'
      newMessages.push({
        role: 'agent',
        content: respuesta,
      })

      setMessages(prev => [...prev, ...newMessages])
      setLastMeta({
        tools_called: data.tools_called || [],
        paso_funnel: data.paso_funnel || null,
        lead_score: data.lead_score ?? 0,
        datos_capturados: data.datos_capturados || null,
        model: data.model || 'gpt-4o-mini',
      })
      setMsgCount(prev => prev + 1)
    } catch (error) {
      const detail = error.response?.data?.detail || 'Error al comunicarse con el agente.'
      setMessages(prev => [...prev, { role: 'agent', content: `⚠️ ${detail}` }])
    } finally {
      setSending(false)
    }
  }

  const handleReset = async () => {
    try {
      await configApi.testChat('reset', true)
    } catch (_) {}
    setMessages([])
    setLastMeta(null)
    setMsgCount(0)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const panel = (
    <div
      className={
        embedded
          ? fill
            ? 'w-full h-full bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col'
            : 'w-full bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col'
          : `fixed bottom-24 right-4 left-4 sm:left-auto sm:right-6 z-50 sm:w-[420px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col transition-all duration-300 origin-bottom-right ${
              isOpen
                ? 'opacity-100 scale-100 translate-y-0'
                : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
            }`
      }
      style={
        fill
          ? undefined
          : { height: embedded ? '600px' : '560px', maxHeight: embedded ? 'calc(100vh - 220px)' : 'calc(100vh - 120px)' }
      }
    >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div>
              <span className="font-semibold text-sm">Probar agente</span>
              <p className="text-[10px] text-white/70">Conversación de prueba en vivo</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleReset}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              title="Reiniciar conversación"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            {!embedded && (
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-14 h-14 bg-violet-100 rounded-full flex items-center justify-center mb-3">
                <MessageCircle className="h-7 w-7 text-violet-600" />
              </div>
              <p className="text-sm font-medium text-gray-700">Prueba tu agente en vivo</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Envía mensajes como si fueras un cliente. Verás las herramientas que usa, los datos que captura y cómo avanza el funnel.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                {['Hola, qué ofrecen?', 'Quiero más información', 'Necesito ayuda'].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus() }}
                    className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full hover:bg-violet-100 hover:text-violet-700 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            msg.role === 'event' ? (
              <SystemEvent key={idx} event={msg} />
            ) : (
              <MessageBubble key={idx} msg={msg} />
            )
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-2.5 rounded-2xl rounded-bl-md">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Metadata Panel */}
        <MetadataPanel meta={lastMeta} expanded={metaExpanded} onToggle={() => setMetaExpanded(!metaExpanded)} />

        {/* Input Area */}
        <div className="px-3 py-2.5 border-t border-gray-200 bg-white rounded-b-2xl flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe como si fueras un cliente..."
              disabled={sending}
              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="p-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
    </div>
  )

  if (embedded) {
    return panel
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-gray-600 hover:bg-gray-700 scale-90'
            : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 scale-100 hover:scale-110'
        }`}
      >
        {isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <>
            <MessageCircle className="h-6 w-6 text-white" />
            {msgCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {msgCount}
              </span>
            )}
          </>
        )}
      </button>

      {panel}
    </>
  )
}
