import { useState, useEffect } from 'react'
import { 
  Key, Shield, Wifi, WifiOff, Copy, Check, Loader2, 
  MessageCircle, Brain, Clock, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle, Settings as SettingsIcon
} from 'lucide-react'
import Button from '../components/Button'
import { configApi, whatsappApi } from '../api/client'

const PROVIDERS = [
  { id: 'waha', name: 'WAHA', description: 'WhatsApp HTTP API' },
  { id: 'evolution', name: 'Evolution API', description: 'API más completa' },
]

const SYNC_INTERVALS = [
  { value: 3600, label: 'Cada hora' },
  { value: 21600, label: 'Cada 6 horas' },
  { value: 43200, label: 'Cada 12 horas' },
  { value: 86400, label: 'Cada 24 horas' },
]

export default function Settings() {
  // OpenAI
  const [openaiKey, setOpenaiKey] = useState('')
  
  // WhatsApp
  const [whatsappConfig, setWhatsappConfig] = useState({
    provider: 'waha',
    api_url: '',
    api_key: '',
    session: 'default',
    auto_sync: true,
    sync_interval: 21600,
  })
  
  // UI State
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [expandedSection, setExpandedSection] = useState('whatsapp')

  const webhookUrl = `${window.location.origin.replace(':5173', ':3000')}/api/webhook/whatsapp`

  useEffect(() => {
    loadAllConfig()
  }, [])

  const loadAllConfig = async () => {
    try {
      const [keysRes, waRes] = await Promise.all([
        configApi.getApiKeys().catch(() => ({ data: {} })),
        whatsappApi.getConfig().catch(() => ({ data: {} }))
      ])
      
      setOpenaiKey(keysRes.data?.openai_api_key || '')
      setWhatsappConfig(prev => ({ ...prev, ...waRes.data }))
    } catch (error) {
      console.error('Error loading config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await Promise.all([
        configApi.updateApiKeys({ openai_api_key: openaiKey }),
        whatsappApi.updateConfig(whatsappConfig)
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error saving:', error)
      alert('Error al guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  const handleTestWhatsApp = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      await whatsappApi.updateConfig(whatsappConfig)
      const response = await whatsappApi.testConnection()
      setTestResult(response.data)
    } catch (error) {
      setTestResult({ success: false, error: error.message })
    } finally {
      setTesting(false)
    }
  }

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-gray-500 text-sm">Gestiona las conexiones y credenciales del sistema</p>
        </div>
      </div>

      {/* Sticky Save Bar */}
      <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-200 px-8 py-4 z-20">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Los cambios no se guardan automáticamente
          </p>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-sm text-emerald-600 font-medium">
                ✓ Guardado correctamente
              </span>
            )}
            <Button onClick={handleSave} loading={saving}>
              Guardar Cambios
            </Button>
          </div>
        </div>
      </div>

      {/* WhatsApp Section */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('whatsapp')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="text-left">
              <h2 className="font-semibold text-gray-900">WhatsApp</h2>
              <p className="text-sm text-gray-500">Conexión con WAHA o Evolution API</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {whatsappConfig.api_url && (
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                Configurado
              </span>
            )}
            {expandedSection === 'whatsapp' ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </button>

        {expandedSection === 'whatsapp' && (
          <div className="px-6 pb-6 space-y-6 border-t border-gray-100">
            {/* Provider Selection */}
            <div className="pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Proveedor</label>
              <div className="grid grid-cols-2 gap-3">
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => setWhatsappConfig({ ...whatsappConfig, provider: provider.id })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      whatsappConfig.provider === provider.id
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-gray-900">{provider.name}</p>
                    <p className="text-xs text-gray-500">{provider.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Connection Settings */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL del servicio
                </label>
                <input
                  type="url"
                  value={whatsappConfig.api_url}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, api_url: e.target.value })}
                  placeholder="https://tu-servidor.com"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sesión
                </label>
                <input
                  type="text"
                  value={whatsappConfig.session}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, session: e.target.value })}
                  placeholder="default"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key (opcional)
                </label>
                <input
                  type="password"
                  value={whatsappConfig.api_key}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, api_key: e.target.value })}
                  placeholder="Tu API key si es requerida"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Test Connection */}
            <div className="flex items-center gap-4">
              <Button onClick={handleTestWhatsApp} loading={testing} variant="secondary" size="sm">
                Probar conexión
              </Button>
              
              {testResult && (
                <div className={`flex items-center gap-2 text-sm ${
                  testResult.success ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {testResult.success ? (
                    <>
                      <Wifi className="h-4 w-4" />
                      Conectado correctamente
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-4 w-4" />
                      {testResult.error || 'Error de conexión'}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Webhook URL */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tu Webhook URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={webhookUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-mono"
                />
                <button
                  onClick={copyWebhook}
                  className="p-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-gray-600" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Configura esta URL en tu {whatsappConfig.provider === 'waha' ? 'WAHA' : 'Evolution API'} para recibir mensajes
              </p>
            </div>

            {/* Sync Settings */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="auto_sync"
                  checked={whatsappConfig.auto_sync}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, auto_sync: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="auto_sync" className="text-sm text-gray-700">
                  Auto-sincronizar contactos
                </label>
              </div>
              
              {whatsappConfig.auto_sync && (
                <select
                  value={whatsappConfig.sync_interval}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, sync_interval: parseInt(e.target.value) })}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {SYNC_INTERVALS.map((interval) => (
                    <option key={interval.value} value={interval.value}>
                      {interval.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}
      </section>

      {/* OpenAI Section */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('openai')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
              <Brain className="h-5 w-5 text-violet-600" />
            </div>
            <div className="text-left">
              <h2 className="font-semibold text-gray-900">OpenAI</h2>
              <p className="text-sm text-gray-500">API para el agente de IA (GPT-4)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {openaiKey && (
              <span className="px-2 py-1 bg-violet-100 text-violet-700 text-xs font-medium rounded-full">
                Configurado
              </span>
            )}
            {expandedSection === 'openai' ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </button>

        {expandedSection === 'openai' && (
          <div className="px-6 pb-6 space-y-4 border-t border-gray-100">
            <div className="pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Obtén tu API key en <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">platform.openai.com</a>
              </p>
            </div>

            <div className="p-4 bg-violet-50 border border-violet-200 rounded-lg">
              <p className="text-sm text-violet-800">
                <strong>Uso:</strong> Esta API key se usa para el agente de IA que responde mensajes de WhatsApp 
                y para generar/mejorar mensajes de campañas.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Security Notice */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-amber-800">
          <p className="font-medium">Seguridad</p>
          <p className="mt-1">
            Las credenciales se almacenan de forma segura en el servidor. 
            Nunca compartas estas claves y asegúrate de usar variables de entorno en producción.
          </p>
        </div>
      </div>
    </div>
  )
}
