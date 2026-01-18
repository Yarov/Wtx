import { Link } from 'react-router-dom'

export default function QuickAction({ name, icon: Icon, link, color = 'text-gray-600 bg-gray-50 hover:bg-gray-100' }) {
  return (
    <Link 
      to={link} 
      className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-colors ${color}`}
    >
      {Icon && <Icon className="h-6 w-6" />}
      <span className="text-sm font-medium text-center">{name}</span>
    </Link>
  )
}
