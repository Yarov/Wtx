import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle, Loader2, Bot, MessageSquare, Zap,
  Smartphone, BarChart3, ArrowRight
} from 'lucide-react'

const FEATURES = [
  { icon: MessageSquare, title: 'Agente con IA', desc: 'Atiende 24/7 en español' },
  { icon: Smartphone, title: 'Multi-número', desc: 'Un agente por cada WhatsApp' },
  { icon: BarChart3, title: 'CRM + Reportes', desc: 'Clientes y métricas en vivo' },
  { icon: Zap, title: 'Campañas', desc: 'Mensajería masiva' },
]

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(username, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-900 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-black/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-white/5 to-transparent rounded-full blur-2xl" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Bot className="h-7 w-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Wtx</span>
          </div>
          <p className="text-violet-100 text-sm">Agente de WhatsApp con IA</p>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Tu WhatsApp<br />responde solo
            </h1>
            <p className="text-violet-100 text-lg">
              Un agente de IA atiende a tus clientes en todos tus números, 24/7, mientras tú haces crecer tu negocio.
            </p>
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-2 gap-4">
            {FEATURES.map((feature, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <feature.icon className="h-6 w-6 text-white mb-2" />
                <h3 className="text-white font-semibold text-sm">{feature.title}</h3>
                <p className="text-violet-100 text-xs">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-violet-100 text-sm">
            Conecta <span className="text-white font-semibold">todos tus números</span> de WhatsApp en una sola cuenta.
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-5 py-8 sm:p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl flex items-center justify-center">
              <Bot className="h-7 w-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">Wtx</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Bienvenido de vuelta</h2>
            <p className="text-gray-500">Ingresa tus credenciales para continuar</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                placeholder="tu_usuario"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white py-3.5 rounded-xl font-semibold hover:from-violet-600 hover:to-fuchsia-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-violet-500/30"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Ingresando...
                </>
              ) : (
                <>
                  Ingresar
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-600">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="text-violet-600 hover:text-fuchsia-600 font-semibold">
                Crear cuenta gratis
              </Link>
            </p>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="flex items-center justify-center text-gray-400">
              <div className="text-xs">Wtx v3.0</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
