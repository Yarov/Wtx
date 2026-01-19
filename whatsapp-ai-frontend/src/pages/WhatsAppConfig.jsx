import { useState, useEffect } from 'react'
import { Copy, Check, Loader2, Wifi, WifiOff } from 'lucide-react'
import Button from '../components/Button'
import { whatsappApi } from '../api/client'

const PROVIDERS = [
  { id: 'waha', name: 'WAHA', description: 'WhatsApp HTTP API' },
  { id: 'evolution', name: 'Evolution API', description: 'API más completa' },
  { id: 'custom', name: 'Personalizado', description: 'Otro proveedor' },
]

const SYNC_INTERVALS = [
  { value: 3600, label: 'Cada hora' },
  { value: 21600, label: 'Cada 6 horas' },
  { value: 43200, label: 'Cada 12 horas' },
  { value: 86400, label: 'Cada 24 horas' },
]

export default function WhatsAppConfig() {
  const [config, setConfig] = useState({
    provider: 'waha',
    api_url: '',
    api_key: '',
    session: 'default',
    auto_sync: true,
    sync_interval: 21600,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  // Webhook URL (se genera dinámicamente)
  const webhookUrl = `${window.location.origin.replace(':5173', ':3000')}/api/webhook/whatsapp`

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const response = await whatsappApi.getConfig()
      setConfig(response.data)
    } catch (error) {
      console.error('Error loading config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await whatsappApi.updateConfig(config)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error saving:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      // Guardar primero para que el test use la config actualizada
      await whatsappApi.updateConfig(config)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración WhatsApp</h1>
        <p className="text-gray-500 text-sm">Conecta tu servicio de WhatsApp (WAHA o Evolution API)</p>
      </div>

      {/* Provider Selection */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Proveedor</h2>
        <div className="grid grid-cols-3 gap-3">
          {PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              onClick={() => setConfig({ ...config, provider: provider.id })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                config.provider === provider.id
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="font-medium text-gray-900">{provider.name}</p>
              <p className="text-xs text-gray-500">{provider.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Connection Settings */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Conexión</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL del servicio
            </label>
            <input
              type="url"
              value={config.api_url}
              onChange={(e) => setConfig({ ...config, api_url: e.target.value })}
              placeholder="https://tu-servidor.com"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              La URL donde está corriendo tu {config.provider === 'waha' ? 'WAHA' : config.provider === 'evolution' ? 'Evolution API' : 'servicio'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <input
              type="password"
              value={config.api_key}
              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
              placeholder="Tu API key"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de sesión
            </label>
            <input
              type="text"
              value={config.session}
              onChange={(e) => setConfig({ ...config, session: e.target.value })}
              placeholder="default"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              El nombre de la sesión en tu {config.provider === 'waha' ? 'WAHA' : 'Evolution'} (normalmente "default")
            </p>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-4 pt-2">
            <Button onClick={handleTest} loading={testing} variant="secondary">
              Probar conexión
            </Button>
            
            {testResult && (
              <div className={`flex items-center gap-2 text-sm ${
                testResult.success ? 'text-indigo-600' : 'text-red-600'
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
        </div>
      </section>

      {/* Webhook URL */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Tu Webhook</h2>
        <p className="text-sm text-gray-500 mb-4">
          Configura esta URL en tu {config.provider === 'waha' ? 'WAHA' : 'Evolution API'} para recibir mensajes
        </p>
        
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={webhookUrl}
            readOnly
            className="flex-1 px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-sm font-mono"
          />
          <button
            onClick={copyWebhook}
            className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {copied ? (
              <Check className="h-5 w-5 text-indigo-600" />
            ) : (
              <Copy className="h-5 w-5 text-gray-600" />
            )}
          </button>
        </div>
        
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>Importante:</strong> Después de configurar el webhook en tu {config.provider === 'waha' ? 'WAHA' : 'Evolution'}, 
            los mensajes de WhatsApp llegarán automáticamente a esta aplicación.
          </p>
        </div>
      </section>

      {/* Sync Settings */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sincronización de Contactos</h2>
        
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.auto_sync}
              onChange={(e) => setConfig({ ...config, auto_sync: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
            />
            <div>
              <p className="font-medium text-gray-900">Auto-sincronizar contactos</p>
              <p className="text-sm text-gray-500">Respalda tus contactos automáticamente</p>
            </div>
          </label>

          {config.auto_sync && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Frecuencia
              </label>
              <select
                value={config.sync_interval}
                onChange={(e) => setConfig({ ...config, sync_interval: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {SYNC_INTERVALS.map((interval) => (
                  <option key={interval.value} value={interval.value}>
                    {interval.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {config.last_sync && (
            <p className="text-sm text-gray-500">
              Última sincronización: {new Date(config.last_sync).toLocaleString()}
            </p>
          )}
        </div>
      </section>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="text-sm text-indigo-600">✓ Guardado</span>
        )}
        <Button onClick={handleSave} loading={saving}>
          Guardar Configuración
        </Button>
      </div>
    </div>
  )
}
