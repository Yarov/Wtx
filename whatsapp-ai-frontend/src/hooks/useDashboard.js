import { useState, useEffect, useCallback } from 'react'
import { dashboardApi, toolsApi, whatsappApi } from '../api/client'

const initialStats = {
  messages: { total: 0, today: 0, yesterday: 0, trend: 0 },
  appointments: { total: 0, today: 0 },
  contacts: { total: 0, new_this_week: 0 },
  products: { total: 0 },
  response_rate: { value: 0, trend: 0 },
}

const initialSystemStatus = {
  agent: { status: 'loading', label: 'Cargando...' },
  whatsapp: { status: 'loading', label: 'Cargando...' },
}

export default function useDashboard() {
  const [stats, setStats] = useState(initialStats)
  const [conversations, setConversations] = useState([])
  const [alerts, setAlerts] = useState([])
  const [insights, setInsights] = useState([])
  const [systemStatus, setSystemStatus] = useState(initialSystemStatus)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  const loadData = useCallback(async (isManualRefresh = false) => {
    // Only show loading on initial load, not on refreshes
    if (!initialLoadDone) {
      setLoading(true)
    }
    if (isManualRefresh) {
      setRefreshing(true)
    }
    setError(null)

    try {
      const [statsRes, activityRes, alertsRes, insightsRes, agentRes] = await Promise.allSettled([
        dashboardApi.getStats(),
        dashboardApi.getActivity(15),
        dashboardApi.getAlerts(),
        dashboardApi.getInsights(),
        toolsApi.getAgentStatus(),
      ])

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data)
      }

      if (activityRes.status === 'fulfilled') {
        setConversations(activityRes.value.data.conversations || [])
      }

      if (alertsRes.status === 'fulfilled') {
        setAlerts(alertsRes.value.data.alerts || [])
      }

      if (insightsRes.status === 'fulfilled') {
        setInsights(insightsRes.value.data.insights || [])
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
      setRefreshing(false)
      setInitialLoadDone(true)
    }
  }, [initialLoadDone])

  useEffect(() => {
    loadData()
    // Auto-refresh every 30 seconds (silent updates)
    const interval = setInterval(() => loadData(false), 30000)
    return () => clearInterval(interval)
  }, [loadData])

  return {
    stats,
    conversations,
    alerts,
    insights,
    systemStatus,
    loading,
    refreshing,
    error,
    refresh: () => loadData(true),
  }
}
