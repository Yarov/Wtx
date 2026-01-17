import { useState, useEffect } from 'react'
import { Wrench, Package, Calendar, CreditCard, Eye, Settings, XCircle, PenLine, CheckCircle } from 'lucide-react'
import Card from '../components/Card'
import Toggle from '../components/Toggle'
import Button from '../components/Button'
import { toolsApi } from '../api/client'

const TOOL_META = {
  consultar_inventario: { name: 'Consultar Inventario', icon: Package, category: 'inventory' },
  agendar_cita: { name: 'Agendar Cita', icon: Calendar, category: 'appointments' },
  ver_citas: { name: 'Ver Citas', icon: Eye, category: 'appointments' },
  cancelar_cita: { name: 'Cancelar Cita', icon: XCircle, category: 'appointments' },
  modificar_cita: { name: 'Modificar Cita', icon: PenLine, category: 'appointments' },
  generar_pago: { name: 'Generar Pago', icon: CreditCard, category: 'payments' },
}

const categories = {
  inventory: { name: 'Inventario', color: 'bg-purple-100 text-purple-700' },
  appointments: { name: 'Citas', color: 'bg-blue-100 text-blue-700' },
  payments: { name: 'Pagos', color: 'bg-emerald-100 text-emerald-700' },
}

export default function Tools() {
  const [tools, setTools] = useState([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadTools()
  }, [])

  const loadTools = async () => {
    try {
      const response = await toolsApi.getTools()
      const toolsData = response.data.map(t => ({
        id: t.id,
        enabled: t.enabled,
        description: t.description,
        ...TOOL_META[t.id]
      }))
      setTools(toolsData)
    } catch (error) {
      console.error('Error loading tools:', error)
    }
  }

  const toggleTool = async (id) => {
    const tool = tools.find(t => t.id === id)
    const newEnabled = !tool.enabled
    
    setTools(tools.map(t => t.id === id ? { ...t, enabled: newEnabled } : t))
    
    try {
      await toolsApi.toggleTool(id, newEnabled)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Error toggling tool:', error)
      setTools(tools.map(t => t.id === id ? { ...t, enabled: !newEnabled } : t))
    }
  }

  const enabledCount = tools.filter(t => t.enabled).length

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tools del Agente</h1>
          <p className="text-gray-500 mt-1">
            Configura las herramientas disponibles para el agente
          </p>
        </div>
        <div className="flex items-center gap-4">
          {saved && (
            <span className="flex items-center gap-1 text-sm text-emerald-600">
              <CheckCircle className="h-4 w-4" />
              Guardado
            </span>
          )}
          <span className="text-sm text-gray-500">
            {enabledCount} de {tools.length} activos
          </span>
        </div>
      </div>

      <Card title="Herramientas Disponibles" icon={Wrench}>
        <div className="divide-y divide-gray-100">
          {tools.map((tool) => (
            <div
              key={tool.id}
              className={`py-4 first:pt-0 last:pb-0 transition-opacity ${
                !tool.enabled ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <tool.icon className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{tool.name}</h4>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${categories[tool.category].color}`}>
                        {categories[tool.category].name}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{tool.description}</p>
                    <code className="text-xs text-gray-400 mt-2 block font-mono">
                      {tool.id}
                    </code>
                  </div>
                </div>
                <Toggle
                  enabled={tool.enabled}
                  onChange={() => toggleTool(tool.id)}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Configuración Avanzada" icon={Settings}>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-gray-900">Modo estricto</p>
              <p className="text-sm text-gray-500">
                El agente solo usará tools cuando sea estrictamente necesario
              </p>
            </div>
            <Toggle enabled={false} onChange={() => {}} />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-gray-900">Logging detallado</p>
              <p className="text-sm text-gray-500">
                Registra todas las llamadas a tools para debugging
              </p>
            </div>
            <Toggle enabled={true} onChange={() => {}} />
          </div>
        </div>
      </Card>

    </div>
  )
}
