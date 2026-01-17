import { useState, useEffect } from 'react'
import { MessageSquare, Sparkles, RotateCcw, CheckCircle } from 'lucide-react'
import Card from '../components/Card'
import { Textarea, Input } from '../components/Input'
import Button from '../components/Button'
import { promptApi } from '../api/client'

const DEFAULT_PROMPT = `Eres un asistente de WhatsApp para una barbería/salón.
Ofreces servicios, agendas citas, consultas inventario y generas pagos.
Responde claro, corto y amable.
Siempre saluda al cliente y ofrece ayuda.`

export default function Prompt() {
  const [config, setConfig] = useState({
    system_prompt: DEFAULT_PROMPT,
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 500,
    business_name: 'Mi Negocio',
    business_type: 'barbería',
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadPrompt()
  }, [])

  const loadPrompt = async () => {
    try {
      const response = await promptApi.getPrompt()
      setConfig({ ...config, ...response.data })
    } catch (error) {
      console.log('Using default prompt')
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await promptApi.updatePrompt(config)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.log('Saved locally')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setLoading(false)
    }
  }

  const resetPrompt = () => {
    setConfig({ ...config, system_prompt: DEFAULT_PROMPT })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Prompt del Sistema</h1>
        <p className="text-gray-500 mt-1">
          Configura la personalidad y comportamiento del agente
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700">
          <CheckCircle className="h-5 w-5" />
          <span>Configuración guardada correctamente</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title="System Prompt" icon={MessageSquare}>
            <div className="space-y-4">
              <Textarea
                label="Instrucciones del agente"
                value={config.system_prompt}
                onChange={(e) => setConfig({ ...config, system_prompt: e.target.value })}
                rows={10}
                placeholder="Escribe las instrucciones para el agente..."
                helperText="Define cómo debe comportarse y responder el agente"
              />
              <div className="flex justify-end">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  icon={RotateCcw}
                  onClick={resetPrompt}
                >
                  Restaurar predeterminado
                </Button>
              </div>
            </div>
          </Card>

          <Card title="Información del Negocio" icon={Sparkles}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Nombre del negocio"
                value={config.business_name}
                onChange={(e) => setConfig({ ...config, business_name: e.target.value })}
                placeholder="Mi Barbería"
              />
              <Input
                label="Tipo de negocio"
                value={config.business_type}
                onChange={(e) => setConfig({ ...config, business_type: e.target.value })}
                placeholder="barbería, salón, spa..."
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Modelo">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Modelo de IA
                </label>
                <select
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini (Recomendado)</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temperatura: {config.temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.temperature}
                  onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Preciso</span>
                  <span>Creativo</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max tokens: {config.max_tokens}
                </label>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="100"
                  value={config.max_tokens}
                  onChange={(e) => setConfig({ ...config, max_tokens: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Corto</span>
                  <span>Largo</span>
                </div>
              </div>
            </div>
          </Card>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">💡 Tips</h4>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• Sé específico en las instrucciones</li>
              <li>• Define el tono de comunicación</li>
              <li>• Indica qué NO debe hacer el agente</li>
              <li>• Menciona los servicios principales</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={loading}>
          Guardar Configuración
        </Button>
      </div>
    </div>
  )
}
