import { useState, useEffect, useRef, useCallback } from 'react'
import { MessagesSquare, User, Trash2, Search, Send, X, Bot, CheckCircle, ArrowRight, ArrowLeft, Database, Wifi, WifiOff, Smartphone, Monitor } from 'lucide-react'
import { conversationsApi, contactosApi } from '../api/client'
import { ConfirmDialog } from '../components/ui'
import useWebSocket from '../hooks/useWebSocket'

const LEAD_COLORS = {
  nuevo: 'bg-blue-100 text-blue-700',
  contactado: 'bg-amber-100 text-amber-700',
  calificado: 'bg-orange-100 text-orange-700',
  interesado: 'bg-indigo-100 text-indigo-700',
  negociacion: 'bg-violet-100 text-violet-700',
  cerrado: 'bg-emerald-100 text-emerald-700',
  perdido: 'bg-red-100 text-red-700',
}

export default function Conversations() {
  const [conversations, setConversations] = useState([])
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todos') // todos, no_leidos, humano
  const [messages, setMessages] = useState([])
  const [contactData, setContactData] = useState(null)
  const [showSidebar, setShowSidebar] = useState(window.innerWidth >= 1280)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const inputRef = useRef(null)
  const isFirstLoad = useRef(true)

  const selectedRef = useRef(selected)
  useEffect(() => { selectedRef.current = selected }, [selected])

  // WebSocket
  const [typing, setTyping] = useState(null)
  const typingTimeout = useRef(null)

  const handleWsMessage = useCallback((event, data) => {
    if (event === 'new_message') {
      loadConversations()
      if (selectedRef.current && data.telefono === selectedRef.current) {
        // Solo cargar los ultimos mensajes (no recargar todo)
        conversationsApi.getConversation(selectedRef.current, { limit: 30 }).then(res => {
          setMessages(prev => {
            const newMsgs = res.data.messages || []
            if (newMsgs.length === 0) return prev
            // Merge: mantener mensajes viejos + agregar nuevos
            const existingIds = new Set(prev.map(m => m.id))
            const toAdd = newMsgs.filter(m => !existingIds.has(m.id))
            if (toAdd.length > 0) return [...prev, ...toAdd]
            return prev
          })
          setContactData(res.data.contacto)
        }).catch(() => {})
      }
      if (data.telefono) setTyping(null)
    }
    if (event === 'message_revoked') {
      if (selectedRef.current && data.telefono === selectedRef.current) {
        conversationsApi.getConversation(selectedRef.current, { limit: 30 }).then(res => {
          setMessages(res.data.messages || [])
        }).catch(() => {})
      }
      loadConversations()
    }
    if (event === 'typing') {
      setTyping(data.telefono)
      if (typingTimeout.current) clearTimeout(typingTimeout.current)
      typingTimeout.current = setTimeout(() => setTyping(null), 5000)
    }
  }, [])

  const { connected: wsConnected } = useWebSocket(handleWsMessage)

  useEffect(() => { loadConversations() }, [])

  // Scroll al fondo solo en primera carga
  useEffect(() => {
    if (isFirstLoad.current && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView()
      isFirstLoad.current = false
    }
  }, [messages])

  // Fallback polling
  useEffect(() => {
    const interval = setInterval(() => { loadConversations() }, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadConversations = async () => {
    try {
      const res = await conversationsApi.getConversations()
      const data = res.data
      // Support both paginated {conversations: [...]} and legacy array format
      setConversations(Array.isArray(data) ? data : (data.conversations || []))
    } catch (e) { console.error(e) }
  }

  const selectConversation = async (phone) => {
    setSelected(phone)
    isFirstLoad.current = true
    setMessages([])
    setHasMore(false)
    try {
      const res = await conversationsApi.getConversation(phone, { limit: 30 })
      setMessages(res.data.messages || [])
      setContactData(res.data.contacto)
      setHasMore(res.data.has_more || false)
      // Marcar como leido
      conversationsApi.markAsRead(phone).catch(() => {})
      // Actualizar unread en la lista local
      setConversations(prev => prev.map(c => c.telefono === phone ? { ...c, unread: 0 } : c))
    } catch (e) {
      console.error(e)
      setMessages([])
      setContactData(null)
    }
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const loadOlderMessages = async () => {
    if (!selected || loadingMore || !hasMore || messages.length === 0) return
    setLoadingMore(true)
    const oldestId = messages[0]?.id
    const container = messagesContainerRef.current
    const scrollHeightBefore = container?.scrollHeight || 0
    try {
      const res = await conversationsApi.getConversation(selected, { before_id: oldestId, limit: 30 })
      const older = res.data.messages || []
      if (older.length > 0) {
        setMessages(prev => [...older, ...prev])
        setHasMore(res.data.has_more || false)
        // Mantener posicion de scroll
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - scrollHeightBefore
          }
        })
      } else {
        setHasMore(false)
      }
    } catch (e) { console.error(e) }
    setLoadingMore(false)
  }

  const handleSend = async () => {
    if (!newMessage.trim() || !selected || sending) return
    const msg = newMessage
    setNewMessage('')
    setSending(true)
    try {
      await conversationsApi.sendMessage(selected, msg)
      const res = await conversationsApi.getConversation(selected, { limit: 30 })
      setMessages(res.data.messages || [])
      // Scroll al fondo despues de enviar
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (e) { console.error(e) }
    setSending(false)
    // Re-focus input
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleDelete = async () => {
    setShowDeleteConfirm(false)
    try {
      await conversationsApi.deleteConversation(selected)
      setConversations(conversations.filter(c => c.telefono !== selected))
      setSelected(null); setMessages([]); setContactData(null)
    } catch (e) { console.error(e) }
  }

  const toggleHumanMode = async () => {
    if (!contactData?.id) return
    try {
      if (contactData.modo_humano) {
        await contactosApi.desactivarModoHumano(contactData.id)
      } else {
        await contactosApi.activarModoHumano(contactData.id, 'Activado desde chat')
      }
      const res = await conversationsApi.getConversation(selected)
      setContactData(res.data.contacto)
      loadConversations()
    } catch (e) { console.error(e) }
  }

  const filtered = conversations.filter(c => {
    // Filtro de busqueda
    const q = search.toLowerCase()
    if (q && !c.telefono.includes(q) && !(c.nombre || '').toLowerCase().includes(q)) return false
    // Filtros
    if (filter === 'no_leidos' && (c.unread || 0) === 0) return false
    if (filter === 'humano' && !c.modo_humano) return false
    if (filter === 'bot' && c.modo_humano) return false
    return true
  })

  const selectedConv = conversations.find(c => c.telefono === selected)
  const getLeadColor = (estado) => LEAD_COLORS[estado] || LEAD_COLORS.nuevo

  return (
    <div className="h-[calc(100vh-7rem)] lg:h-[calc(100vh-8rem)] flex -m-4 lg:-m-8 bg-white rounded-none lg:rounded-2xl border-0 lg:border border-gray-100 overflow-hidden shadow-sm">
      {/* List — full width on mobile, hidden when a chat is open */}
      <div className={`${selected ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 border-r border-gray-200 flex-col flex-shrink-0`}>
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Conversaciones</h2>
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${wsConnected ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {wsConnected ? 'Live' : 'Offline'}
              </span>
              <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full font-medium">{conversations.length}</span>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {/* Filtros */}
          <div className="flex gap-1 mt-2">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'no_leidos', label: 'No leidos' },
              { id: 'humano', label: 'Humano' },
              { id: 'bot', label: 'Bot' },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`flex-1 py-1 text-[11px] font-medium rounded transition-colors ${
                  filter === f.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map(conv => (
            <div key={conv.telefono}
              onClick={() => selectConversation(conv.telefono)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-50 transition-colors ${
                selected === conv.telefono ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'hover:bg-gray-50'
              }`}>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {(conv.nombre || conv.telefono)[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-gray-900 truncate">{conv.nombre || conv.telefono}</span>
                  <span className="text-xs text-gray-400 ml-2">{conv.fecha ? new Date(conv.fecha).toLocaleDateString('es', { day: '2-digit', month: '2-digit' }) : ''}</span>
                </div>
                {typing === conv.telefono ? (
                  <p className="text-xs text-green-500 mt-0.5 italic">escribiendo...</p>
                ) : (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{conv.ultimo_mensaje}</p>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-medium ${getLeadColor(conv.estado_lead)}`}>{conv.estado_lead || 'nuevo'}</span>
                  {conv.modo_humano && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-orange-100 text-orange-700 font-medium">Humano</span>}
                  {conv.lead_score > 0 && <span className="text-[10px] text-gray-400 font-medium">{conv.lead_score}%</span>}
                </div>
              </div>
              {conv.unread > 0 && (
                <span className="w-5 h-5 bg-indigo-500 text-white text-xs rounded-full flex items-center justify-center font-medium">{conv.unread}</span>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">Sin conversaciones</div>
          )}
        </div>
      </div>

      {/* Chat — full width on mobile when open; placeholder only on desktop */}
      <div className={`${selected ? 'flex' : 'hidden lg:flex'} flex-1 flex-col bg-gray-50 min-w-0`}>
        {selected ? (
          <>
            {/* Header */}
            <div className="bg-white px-3 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-2 flex-shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Back to list (mobile only) */}
                <button onClick={() => setSelected(null)}
                  className="lg:hidden p-2 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 flex-shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {(contactData?.nombre || selectedConv?.nombre || selected)[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{contactData?.nombre || selectedConv?.nombre || selected}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {contactData?.paso_funnel && <span className="hidden sm:inline px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded truncate max-w-[140px]">Paso: {contactData.paso_funnel}</span>}
                    {contactData?.estado_lead && <span className={`px-1.5 py-0.5 rounded-full ${getLeadColor(contactData.estado_lead)}`}>{contactData.estado_lead}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                {contactData?.lead_score > 0 && (
                  <span className="hidden sm:inline px-3 py-1 bg-indigo-50 text-indigo-700 text-sm rounded-full font-medium">{contactData.lead_score}%</span>
                )}
                <button onClick={toggleHumanMode}
                  className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    contactData?.modo_humano
                      ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-700'
                  }`}>
                  {contactData?.modo_humano ? 'Reactivar Bot' : 'Intervenir'}
                </button>
                <button onClick={() => setShowSidebar(!showSidebar)}
                  className={`p-2 rounded-lg transition-colors ${showSidebar ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <User className="h-5 w-5" />
                </button>
                <button onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-3"
              onScroll={e => {
                if (e.target.scrollTop === 0 && hasMore && !loadingMore) {
                  loadOlderMessages()
                }
              }}>
              {/* Cargar mas */}
              {hasMore && (
                <div className="flex justify-center py-2">
                  <button onClick={loadOlderMessages} disabled={loadingMore}
                    className="text-xs text-indigo-500 hover:text-indigo-700 px-3 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm">
                    {loadingMore ? 'Cargando...' : 'Cargar mensajes anteriores'}
                  </button>
                </div>
              )}
              {messages.map((msg, idx) => {
                if (msg.rol === 'system' || msg.tipo_evento) {
                  // Clean error details from system event display
                  const cleanContent = (msg.contenido || '').replace(/\s*\(error:.*\)/i, '')
                  return (
                    <div key={msg.id || idx} className="flex justify-center">
                      <div className="bg-white rounded-xl px-4 py-2.5 shadow-sm border border-gray-100 max-w-[90%] sm:max-w-md">
                        <div className="flex items-center gap-2 justify-center text-xs text-gray-600 text-center break-words">
                          {msg.tipo_evento === 'datos_guardados' && <Database className="h-3.5 w-3.5 text-indigo-500" />}
                          {msg.tipo_evento === 'paso_avanzado' && <ArrowRight className="h-3.5 w-3.5 text-violet-500" />}
                          {msg.tipo_evento === 'intervencion_humana' && <User className="h-3.5 w-3.5 text-orange-500" />}
                          {msg.tipo_evento === 'mensaje_eliminado' && <Trash2 className="h-3.5 w-3.5 text-red-400" />}
                          {!msg.tipo_evento && <CheckCircle className="h-3.5 w-3.5 text-gray-400" />}
                          <span>{cleanContent}</span>
                        </div>
                      </div>
                    </div>
                  )
                }

                const isUser = msg.rol === 'user'
                const meta = msg.metadata || {}
                return (
                  <div key={msg.id || idx} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[85%] sm:max-w-[70%] break-words rounded-2xl px-4 py-2.5 shadow-sm ${
                      isUser
                        ? 'bg-white border border-gray-100 text-gray-800'
                        : 'bg-indigo-600 text-white'
                    }`}>
                      {!isUser && (
                        <p className="text-xs font-medium mb-1 flex items-center gap-1">
                          {meta.source === 'ai' && <><Bot className="h-3 w-3 text-indigo-200" /><span className="text-indigo-200">IA</span></>}
                          {meta.source === 'phone' && <><Smartphone className="h-3 w-3 text-green-200" /><span className="text-green-200">Celular</span></>}
                          {meta.source === 'dashboard' && <><Monitor className="h-3 w-3 text-amber-200" /><span className="text-amber-200">Chat</span></>}
                          {!meta.source && <><Bot className="h-3 w-3 text-indigo-200" /><span className="text-indigo-200">IA</span></>}
                        </p>
                      )}
                      {/* Quoted message */}
                      {meta.quoted && (
                        <div className={`text-xs rounded-lg px-2 py-1.5 mb-2 border-l-2 ${
                          isUser ? 'bg-gray-50 border-gray-300 text-gray-500' : 'bg-indigo-500/30 border-indigo-300 text-indigo-100'
                        }`}>
                          {meta.quoted.body?.substring(0, 100)}
                        </div>
                      )}
                      {/* Media */}
                      {meta.media_url && meta.media_url !== '__pending__' && meta.media_type?.startsWith('image') && (
                        <img src={meta.media_url} alt="" className="rounded-lg max-h-48 mb-2 w-full object-cover" />
                      )}
                      {meta.media_url && meta.media_type?.startsWith('image') && meta.media_url === '__pending__' && (
                        <div className={`flex items-center gap-2 text-xs mb-2 px-3 py-2 rounded-lg ${isUser ? 'bg-gray-50 text-gray-500' : 'bg-indigo-500/30 text-indigo-200'}`}>
                          📷 Imagen enviada
                        </div>
                      )}
                      {meta.media_url && !meta.media_type?.startsWith('image') && (
                        <div className={`flex items-center gap-2 text-xs mb-2 px-3 py-2 rounded-lg ${isUser ? 'bg-gray-50 text-gray-500' : 'bg-indigo-500/30 text-indigo-200'}`}>
                          📎 Archivo adjunto
                        </div>
                      )}
                      {msg.contenido && msg.contenido !== '[Imagen]' && msg.contenido !== '[Video]' && msg.contenido !== '[Archivo]' && (
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.contenido}</p>
                      )}
                      <p className={`text-[10px] text-right mt-1 ${isUser ? 'text-gray-400' : 'text-indigo-300'}`}>
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                )
              })}
              {/* Typing indicator */}
              {typing && typing === selected && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-100 rounded-2xl px-4 py-2.5 shadow-sm">
                    <div className="flex items-center gap-1">
                      <div className="flex gap-0.5">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                      </div>
                      <span className="text-xs text-gray-400 ml-2">escribiendo...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="bg-white px-3 sm:px-5 py-3 border-t border-gray-100 flex-shrink-0">
              <div className="flex gap-2 sm:gap-3">
                <input ref={inputRef} value={newMessage} onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Escribe un mensaje..." disabled={sending} autoFocus
                  className="flex-1 min-w-0 px-4 py-2.5 border border-gray-200 rounded-xl text-base sm:text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button onClick={handleSend} disabled={sending || !newMessage.trim()}
                  className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex-shrink-0">
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessagesSquare className="h-16 w-16 mx-auto mb-4 text-gray-200" />
              <p className="text-lg font-medium text-gray-500">Selecciona una conversacion</p>
              <p className="text-sm text-gray-400 mt-1">Elige un chat para ver los mensajes</p>
            </div>
          </div>
        )}
      </div>

      {/* Contact Sidebar — overlay/full-screen on mobile, column on desktop */}
      {showSidebar && contactData && (
        <div className="fixed inset-0 z-30 w-full bg-white overflow-y-auto lg:static lg:inset-auto lg:z-auto lg:w-80 lg:border-l lg:border-gray-200 lg:flex-shrink-0">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Datos del Cliente</h3>
            <button onClick={() => setShowSidebar(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="h-4 w-4 text-gray-400" /></button>
          </div>

          <div className="p-5 space-y-5">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide font-medium">Estado del Lead</label>
              <p className={`mt-1.5 px-3 py-1.5 rounded-lg text-sm font-medium inline-block ${getLeadColor(contactData.estado_lead)}`}>
                {contactData.estado_lead ? contactData.estado_lead.charAt(0).toUpperCase() + contactData.estado_lead.slice(1) : 'Nuevo'}
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide font-medium">Puntuacion</label>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${contactData.lead_score || 0}%` }} />
                </div>
                <span className="text-sm font-bold text-gray-900">{contactData.lead_score || 0}%</span>
              </div>
            </div>

            {contactData.paso_funnel && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide font-medium">Paso del Funnel</label>
                <span className="mt-1.5 block px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">{contactData.paso_funnel}</span>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide font-medium">Datos Capturados</label>
              <div className="mt-2 space-y-2">
                {contactData.datos_capturados && Object.keys(contactData.datos_capturados).length > 0 ? (
                  Object.entries(contactData.datos_capturados).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-gray-500 capitalize">{key}</span>
                      <span className="font-medium text-gray-900">{val}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">Sin datos capturados</p>
                )}
                <div className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-gray-500">Telefono</span>
                  <span className="font-medium text-gray-900">{contactData.telefono}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide font-medium">Etiquetas</label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {contactData.tags?.length > 0 ? contactData.tags.map((tag, i) => (
                  <span key={i} className="px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded-full font-medium">{tag}</span>
                )) : <p className="text-sm text-gray-400">Sin etiquetas</p>}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Mensajes</span><span className="font-medium">{contactData.total_mensajes || 0}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Registrado</span><span className="font-medium">{contactData.created_at ? new Date(contactData.created_at).toLocaleDateString('es') : '-'}</span></div>
              <div className="flex justify-between">
                <span className="text-gray-500">Modo</span>
                <span className={`font-medium ${contactData.modo_humano ? 'text-orange-600' : 'text-indigo-600'}`}>
                  {contactData.modo_humano ? 'Humano' : 'Bot activo'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Eliminar conversacion"
        message="Se eliminara todo el historial de mensajes con este contacto."
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  )
}
