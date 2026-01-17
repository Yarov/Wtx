import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

export function Input({ label, type = 'text', placeholder, value, onChange, helperText, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
        {...props}
      />
      {helperText && (
        <p className="text-xs text-gray-500">{helperText}</p>
      )}
    </div>
  )
}

export function SecretInput({ label, placeholder, value, onChange, helperText, ...props }) {
  const [show, setShow] = useState(false)
  
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors font-mono"
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      {helperText && (
        <p className="text-xs text-gray-500">{helperText}</p>
      )}
    </div>
  )
}

export function Textarea({ label, placeholder, value, onChange, rows = 4, helperText, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        rows={rows}
        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-none"
        {...props}
      />
      {helperText && (
        <p className="text-xs text-gray-500">{helperText}</p>
      )}
    </div>
  )
}
