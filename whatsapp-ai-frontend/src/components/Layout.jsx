import { Outlet, NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Key, 
  Wrench, 
  MessageSquare, 
  Package, 
  Calendar,
  Clock,
  MessagesSquare,
  CreditCard,
  Bot,
  Settings
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'API Keys', href: '/api-keys', icon: Key },
  { name: 'Tools', href: '/tools', icon: Wrench },
  { name: 'Prompt', href: '/prompt', icon: MessageSquare },
  { name: 'Inventario', href: '/inventory', icon: Package },
  { name: 'Citas', href: '/appointments', icon: Calendar },
  { name: 'Horarios', href: '/schedule', icon: Clock },
  { name: 'Conversaciones', href: '/conversations', icon: MessagesSquare },
  { name: 'Pagos', href: '/payments', icon: CreditCard },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-gray-900">
        <div className="flex h-16 items-center gap-3 px-6 border-b border-gray-800">
          <Bot className="h-8 w-8 text-emerald-500" />
          <span className="text-xl font-bold text-white">WhatsApp AI</span>
        </div>
        
        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 px-3 py-2 text-gray-400">
            <Settings className="h-5 w-5" />
            <span className="text-sm">v1.0.0</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="pl-64">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
