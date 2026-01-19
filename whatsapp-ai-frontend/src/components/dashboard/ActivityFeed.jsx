import { MessageSquare } from 'lucide-react'
import { Link } from 'react-router-dom'

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  
  if (isToday) {
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function ChatBubble({ message, isUser }) {
  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
      <div 
        className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
          isUser 
            ? 'bg-gray-100 text-gray-700 rounded-tl-sm' 
            : 'bg-indigo-50 text-indigo-900 rounded-tr-sm'
        }`}
      >
        {message}
      </div>
    </div>
  )
}

function ConversationThread({ conversation }) {
  return (
    <Link 
      to={`/conversations?phone=${conversation.telefono}`}
      className="block p-4 hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
          <span className="text-gray-600 text-sm font-medium">
            {(conversation.contact_name || '?')[0].toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">
            {conversation.contact_name}
          </p>
          <p className="text-xs text-gray-400">
            {formatTime(conversation.timestamp)}
          </p>
        </div>
      </div>
      
      {/* Chat Bubbles */}
      <div className="space-y-1.5 ml-12">
        {conversation.messages.slice(-4).map((msg, idx) => (
          <ChatBubble 
            key={idx} 
            message={msg.content} 
            isUser={msg.role === 'user'} 
          />
        ))}
      </div>
    </Link>
  )
}

export default function ActivityFeed({ conversations = [], loading = false }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <h2 className="text-lg font-semibold text-gray-900">Chat en Vivo</h2>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-gray-200 rounded-full"></div>
                <div className="space-y-1">
                  <div className="h-4 bg-gray-200 rounded w-28"></div>
                  <div className="h-3 bg-gray-100 rounded w-16"></div>
                </div>
              </div>
              <div className="space-y-1.5 ml-12">
                <div className="h-8 bg-gray-100 rounded-2xl w-3/4"></div>
                <div className="h-8 bg-gray-200 rounded-2xl w-2/3 ml-auto"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          <h2 className="text-lg font-semibold text-gray-900">Chat en Vivo</h2>
        </div>
        <Link 
          to="/conversations" 
          className="text-sm text-gray-500 hover:text-gray-700 font-medium"
        >
          Ver todas →
        </Link>
      </div>

      {conversations.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Sin conversaciones hoy</p>
          <p className="text-sm text-gray-400 mt-1">Las conversaciones aparecerán aquí</p>
        </div>
      ) : (
        <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-100">
          {conversations.map((conversation, idx) => (
            <ConversationThread key={idx} conversation={conversation} />
          ))}
        </div>
      )}
    </div>
  )
}
