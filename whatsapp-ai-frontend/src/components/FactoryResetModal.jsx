import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { businessApi } from '../api/client'

const RESET_OPTIONS = [
  { id: 'contactos', label: 'Contactos', desc: 'Clientes y su historial' },
  { id: 'citas', label: 'Citas', desc: 'Agenda completa' },
  { id: 'campanas', label: 'Campañas', desc: 'Envíos masivos' },
  { id: 'inventario', label: 'Inventario', desc: 'Productos y servicios' },
  { id: 'conversaciones', label: 'Chats', desc: 'Historial de mensajes' },
  { id: 'configuracion', label: 'Config', desc: 'Prompts y modelo IA' },
  { id: 'horarios', label: 'Horarios', desc: 'Disponibilidad' },
  { id: 'usuarios', label: 'Usuarios', desc: 'Otras cuentas' },
]

const FULL_RESET_OPTION = { id: 'full_reset', label: 'Reset Total', desc: 'Elimina TODO incluyendo tu cuenta' }

export default function FactoryResetModal({ isOpen, onClose }) {
  const [selected, setSelected] = useState([])
  const [fullReset, setFullReset] = useState(false)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  if (!isOpen) return null

  const toggle = (id) => {
    if (fullReset) return // No permitir cambios individuales si es full reset
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  
  const toggleFullReset = () => {
    if (!fullReset) {
      setFullReset(true)
      setSelected(RESET_OPTIONS.map(o => o.id))
    } else {
      setFullReset(false)
      setSelected([])
    }
  }
  
  const selectAll = () => {
    setFullReset(false)
    setSelected(RESET_OPTIONS.map(o => o.id))
  }
  const clear = () => {
    setFullReset(false)
    setSelected([])
  }

  const handleConfirm = async () => {
    if (selected.length === 0 && !fullReset) return
    setLoading(true)
    try {
      const sections = fullReset ? [...selected, 'full_reset'] : selected
      const res = await businessApi.factoryReset({ sections })
      setResult(res.data)
      setStep(3)
    } catch (e) {
      alert(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (step === 3) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    } else {
      setStep(1)
      setSelected([])
      setFullReset(false)
      setResult(null)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={step !== 2 ? handleClose : undefined} />
      
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl">
        {step === 1 && (
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Reiniciar datos</h2>
                <p className="text-sm text-gray-500 mt-1">Selecciona los módulos a eliminar. Esta acción es irreversible.</p>
              </div>
              <div className="flex gap-2 text-sm">
                <button onClick={selectAll} className="text-indigo-600 hover:underline">Todo</button>
                <span className="text-gray-300">·</span>
                <button onClick={clear} className="text-gray-500 hover:underline">Ninguno</button>
              </div>
            </div>

            <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 ${fullReset ? 'opacity-50 pointer-events-none' : ''}`}>
              {RESET_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => toggle(opt.id)}
                  className={`relative p-4 rounded-lg border text-left transition-all ${
                    selected.includes(opt.id)
                      ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`absolute top-3 right-3 w-4 h-4 rounded border flex items-center justify-center ${
                    selected.includes(opt.id)
                      ? 'bg-indigo-600 border-indigo-600'
                      : 'border-gray-300'
                  }`}>
                    {selected.includes(opt.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p className="font-medium text-gray-900 text-sm">{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>

            {/* Reset Total Option */}
            <button
              onClick={toggleFullReset}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all mb-6 ${
                fullReset
                  ? 'border-red-500 bg-red-50 ring-1 ring-red-500'
                  : 'border-dashed border-gray-300 hover:border-red-300 hover:bg-red-50/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">Reset Total</p>
                  <p className="text-sm text-gray-500">Elimina TODO y reinicia el onboarding. La app quedará como recién instalada.</p>
                </div>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  fullReset ? 'bg-red-500 border-red-500' : 'border-gray-300'
                }`}>
                  {fullReset && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </button>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button onClick={handleClose} className="flex-1 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={selected.length === 0}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-40"
              >
                Continuar ({selected.length})
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Confirmar eliminación</h2>
            <p className="text-sm text-gray-500 mb-6">Los siguientes datos se eliminarán permanentemente:</p>

            <div className="flex flex-wrap gap-2 mb-6">
              {selected.map(id => (
                <span key={id} className="px-3 py-1.5 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                  {RESET_OPTIONS.find(o => o.id === id)?.label}
                </span>
              ))}
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button onClick={() => setStep(1)} disabled={loading} className="flex-1 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">
                Volver
              </button>
              <button onClick={handleConfirm} disabled={loading} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Eliminando...</> : 'Eliminar'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Completado</h2>
            <p className="text-sm text-gray-500 mb-6">Los datos han sido eliminados.</p>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              {Object.entries(result.deleted || {}).map(([key, count]) => (
                <div key={key} className="flex justify-between py-1.5 text-sm">
                  <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-gray-900 font-medium">{count}</span>
                </div>
              ))}
            </div>

            <button onClick={handleClose} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
