import { Link } from 'react-router-dom'
import { ChevronRight, ArrowUpRight } from 'lucide-react'

export default function StatCard({ 
  name, 
  value, 
  icon: Icon, 
  gradient = 'from-blue-500 to-blue-600', 
  link,
  loading = false,
  subtitle = 'Activo'
}) {
  const content = (
    <>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-500">{name}</p>
          <p className="text-3xl font-bold text-gray-900">
            {loading ? (
              <span className="inline-block w-16 h-8 bg-gray-100 rounded animate-pulse" />
            ) : (
              typeof value === 'number' ? value.toLocaleString() : value
            )}
          </p>
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        )}
      </div>
      {subtitle && (
        <div className="mt-3 flex items-center gap-1 text-sm">
          <ArrowUpRight className="h-4 w-4 text-indigo-500" />
          <span className="text-indigo-600">{subtitle}</span>
        </div>
      )}
      {link && (
        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </>
  )

  const className = "group relative bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:border-gray-200 transition-all duration-200"

  if (link) {
    return <Link to={link} className={className}>{content}</Link>
  }

  return <div className={className}>{content}</div>
}
