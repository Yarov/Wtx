import { useState, useEffect } from 'react'
import { Key, Shield, AlertCircle, CheckCircle } from 'lucide-react'
import Card from '../components/Card'
import { SecretInput } from '../components/Input'
import Button from '../components/Button'
import { configApi } from '../api/client'

export default function ApiKeys() {
  const [keys, setKeys] = useState({
    openai_api_key: '',
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_phone_number: '',
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadKeys()
  }, [])

  const loadKeys = async () => {
    try {
      const response = await configApi.getApiKeys()
      setKeys(response.data)
    } catch (error) {
      console.log('No keys configured yet')
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await configApi.updateApiKeys(keys)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      alert('Error al guardar las llaves')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
        <p className="text-gray-500 mt-1">Configura las credenciales de los servicios externos</p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700">
          <CheckCircle className="h-5 w-5" />
          <span>Configuración guardada correctamente</span>
        </div>
      )}

      <div className="grid gap-6">
        {/* OpenAI */}
        <Card 
          title="OpenAI" 
          description="API para el modelo de lenguaje GPT"
          icon={Key}
        >
          <div className="space-y-4">
            <SecretInput
              label="API Key"
              placeholder="sk-..."
              value={keys.openai_api_key}
              onChange={(e) => setKeys({ ...keys, openai_api_key: e.target.value })}
              helperText="Obtén tu API key en platform.openai.com"
            />
          </div>
        </Card>

        {/* Twilio */}
        <Card 
          title="Twilio" 
          description="Servicio de mensajería WhatsApp"
          icon={Shield}
        >
          <div className="space-y-4">
            <SecretInput
              label="Account SID"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={keys.twilio_account_sid}
              onChange={(e) => setKeys({ ...keys, twilio_account_sid: e.target.value })}
              helperText="Encuentra tu Account SID en la consola de Twilio"
            />
            <SecretInput
              label="Auth Token"
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={keys.twilio_auth_token}
              onChange={(e) => setKeys({ ...keys, twilio_auth_token: e.target.value })}
              helperText="Token de autenticación de Twilio"
            />
            <SecretInput
              label="Número de WhatsApp"
              placeholder="+14155238886"
              value={keys.twilio_phone_number}
              onChange={(e) => setKeys({ ...keys, twilio_phone_number: e.target.value })}
              helperText="Número de WhatsApp de Twilio (formato: +1234567890)"
            />
          </div>
        </Card>

        {/* Warning */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Importante</p>
            <p className="mt-1">
              Las API keys se almacenan de forma segura. Nunca compartas estas credenciales 
              y asegúrate de usar variables de entorno en producción.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} loading={loading} icon={Key}>
            Guardar Configuración
          </Button>
        </div>
      </div>
    </div>
  )
}
