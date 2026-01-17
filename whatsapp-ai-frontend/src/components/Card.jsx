export default function Card({ title, description, icon: Icon, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      {(title || Icon) && (
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Icon className="h-5 w-5 text-emerald-600" />
              </div>
            )}
            <div>
              {title && <h3 className="font-semibold text-gray-900">{title}</h3>}
              {description && <p className="text-sm text-gray-500">{description}</p>}
            </div>
          </div>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  )
}
