import { Link } from 'react-router-dom'

export default function SectionHeader({ title, icon: Icon, linkText, linkTo }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        {linkTo && linkText && (
          <Link to={linkTo} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
            {linkText} →
          </Link>
        )}
        {Icon && <Icon className="h-5 w-5 text-gray-400" />}
      </div>
    </div>
  )
}
