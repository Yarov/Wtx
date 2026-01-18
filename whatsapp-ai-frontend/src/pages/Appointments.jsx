import { useState, useEffect } from 'react'
import { Calendar, Trash2, Phone, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import { appointmentsApi } from '../api/client'
import { ConfirmDialog } from '../components/ui'

const STATUS_CONFIG = {
  confirmada: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Confirmada' },
  pendiente: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendiente' },
  completada: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Completada' },
  cancelada: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelada' },
}

export default function Appointments() {
  const [appointments, setAppointments] = useState([])
  const [filter, setFilter] = useState('all')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [appointmentToDelete, setAppointmentToDelete] = useState(null)

  useEffect(() => {
    loadAppointments()
  }, [])

  const loadAppointments = async () => {
    try {
      const response = await appointmentsApi.getAppointments()
      setAppointments(response.data || [])
    } catch (error) {
      console.error('Error loading appointments:', error)
    }
  }

  const openDeleteConfirm = (id) => {
    setAppointmentToDelete(id)
    setShowDeleteConfirm(true)
  }

  const handleDelete = async () => {
    const id = appointmentToDelete
    setShowDeleteConfirm(false)
    setAppointmentToDelete(null)
    setAppointments(appointments.filter(a => a.id !== id))
    try {
      await appointmentsApi.deleteAppointment(id)
    } catch (error) {
      console.error('Error deleting:', error)
    }
  }

  const handleStatusChange = async (id, newStatus) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, estado: newStatus } : a))
    try {
      await appointmentsApi.updateStatus(id, newStatus)
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const filteredAppointments = appointments.filter(apt => {
    if (filter === 'all') return true
    if (filter === 'cancelada') return apt.estado === 'cancelada'
    const aptDate = new Date(apt.fecha)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (filter === 'today') {
      return aptDate.toDateString() === today.toDateString() && apt.estado !== 'cancelada'
    }
    if (filter === 'upcoming') {
      return aptDate >= today && apt.estado !== 'cancelada'
    }
    return true
  })

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Citas Agendadas</h1>
          <p className="text-gray-500 mt-1">Gestiona las citas de tus clientes</p>
        </div>
        <div className="flex gap-2">
          {['all', 'today', 'upcoming'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'today' ? 'Hoy' : 'Próximas'}
            </button>
          ))}
        </div>
      </div>

      <Card title="Lista de Citas" icon={Calendar}>
        <div className="space-y-4">
          {filteredAppointments.map((appointment) => {
            const status = STATUS_CONFIG[appointment.estado] || STATUS_CONFIG.pendiente
            return (
              <div
                key={appointment.id}
                className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                  appointment.estado === 'cancelada' ? 'bg-gray-50 opacity-60' : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${status.bg}`}>
                    <Calendar className={`h-5 w-5 ${status.text}`} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{appointment.servicio}</h4>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {appointment.fecha}
                      </span>
                      {appointment.hora && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {appointment.hora}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        {appointment.telefono?.replace('whatsapp:', '')}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <select
                    value={appointment.estado || 'pendiente'}
                    onChange={(e) => handleStatusChange(appointment.id, e.target.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border-0 cursor-pointer ${status.bg} ${status.text}`}
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="confirmada">Confirmada</option>
                    <option value="completada">Completada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                  
                  <button
                    onClick={() => openDeleteConfirm(appointment.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )
          })}
          {filteredAppointments.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              No hay citas {filter === 'today' ? 'para hoy' : filter === 'upcoming' ? 'próximas' : ''}
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
          <h3 className="font-semibold text-blue-900">Total Citas</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">{appointments.length}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-100">
          <h3 className="font-semibold text-emerald-900">Hoy</h3>
          <p className="text-3xl font-bold text-emerald-600 mt-2">
            {appointments.filter(a => new Date(a.fecha).toDateString() === new Date().toDateString()).length}
          </p>
        </div>
        <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
          <h3 className="font-semibold text-purple-900">Esta Semana</h3>
          <p className="text-3xl font-bold text-purple-600 mt-2">{appointments.length}</p>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setAppointmentToDelete(null) }}
        onConfirm={handleDelete}
        title="¿Eliminar esta cita?"
        message="Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  )
}
