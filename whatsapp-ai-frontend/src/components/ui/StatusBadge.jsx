import { CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react'

const statusConfig = {
  online: { icon: CheckCircle2, color: 'text-indigo-600 bg-indigo-50', iconColor: 'text-indigo-500' },
  offline: { icon: XCircle, color: 'text-red-600 bg-red-50', iconColor: 'text-red-500' },
  warning: { icon: AlertCircle, color: 'text-amber-600 bg-amber-50', iconColor: 'text-amber-500' },
  loading: { icon: Clock, color: 'text-gray-500 bg-gray-50', iconColor: 'text-gray-400' },
}

export default function StatusBadge({ status = 'loading', label }) {
  const config = statusConfig[status] || statusConfig.loading
  const Icon = config.icon
  const isLoading = status === 'loading'

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className={`h-4 w-4 ${config.iconColor} ${isLoading ? 'animate-spin' : ''}`} />
      {label}
    </div>
  )
}
