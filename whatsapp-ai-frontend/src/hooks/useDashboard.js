import { useState, useEffect, useCallback } from 'react'
import { statsApi, toolsApi, whatsappApi, contactosApi, campanasApi } from '../api/client'

const initialStats = {
  totalConversations: 0,
  totalAppointments: 0,
  totalProducts: 0,
  totalMessages: 0,
}

const initialSystemStatus = {
  agent: { status: 'loading', label: 'Cargando...' },
  whatsapp: { status: 'loading', label: 'Cargando...' },
  database: { status: 'online', label: 'Operativa' },
}

export default function useDashboard() {
  const [stats, setStats] = useState(initialStats)
  const [contactStats, setContactStats] = useState({ total: 0, activos: 0 })
  const [campaignStats, setCampaignStats] = useState({ total: 0, enviando: 0 })
  const [systemStatus, setSystemStatus] = useState(initialSystemStatus)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [statsRes, agentRes, contactRes, campaignRes] = await Promise.allSettled([
        statsApi.getDashboard(),
        toolsApi.getAgentStatus(),
        contactosApi.stats(),
        campanasApi.stats(),
      ])

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data)
      }

      if (contactRes.status === 'fulfilled') {
        setContactStats(contactRes.value.data)
      }

      if (campaignRes.status === 'fulfilled') {
        setCampaignStats(campaignRes.value.data)
      }

      // Agent status
      const agentEnabled = agentRes.status === 'fulfilled' && agentRes.value.data?.enabled
      setSystemStatus(prev => ({
        ...prev,
        agent: agentEnabled 
          ? { status: 'online', label: 'Activo' } 
          : { status: 'offline', label: 'Desactivado' },
      }))

      // WhatsApp connection
      try {
        const waRes = await whatsappApi.testConnection()
        setSystemStatus(prev => ({
          ...prev,
          whatsapp: waRes.data?.success 
            ? { status: 'online', label: 'Conectado' } 
            : { status: 'offline', label: 'Desconectado' }
        }))
      } catch {
        setSystemStatus(prev => ({
          ...prev,
          whatsapp: { status: 'warning', label: 'Sin configurar' }
        }))
      }
    } catch (err) {
      console.error('Error loading dashboard:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  return {
    stats,
    contactStats,
    campaignStats,
    systemStatus,
    loading,
    error,
    refresh: loadData,
  }
}
