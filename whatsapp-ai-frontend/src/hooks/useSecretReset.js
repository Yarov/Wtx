import { useState, useEffect, useCallback } from 'react'

/**
 * Hook para activar factory reset con combo de teclas secreto
 * Combo: Cmd + K (Mac) / Ctrl + K (Windows/Linux)
 * Solo funciona si isAdmin es true
 * Devuelve [isOpen, setIsOpen] para controlar el modal
 */
export default function useSecretReset(isAdmin = false) {
  const [isOpen, setIsOpen] = useState(false)

  const handleKeyDown = useCallback((e) => {
    // Solo admins pueden activar el reset
    if (!isAdmin) return
    
    // Cmd + K (Mac) / Ctrl + K (Windows/Linux)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      setIsOpen(true)
    }
  }, [isAdmin])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return [isOpen, setIsOpen]
}
