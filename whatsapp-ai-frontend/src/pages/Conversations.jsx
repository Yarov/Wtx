import { useState, useEffect } from 'react'
import { MessagesSquare, User, Trash2, ChevronRight, Search } from 'lucide-react'
import Card from '../components/Card'
import { Input } from '../components/Input'
import { conversationsApi } from '../api/client'
import { ConfirmDialog } from '../components/ui'

export default function Conversations() {
  const [conversations, setConversations] = useState([])
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [messages, setMessages] = useState([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [phoneToDelete, setPhoneToDelete] = useState(null)

  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = async () => {
    try {
      const response = await conversationsApi.getConversations()
      setConversations(response.data || [])
    } catch (error) {
      console.error('Error loading conversations:', error)
    }
  }

  const loadMessages = async (phone) => {
    setSelected(phone)
    try {
      const response = await conversationsApi.getConversation(phone)
      setMessages(response.data.messages || [])
    } catch (error) {
      console.error('Error loading messages:', error)
      setMessages([])
    }
  }

  const openDeleteConfirm = (phone, e) => {
    e.stopPropagation()
    setPhoneToDelete(phone)
    setShowDeleteConfirm(true)
  }

  const handleDelete = async () => {
    const phone = phoneToDelete
    setShowDeleteConfirm(false)
    setPhoneToDelete(null)
    setConversations(conversations.filter(c => c.telefono !== phone))
    if (selected === phone) {
      setSelected(null)
      setMessages([])
    }
    try {
      await conversationsApi.deleteConversation(phone)
    } catch (error) {
      console.log('Deleted locally')
    }
  }

  const filtered = conversations.filter(c =>
    c.telefono.includes(search) || c.ultimo_mensaje.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Conversaciones</h1>
        <p className="text-gray-500 mt-1">Historial de chats con clientes</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lista de conversaciones */}
        <div className="lg:col-span-1">
          <Card>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {filtered.map((conv) => (
                  <div
                    key={conv.telefono}
                    onClick={() => loadMessages(conv.telefono)}
                    className={`p-3 cursor-pointer transition-colors ${
                      selected === conv.telefono
                        ? 'bg-indigo-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-gray-100 rounded-full">
                          <User className="h-4 w-4 text-gray-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {conv.telefono}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {conv.ultimo_mensaje}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => openDeleteConfirm(conv.telefono, e)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="text-center text-gray-500 py-4 text-sm">
                    No hay conversaciones
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Detalle de conversación */}
        <div className="lg:col-span-2">
          <Card title={selected || 'Selecciona una conversación'} icon={MessagesSquare}>
            {selected ? (
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-900 rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <MessagesSquare className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p>Selecciona una conversación para ver el historial</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setPhoneToDelete(null) }}
        onConfirm={handleDelete}
        title="¿Eliminar esta conversación?"
        message="Se eliminará todo el historial de mensajes con este contacto."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  )
}
