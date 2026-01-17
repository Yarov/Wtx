import { useState, useEffect } from 'react'
import { CreditCard, CheckCircle, Clock, XCircle, ExternalLink, Settings } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import { Input } from '../components/Input'
import { paymentsApi } from '../api/client'

const STATUS_STYLES = {
  pendiente: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
  completado: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  pagado: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  cancelado: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
  fallido: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
}

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [config, setConfig] = useState({
    payment_provider: 'none',
    stripe_secret_key: '',
    mercadopago_access_token: '',
    payment_currency: 'MXN',
  })
  const [showConfig, setShowConfig] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadPayments()
    loadConfig()
  }, [])

  const loadPayments = async () => {
    try {
      const response = await paymentsApi.getPayments()
      setPayments(response.data || [])
    } catch (error) {
      console.error('Error loading payments:', error)
    }
  }

  const loadConfig = async () => {
    try {
      const response = await paymentsApi.getConfig()
      setConfig(response.data)
    } catch (error) {
      console.error('Error loading config:', error)
    }
  }

  const handleSaveConfig = async () => {
    setLoading(true)
    try {
      await paymentsApi.updateConfig(config)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error saving config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (id, newStatus) => {
    try {
      await paymentsApi.updateStatus(id, newStatus)
      loadPayments()
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const totalPendiente = payments.filter(p => p.estado === 'pendiente').reduce((sum, p) => sum + p.monto, 0)
  const totalCompletado = payments.filter(p => ['completado', 'pagado'].includes(p.estado)).reduce((sum, p) => sum + p.monto, 0)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
          <p className="text-gray-500 mt-1">Gestiona los pagos y configura proveedores</p>
        </div>
        <Button
          variant={showConfig ? 'primary' : 'secondary'}
          icon={Settings}
          onClick={() => setShowConfig(!showConfig)}
        >
          {showConfig ? 'Ver Pagos' : 'Configurar'}
        </Button>
      </div>

      {saved && (
        <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700">
          <CheckCircle className="h-5 w-5" />
          <span>Configuración guardada correctamente</span>
        </div>
      )}

      {showConfig ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Proveedor de Pagos" icon={CreditCard}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proveedor activo
                </label>
                <select
                  value={config.payment_provider}
                  onChange={(e) => setConfig({ ...config, payment_provider: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="none">Sin proveedor (Simulación)</option>
                  <option value="stripe">Stripe</option>
                  <option value="mercadopago">MercadoPago</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Moneda
                </label>
                <select
                  value={config.payment_currency}
                  onChange={(e) => setConfig({ ...config, payment_currency: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="MXN">MXN - Peso Mexicano</option>
                  <option value="USD">USD - Dólar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="ARS">ARS - Peso Argentino</option>
                  <option value="COP">COP - Peso Colombiano</option>
                </select>
              </div>
            </div>
          </Card>

          <Card title="Credenciales">
            <div className="space-y-4">
              {(config.payment_provider === 'stripe' || config.payment_provider === 'none') && (
                <Input
                  label="Stripe Secret Key"
                  type="password"
                  placeholder="sk_live_..."
                  value={config.stripe_secret_key}
                  onChange={(e) => setConfig({ ...config, stripe_secret_key: e.target.value })}
                  helperText="Tu clave secreta de Stripe (empieza con sk_)"
                />
              )}

              {(config.payment_provider === 'mercadopago' || config.payment_provider === 'none') && (
                <Input
                  label="MercadoPago Access Token"
                  type="password"
                  placeholder="APP_USR-..."
                  value={config.mercadopago_access_token}
                  onChange={(e) => setConfig({ ...config, mercadopago_access_token: e.target.value })}
                  helperText="Tu token de acceso de MercadoPago"
                />
              )}

              <div className="pt-4">
                <Button onClick={handleSaveConfig} loading={loading} className="w-full">
                  Guardar Configuración
                </Button>
              </div>
            </div>
          </Card>

          <Card title="¿Cómo funciona?" className="lg:col-span-2">
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">1. Cliente pide pagar</h4>
                <p className="text-blue-700">
                  "Quiero pagar el corte de cabello"
                </p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-lg">
                <h4 className="font-semibold text-emerald-900 mb-2">2. IA genera link</h4>
                <p className="text-emerald-700">
                  Se crea un link de pago con el proveedor configurado
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="font-semibold text-purple-900 mb-2">3. Cliente paga</h4>
                <p className="text-purple-700">
                  El pago se registra y actualiza el estado automáticamente
                </p>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
              <h3 className="font-semibold text-blue-900">Total Pagos</h3>
              <p className="text-3xl font-bold text-blue-600 mt-2">{payments.length}</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-100">
              <h3 className="font-semibold text-yellow-900">Pendientes</h3>
              <p className="text-3xl font-bold text-yellow-600 mt-2">
                ${totalPendiente.toFixed(2)}
              </p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-100">
              <h3 className="font-semibold text-emerald-900">Completados</h3>
              <p className="text-3xl font-bold text-emerald-600 mt-2">
                ${totalCompletado.toFixed(2)}
              </p>
            </div>
          </div>

          <Card title="Historial de Pagos" icon={CreditCard}>
            <div className="space-y-4">
              {payments.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No hay pagos registrados
                </p>
              ) : (
                payments.map((payment) => {
                  const statusStyle = STATUS_STYLES[payment.estado] || STATUS_STYLES.pendiente
                  const StatusIcon = statusStyle.icon
                  
                  return (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-white rounded-lg shadow-sm">
                          <CreditCard className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{payment.servicio}</h4>
                          <p className="text-sm text-gray-500">
                            {payment.telefono} • {payment.fecha}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-gray-900">
                          ${payment.monto} {payment.moneda}
                        </span>
                        
                        <select
                          value={payment.estado}
                          onChange={(e) => handleStatusChange(payment.id, e.target.value)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text} border-0 cursor-pointer`}
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="pagado">Pagado</option>
                          <option value="cancelado">Cancelado</option>
                        </select>

                        {payment.url && (
                          <a
                            href={payment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-emerald-600 rounded-lg"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
