import { useState, useEffect, useCallback } from 'react'
import { dashboardApi, toolsApi, whatsappApi } from '../api/client'

export default function useDashboard() {
  const [stats, setStats] = useState({})
  const [hotLeads, setHotLeads] = useState([])
  const [campaigns, setCampaigns] = useState({ activas: [], recientes: [] })
  const [trend, setTrend] = useState([])
  const [alerts, setAlerts] = useState([])
  const [systemStatus, setSystemStatus] = useState({ agent: { status: 'loading' }, whatsapp: { status: 'loading' } })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (!initialLoadDone) setLoading(true)
    if (isManualRefresh) setRefreshing(true)

    try {
      const results = await Promise.allSettled([
        dashboardApi.getStats(),
        dashboardApi.getAlerts(),
        toolsApi.getAgentStatus(),
        dashboardApi.getHotLeads(),
        dashboardApi.getCampaigns(),
        dashboardApi.getTrend(),
      ])

      if (results[0].status === 'fulfilled') setStats(results[0].value.data)
      if (results[1].status === 'fulfilled') setAlerts(results[1].value.data)
      if (results[3].status === 'fulfilled') setHotLeads(results[3].value.data)
      if (results[4].status === 'fulfilled') setCampaigns(results[4].value.data)
      if (results[5].status === 'fulfilled') setTrend(results[5].value.data)

      const agentEnabled = results[2].status === 'fulfilled' && results[2].value.data?.enabled
      setSystemStatus(prev => ({ ...prev, agent: { status: agentEnabled ? 'online' : 'offline' } }))

      try {
        const waRes = await whatsappApi.testConnection()
        setSystemStatus(prev => ({ ...prev, whatsapp: { status: waRes.data?.success ? 'online' : 'offline' } }))
      } catch {
        setSystemStatus(prev => ({ ...prev, whatsapp: { status: 'warning' } }))
      }
    } catch (err) {
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
      setInitialLoadDone(true)
    }
  }, [initialLoadDone])

  useEffect(() => {
    loadData()
    const interval = setInterval(() => loadData(false), 30000)
    return () => clearInterval(interval)
  }, [loadData])

  return { stats, hotLeads, campaigns, trend, alerts, systemStatus, loading, refreshing, refresh: () => loadData(true) }
}
