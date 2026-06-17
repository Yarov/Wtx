import { useState, useEffect } from 'react'
import { GitBranch, Plus, Edit, Trash2, X, ArrowDown, Users, ToggleLeft, ToggleRight, Loader2, ChevronRight, CheckCircle } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import { funnelApi, captureApi } from '../api/client'
import { ConfirmDialog } from '../components/ui'

const CONDITION_TYPES = [
  { id: 'datos_capturados', label: 'Datos capturados', desc: 'Avanza cuando se capturen ciertos datos del cliente' },
]

export default function Funnel() {
  const [steps, setSteps] = useState([])
  const [stats, setStats] = useState({ steps: [], sin_paso: 0 })
  const [captureFields, setCaptureFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editStep, setEditStep] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [stepToDelete, setStepToDelete] = useState(null)
  const [form, setForm] = useState({ nombre: '', titulo: '', orden: 0, descripcion: '', instrucciones_agente: '', condiciones_avance: [] })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [stepsRes, statsRes, fieldsRes] = await Promise.all([funnelApi.getSteps(), funnelApi.stats(), captureApi.getFields()])
      setSteps(stepsRes.data)
      setStats(statsRes.data)
      setCaptureFields(fieldsRes.data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editStep) await funnelApi.updateStep(editStep.id, form)
      else await funnelApi.createStep(form)
      setShowForm(false); setEditStep(null); resetForm(); loadData()
    } catch (e) { alert(e.response?.data?.detail || 'Error') }
  }

  const handleDelete = async () => {
    if (!stepToDelete) return
    setShowDeleteConfirm(false)
    try { await funnelApi.deleteStep(stepToDelete); setStepToDelete(null); loadData() } catch (e) { console.error(e) }
  }

  const openEdit = (step) => {
    setEditStep(step)
    setForm({ nombre: step.nombre, titulo: step.titulo, orden: step.orden, descripcion: step.descripcion || '', instrucciones_agente: step.instrucciones_agente || '', condiciones_avance: step.condiciones_avance || [] })
    setShowForm(true)
  }

  const resetForm = () => setForm({ nombre: '', titulo: '', orden: steps.length, descripcion: '', instrucciones_agente: '', condiciones_avance: [] })

  const addCondition = (tipo) => {
    const defaultFields = captureFields.map(f => f.nombre)
    const newCond = { tipo: 'datos_capturados', campos: defaultFields.length > 0 ? defaultFields : ['nombre'] }
    setForm({ ...form, condiciones_avance: [...form.condiciones_avance, newCond] })
  }

  const removeCondition = (idx) => setForm({ ...form, condiciones_avance: form.condiciones_avance.filter((_, i) => i !== idx) })

  const toggleConditionField = (condIdx, fieldName) => {
    const updated = [...form.condiciones_avance]
    const cond = { ...updated[condIdx] }
    const campos = cond.campos || []
    cond.campos = campos.includes(fieldName) ? campos.filter(f => f !== fieldName) : [...campos, fieldName]
    updated[condIdx] = cond
    setForm({ ...form, condiciones_avance: updated })
  }

  const toggleStepActive = async (step) => {
    try { await funnelApi.updateStep(step.id, { activo: !step.activo }); loadData() } catch (e) { console.error(e) }
  }

  const getStepContactCount = (stepName) => stats.steps?.find(s => s.paso === stepName)?.contactos || 0
  const totalInFunnel = steps.reduce((sum, s) => sum + getStepContactCount(s.nombre), 0) + (stats.sin_paso || 0)
  const sortedSteps = [...steps].sort((a, b) => a.orden - b.orden)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Funnel de Ventas</h1>
          <p className="text-gray-500 mt-1">Define los pasos por los que pasan tus clientes y como el agente los guia</p>
        </div>
        <Button onClick={() => { setEditStep(null); resetForm(); setShowForm(true) }} icon={Plus}>Nuevo Paso</Button>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-2xl font-bold text-gray-900">{steps.length}</p>
          <p className="text-sm text-gray-500">Pasos definidos</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-2xl font-bold text-indigo-600">{totalInFunnel}</p>
          <p className="text-sm text-gray-500">Contactos en funnel</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-2xl font-bold text-amber-600">{stats.sin_paso || 0}</p>
          <p className="text-sm text-gray-500">Sin paso asignado</p>
        </div>
      </div>

      {/* Funnel visual */}
      {!loading && sortedSteps.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Distribucion</h3>
          <div className="flex items-end gap-1 h-20">
            {sortedSteps.map((step, idx) => {
              const count = getStepContactCount(step.nombre)
              const maxCount = Math.max(...sortedSteps.map(s => getStepContactCount(s.nombre)), 1)
              const height = Math.max((count / maxCount) * 100, 8)
              const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-pink-500', 'bg-emerald-500']
              return (
                <div key={step.id} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-gray-700">{count}</span>
                  <div className={`w-full rounded-t-lg ${colors[idx % colors.length]} transition-all`} style={{ height: `${height}%` }} />
                  <span className="text-[10px] text-gray-500 truncate w-full text-center">{step.titulo}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Steps */}
      <Card title="Pipeline" icon={GitBranch}>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
        ) : steps.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <GitBranch className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No hay pasos definidos.</p>
          </div>
        ) : (
          <div className="space-y-0">
            {sortedSteps.map((step, idx) => {
              const count = getStepContactCount(step.nombre)
              const pct = totalInFunnel > 0 ? Math.round((count / totalInFunnel) * 100) : 0
              return (
                <div key={step.id}>
                  <div className={`flex items-stretch gap-4 p-4 rounded-xl transition-colors ${step.activo ? 'hover:bg-gray-50' : 'opacity-50'}`}>
                    {/* Step number + line */}
                    <div className="flex flex-col items-center w-10 flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
                        {idx + 1}
                      </div>
                      {idx < sortedSteps.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">{step.titulo}</h4>
                        <span className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded-full font-mono">{step.nombre}</span>
                        {!step.activo && <span className="px-2 py-0.5 text-[10px] bg-red-100 text-red-600 rounded-full">Inactivo</span>}
                      </div>

                      {step.descripcion && <p className="text-sm text-gray-500 mb-2">{step.descripcion}</p>}

                      {step.instrucciones_agente && (
                        <div className="bg-indigo-50/50 rounded-lg p-3 text-sm text-indigo-700 mb-2 border border-indigo-100">
                          {step.instrucciones_agente}
                        </div>
                      )}

                      {/* Conditions */}
                      {step.condiciones_avance?.length > 0 && (
                        <div className="flex gap-2 flex-wrap mb-2">
                          {step.condiciones_avance.map((c, ci) => (
                            <span key={ci} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
                              <CheckCircle className="h-3 w-3" />
                              {c.tipo === 'datos_capturados' ? `Datos: ${c.campos?.join(', ')}` : 'Cita agendada'}
                            </span>
                          ))}
                        </div>
                      )}
                      {(!step.condiciones_avance || step.condiciones_avance.length === 0) && (
                        <p className="text-xs text-gray-400 mb-2">Avance manual por el agente IA</p>
                      )}

                      {/* Contact count bar */}
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-gray-400" />
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[200px]">
                          <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 font-medium">{count} contactos ({pct}%)</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-start gap-1 flex-shrink-0">
                      <button onClick={() => toggleStepActive(step)} className="p-2 rounded-lg hover:bg-gray-100" title={step.activo ? 'Desactivar' : 'Activar'}>
                        {step.activo ? <ToggleRight className="h-5 w-5 text-indigo-500" /> : <ToggleLeft className="h-5 w-5 text-gray-400" />}
                      </button>
                      <button onClick={() => openEdit(step)} className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-gray-100"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => { setStepToDelete(step.id); setShowDeleteConfirm(true) }} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto shadow-xl">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold">{editStep ? 'Editar Paso' : 'Nuevo Paso'}</h2>
              <button onClick={() => { setShowForm(false); setEditStep(null) }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID interno</label>
                  <input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value.toLowerCase().replace(/\s/g, '_')})} required disabled={!!editStep}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="ej: calificacion" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titulo visible</label>
                  <input value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
                  <input type="number" value={form.orden} onChange={e => setForm({...form, orden: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion corta</label>
                <input value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Que pasa en este paso" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones para el Agente IA</label>
                <textarea value={form.instrucciones_agente} onChange={e => setForm({...form, instrucciones_agente: e.target.value})}
                  rows={4} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Que debe hacer el agente cuando el cliente este en este paso..." />
                <p className="text-xs text-gray-400 mt-1">Estas instrucciones se inyectan al prompt del agente automaticamente</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Condiciones para avanzar al siguiente paso</label>
                <div className="space-y-2 mb-3">
                  {form.condiciones_avance.map((cond, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">{CONDITION_TYPES.find(c => c.id === cond.tipo)?.label || cond.tipo}</span>
                        <button type="button" onClick={() => removeCondition(idx)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                      </div>
                      {cond.tipo === 'datos_capturados' && (
                        <div className="flex flex-wrap gap-2">
                          {captureFields.map(field => (
                            <label key={field.nombre} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-colors ${
                              (cond.campos || []).includes(field.nombre) ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}>
                              <input type="checkbox" checked={(cond.campos || []).includes(field.nombre)}
                                onChange={() => toggleConditionField(idx, field.nombre)} className="hidden" />
                              {field.etiqueta}
                            </label>
                          ))}
                          {captureFields.length === 0 && <p className="text-xs text-gray-400">No hay campos de captura configurados. Ve a Agente IA &gt; Captura de Datos.</p>}
                        </div>
                      )}
                    </div>
                  ))}
                  {form.condiciones_avance.length === 0 && (
                    <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">Sin condiciones automaticas. El agente IA decidira cuando avanzar segun sus instrucciones.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {CONDITION_TYPES.map(ct => (
                    <button key={ct.id} type="button" onClick={() => addCondition(ct.id)}
                      className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 font-medium">
                      + {ct.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <Button variant="secondary" type="button" onClick={() => { setShowForm(false); setEditStep(null) }}>Cancelar</Button>
                <Button type="submit">{editStep ? 'Guardar' : 'Crear Paso'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setStepToDelete(null) }}
        onConfirm={handleDelete}
        title="Eliminar paso"
        message="Los contactos en este paso quedaran sin paso asignado."
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  )
}
