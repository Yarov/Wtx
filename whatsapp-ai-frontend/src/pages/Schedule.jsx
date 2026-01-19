import { useState, useEffect } from 'react'
import { Calendar, Clock, Trash2, CheckCircle, XCircle, Ban, ChevronLeft, ChevronRight, X } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import { availabilityApi } from '../api/client'

const HORAS = Array.from({ length: 13 }, (_, i) => {
  const h = i + 8
  return `${h.toString().padStart(2, '0')}:00`
})

const DIAS_SEMANA = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function Schedule() {
  const [availability, setAvailability] = useState([])
  const [blockedSlots, setBlockedSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedHours, setSelectedHours] = useState([])
  const [blockMotivo, setBlockMotivo] = useState('')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [activeTab, setActiveTab] = useState('horarios')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [availRes, blockedRes] = await Promise.all([
        availabilityApi.getAvailability(),
        availabilityApi.getBlockedSlots()
      ])
      setAvailability(availRes.data || [])
      setBlockedSlots(blockedRes.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const handleUpdateAvailability = async (dia) => {
    setLoading(true)
    try {
      await availabilityApi.updateAvailability(dia.id, {
        hora_inicio: dia.hora_inicio,
        hora_fin: dia.hora_fin,
        activo: dia.activo
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Error updating:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleDay = async (dia) => {
    const updated = { ...dia, activo: !dia.activo }
    setAvailability(availability.map(d => d.id === dia.id ? updated : d))
    await handleUpdateAvailability(updated)
  }

  const handleTimeChange = (dia, field, value) => {
    setAvailability(availability.map(d => 
      d.id === dia.id ? { ...d, [field]: value } : d
    ))
  }

  const handleAddBlock = async () => {
    if (!selectedDate || selectedHours.length === 0) return
    setLoading(true)
    try {
      for (const hora of selectedHours) {
        await availabilityApi.addBlockedSlot({
          fecha: selectedDate,
          hora,
          motivo: blockMotivo || 'Bloqueado'
        })
      }
      setSelectedDate(null)
      setSelectedHours([])
      setBlockMotivo('')
      loadData()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Error adding block:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBlock = async (id) => {
    try {
      await availabilityApi.deleteBlockedSlot(id)
      setBlockedSlots(blockedSlots.filter(b => b.id !== id))
    } catch (error) {
      console.error('Error deleting:', error)
    }
  }

  const toggleHour = (hora) => {
    if (selectedHours.includes(hora)) {
      setSelectedHours(selectedHours.filter(h => h !== hora))
    } else {
      setSelectedHours([...selectedHours, hora])
    }
  }

  const selectAllHours = () => {
    setSelectedHours(HORAS)
  }

  const clearHours = () => {
    setSelectedHours([])
  }

  const getCalendarDays = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()
    
    const days = []
    for (let i = 0; i < startingDay; i++) {
      days.push(null)
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }
    return days
  }

  const formatDate = (day) => {
    if (!day) return null
    const year = currentMonth.getFullYear()
    const month = (currentMonth.getMonth() + 1).toString().padStart(2, '0')
    const d = day.toString().padStart(2, '0')
    return `${year}-${month}-${d}`
  }

  const isDateBlocked = (day) => {
    if (!day) return false
    const dateStr = formatDate(day)
    return blockedSlots.some(s => s.fecha === dateStr)
  }

  const getBlockedCount = (day) => {
    if (!day) return 0
    const dateStr = formatDate(day)
    return blockedSlots.filter(s => s.fecha === dateStr).length
  }

  const isPastDate = (day) => {
    if (!day) return false
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return ''
    const [year, month, day] = dateStr.split('-')
    return `${parseInt(day)} de ${MESES[parseInt(month) - 1]}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Horarios</h1>
          <p className="text-gray-500 text-sm">Configura disponibilidad y bloqueos</p>
        </div>
        {saved && (
          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm animate-pulse">
            <CheckCircle className="h-4 w-4" />
            Guardado
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('horarios')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'horarios' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Clock className="h-4 w-4 inline mr-2" />
          Horarios
        </button>
        <button
          onClick={() => setActiveTab('bloqueos')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'bloqueos' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Ban className="h-4 w-4 inline mr-2" />
          Bloqueos
          {blockedSlots.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
              {blockedSlots.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab: Horarios */}
      {activeTab === 'horarios' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {availability.map((dia) => (
              <div key={dia.id} className="p-3 text-center border-r border-gray-200 last:border-r-0">
                <span className="text-xs font-medium text-gray-500">{dia.dia_nombre?.slice(0, 3)}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {availability.map((dia) => (
              <div 
                key={dia.id} 
                className={`p-4 border-r border-gray-200 last:border-r-0 min-h-[140px] ${
                  dia.activo ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <button
                  onClick={() => handleToggleDay(dia)}
                  className={`w-full mb-3 p-2 rounded-lg text-xs font-medium transition-all ${
                    dia.activo 
                      ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' 
                      : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  }`}
                >
                  {dia.activo ? 'Abierto' : 'Cerrado'}
                </button>
                
                {dia.activo && (
                  <div className="space-y-2">
                    <select
                      value={dia.hora_inicio}
                      onChange={(e) => handleTimeChange(dia, 'hora_inicio', e.target.value)}
                      onBlur={() => handleUpdateAvailability(dia)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                    >
                      {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <div className="text-center text-gray-400 text-xs">a</div>
                    <select
                      value={dia.hora_fin}
                      onChange={(e) => handleTimeChange(dia, 'hora_fin', e.target.value)}
                      onBlur={() => handleUpdateAvailability(dia)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                    >
                      {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Bloqueos */}
      {activeTab === 'bloqueos' && (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Calendario - 3 columnas */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </button>
              <h3 className="text-lg font-semibold text-gray-900">
                {MESES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h3>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ChevronRight className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-3">
              {DIAS_SEMANA.map((dia, i) => (
                <div key={i} className="text-center text-xs font-semibold text-gray-400 py-2">
                  {dia}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {getCalendarDays().map((day, index) => {
                const dateStr = formatDate(day)
                const blockedCount = getBlockedCount(day)
                const isSelected = selectedDate === dateStr
                const isPast = isPastDate(day)
                
                return (
                  <button
                    key={index}
                    disabled={!day || isPast}
                    onClick={() => day && !isPast && setSelectedDate(dateStr)}
                    className={`
                      relative aspect-square flex flex-col items-center justify-center rounded-xl transition-all text-sm
                      ${!day ? 'invisible' : ''}
                      ${isPast ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100'}
                      ${isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105' : ''}
                      ${blockedCount > 0 && !isSelected ? 'bg-red-50 text-red-600 font-medium' : ''}
                    `}
                  >
                    <span>{day}</span>
                    {blockedCount > 0 && !isSelected && (
                      <span className="text-[10px] text-red-400">{blockedCount}h</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Panel derecho - 2 columnas */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
            {selectedDate ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900 text-lg">
                      {formatDisplayDate(selectedDate)}
                    </h4>
                    <p className="text-xs text-gray-500">{selectedDate}</p>
                  </div>
                  <button
                    onClick={() => { setSelectedDate(null); setSelectedHours([]); setBlockMotivo(''); }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                </div>

                {/* Bloqueados existentes */}
                {blockedSlots.filter(s => s.fecha === selectedDate).length > 0 && (
                  <div className="p-3 bg-red-50 rounded-xl">
                    <p className="text-xs font-semibold text-red-700 mb-2">Horarios bloqueados</p>
                    <div className="flex flex-wrap gap-1.5">
                      {blockedSlots.filter(s => s.fecha === selectedDate).map((slot) => (
                        <span
                          key={slot.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white text-red-600 text-xs rounded-lg border border-red-200 shadow-sm"
                        >
                          {slot.hora}
                          <button
                            onClick={() => handleDeleteBlock(slot.id)}
                            className="hover:text-red-800 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selector de horas */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-700">Seleccionar horas</p>
                    <div className="flex gap-1">
                      <button
                        onClick={selectAllHours}
                        className="text-xs px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                      >
                        Todas
                      </button>
                      <button
                        onClick={clearHours}
                        className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                      >
                        Ninguna
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {HORAS.map(hora => {
                      const isBlocked = blockedSlots.some(s => s.fecha === selectedDate && s.hora === hora)
                      const isSelected = selectedHours.includes(hora)
                      return (
                        <button
                          key={hora}
                          disabled={isBlocked}
                          onClick={() => !isBlocked && toggleHour(hora)}
                          className={`
                            py-2 text-xs font-medium rounded-lg transition-all
                            ${isBlocked 
                              ? 'bg-gray-100 text-gray-300 cursor-not-allowed line-through' 
                              : isSelected
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }
                          `}
                        >
                          {hora}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Motivo */}
                <input
                  type="text"
                  placeholder="Motivo (opcional)"
                  value={blockMotivo}
                  onChange={(e) => setBlockMotivo(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />

                {/* Botón */}
                <button 
                  onClick={handleAddBlock} 
                  disabled={selectedHours.length === 0 || loading}
                  className={`
                    w-full py-3 rounded-xl text-sm font-semibold transition-all
                    ${selectedHours.length === 0 || loading
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-200'
                    }
                  `}
                >
                  {loading ? 'Bloqueando...' : `Bloquear ${selectedHours.length} horario${selectedHours.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                  <Calendar className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">Selecciona una fecha</p>
                <p className="text-sm text-gray-400 mt-1">
                  en el calendario para bloquear horarios
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
