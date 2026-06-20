import { useState, useEffect } from 'react'
import { Loader2, Smartphone, RefreshCw, LogOut, CheckCircle, AlertCircle, QrCode, KeyRound } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import { whatsappApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

// Formatea un código de 8 caracteres como "ABCD-1234"
const formatPairingCode = (code) => {
  if (!code) return ''
  const clean = String(code).replace(/[\s-]/g, '').toUpperCase()
  if (clean.length <= 4) return clean
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}`
}

export default function WhatsAppConfig() {
  const { perfilActivo } = useAuth()
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [status, setStatus] = useState('LOADING')
  const [qrCode, setQrCode] = useState(null)
  const [error, setError] = useState(null)
  // Método de vinculación: 'qr' (por defecto) o 'code' (código de teléfono)
  const [method, setMethod] = useState('qr')
  const [phone, setPhone] = useState('')
  const [pairingCode, setPairingCode] = useState(null)

  useEffect(() => {
    // Reconectar cuando cambia el perfil activo (cada perfil = su propia sesión)
    connect()
  }, [perfilActivo?.id])

  useEffect(() => {
    if (status === 'SCAN_QR_CODE' || status === 'STARTING') {
      const interval = setInterval(refreshStatus, 3000)
      return () => clearInterval(interval)
    }
  }, [status])

  const connect = async () => {
    setConnecting(true)
    setError(null)
    try {
      const response = await whatsappApi.connect()
      if (response.data) {
        setStatus(response.data.status || 'ERROR')
        setQrCode(response.data.qr || null)
        setPairingCode(response.data.code || null)
        if (!response.data.success) {
          setError(response.data.error || response.data.message)
        }
      }
    } catch (err) {
      setError('Error conectando con el servidor')
      setStatus('ERROR')
    } finally {
      setLoading(false)
      setConnecting(false)
    }
  }

  const generarCodigo = async () => {
    const telefono = phone.trim()
    if (!telefono) {
      setError('Ingresa tu número de teléfono con código de país')
      return
    }
    setConnecting(true)
    setError(null)
    setPairingCode(null)
    try {
      const response = await whatsappApi.connect({ method: 'code', phone: telefono })
      if (response.data) {
        setStatus(response.data.status || 'ERROR')
        setPairingCode(response.data.code || null)
        setQrCode(response.data.qr || null)
        if (!response.data.success && !response.data.code) {
          setError(response.data.error || response.data.message)
        }
      }
    } catch (err) {
      setError('Error generando el código')
    } finally {
      setConnecting(false)
    }
  }

  const refreshStatus = async () => {
    try {
      const response = await whatsappApi.getStatus()
      if (response.data) {
        setStatus(response.data.status || 'ERROR')
        setQrCode(response.data.qr || null)
        if (response.data.code) setPairingCode(response.data.code)
      }
    } catch (err) {
      console.error('Error refreshing status:', err)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('¿Desconectar WhatsApp? Tendrás que escanear el QR de nuevo.')) return
    try {
      await whatsappApi.disconnect()
      setStatus('STOPPED')
      setQrCode(null)
      setPairingCode(null)
      setTimeout(connect, 1000)
    } catch (err) {
      setError('Error al desconectar')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Conectando WhatsApp...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp</h1>
        <p className="text-gray-500 mt-1">Vincula tu cuenta de WhatsApp para enviar y recibir mensajes</p>
        {perfilActivo && (
          <p className="text-sm text-gray-400 mt-1">
            Esta conexión pertenece al perfil{' '}
            <span className="font-medium text-gray-600">
              {perfilActivo.emoji} {perfilActivo.nombre}
            </span>
            {perfilActivo.numero_whatsapp ? ` (${perfilActivo.numero_whatsapp})` : ''}
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card 
        title="Conexión WhatsApp" 
        description="Estado de tu cuenta vinculada"
        icon={Smartphone}
      >
        {status === 'WORKING' ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Conectado</h3>
            <p className="text-gray-500 text-sm mb-6">
              Tu WhatsApp está vinculado y listo para usar
            </p>
            <Button variant="ghost" onClick={handleDisconnect} className="text-red-600 hover:bg-red-50">
              <LogOut className="h-4 w-4 mr-2" />
              Desconectar
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Selector de método de vinculación */}
            <div className="flex p-1 bg-gray-100 rounded-lg max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => setMethod('qr')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  method === 'qr'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <QrCode className="h-4 w-4" />
                Escanear QR
              </button>
              <button
                type="button"
                onClick={() => setMethod('code')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  method === 'code'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <KeyRound className="h-4 w-4" />
                Código de teléfono
              </button>
            </div>

            {method === 'qr' ? (
              /* ---- Modo QR (comportamiento original) ---- */
              status === 'SCAN_QR_CODE' && qrCode ? (
                <div className="text-center py-4">
                  <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 inline-block mb-4">
                    <img
                      src={qrCode}
                      alt="Código QR"
                      className="w-48 h-48 sm:w-56 sm:h-56 max-w-full"
                    />
                  </div>
                  <p className="font-medium text-gray-900 mb-2">Escanea el código QR</p>
                  <p className="text-sm text-gray-500">
                    Abre WhatsApp → <strong>Menú</strong> → <strong>Dispositivos vinculados</strong> → <strong>Vincular</strong>
                  </p>
                </div>
              ) : status === 'STARTING' || connecting ? (
                <div className="text-center py-8">
                  <Loader2 className="h-12 w-12 text-indigo-500 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Preparando conexión...</p>
                  <p className="text-sm text-gray-400 mt-1">Esto tomará unos segundos</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 mb-4">No se pudo conectar</p>
                  <Button onClick={connect} loading={connecting}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reintentar
                  </Button>
                </div>
              )
            ) : (
              /* ---- Modo Código de teléfono ---- */
              <div className="max-w-sm mx-auto">
                {pairingCode ? (
                  <div className="text-center py-2">
                    <p className="font-medium text-gray-900 mb-3">Tu código de emparejamiento</p>
                    <div className="bg-white p-4 rounded-lg border border-gray-200 inline-block mb-4">
                      <span className="font-mono text-3xl sm:text-4xl font-bold tracking-[0.2em] text-gray-900 select-all">
                        {formatPairingCode(pairingCode)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 text-left bg-gray-50 rounded-lg p-4 mb-4">
                      <p className="font-medium text-gray-700 mb-2">En tu teléfono:</p>
                      <p>
                        Abre WhatsApp → <strong>Dispositivos vinculados</strong> →{' '}
                        <strong>Vincular dispositivo</strong> →{' '}
                        <strong>Vincular con número de teléfono</strong> → escribe este código
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">
                      El código caduca en ~60 segundos. Si expira, genera otro.
                    </p>
                    <Button variant="ghost" onClick={generarCodigo} loading={connecting}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Generar otro código
                    </Button>
                  </div>
                ) : (
                  <div className="py-2">
                    <label htmlFor="phone-pairing" className="block text-sm font-medium text-gray-700 mb-1">
                      Número de teléfono
                    </label>
                    <input
                      id="phone-pairing"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+52 1 55 1234 5678"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-400 mt-1 mb-4">
                      Incluye el código de país (ej. <strong>+52 1 55 1234 5678</strong>).
                    </p>
                    <Button onClick={generarCodigo} loading={connecting} className="w-full">
                      <KeyRound className="h-4 w-4 mr-2" />
                      Generar código
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
