import { useState, useEffect } from 'react'
import { Loader2, Smartphone, RefreshCw, LogOut, CheckCircle, AlertCircle } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import { whatsappApi } from '../api/client'

export default function WhatsAppConfig() {
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [status, setStatus] = useState('LOADING')
  const [qrCode, setQrCode] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    connect()
  }, [])

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

  const refreshStatus = async () => {
    try {
      const response = await whatsappApi.getStatus()
      if (response.data) {
        setStatus(response.data.status || 'ERROR')
        setQrCode(response.data.qr || null)
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
        ) : status === 'SCAN_QR_CODE' && qrCode ? (
          <div className="text-center py-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200 inline-block mb-4">
              <img src={qrCode} alt="Código QR" className="w-56 h-56" />
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
        )}
      </Card>
    </div>
  )
}
