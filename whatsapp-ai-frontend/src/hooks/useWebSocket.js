import { useEffect, useRef, useCallback, useState } from 'react'

// Connection states
export const WS_STATE = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
}

// Exponential backoff config
const BACKOFF_BASE = 1000     // 1 second
const BACKOFF_MAX = 30000     // 30 seconds
const BACKOFF_FACTOR = 2

/**
 * Hook para conectar al WebSocket del backend con JWT auth, heartbeat y auto-reconnect.
 * @param {function} onMessage - Callback cuando llega un evento: (event, data) => void
 */
export default function useWebSocket(onMessage) {
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const attemptRef = useRef(0)
  const [connectionState, setConnectionState] = useState(WS_STATE.DISCONNECTED)
  const onMessageRef = useRef(onMessage)

  // Keep ref updated without re-creating the effect
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])

  const connect = useCallback(() => {
    // Clean up previous connection
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    // Get JWT token from localStorage (same as api/client.js)
    const token = localStorage.getItem('token')
    if (!token) {
      setConnectionState(WS_STATE.ERROR)
      // Retry later in case user logs in
      reconnectTimer.current = setTimeout(connect, 5000)
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const url = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`

    setConnectionState(WS_STATE.CONNECTING)

    try {
      const ws = new WebSocket(url)

      ws.onopen = () => {
        setConnectionState(WS_STATE.CONNECTED)
        attemptRef.current = 0 // Reset backoff on successful connection
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current)
          reconnectTimer.current = null
        }
      }

      ws.onmessage = (evt) => {
        try {
          const { event, data } = JSON.parse(evt.data)
          // Respond to server heartbeat pings
          if (event === 'ping') {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ event: 'pong' }))
            }
            return
          }
          if (onMessageRef.current) onMessageRef.current(event, data)
        } catch (e) {
          // Ignore malformed messages
        }
      }

      ws.onclose = (evt) => {
        setConnectionState(WS_STATE.DISCONNECTED)
        wsRef.current = null

        // If closed with 4001 (auth error), don't reconnect - redirect to login
        if (evt.code === 4001) {
          localStorage.removeItem('token')
          window.location.href = '/login'
          return
        }

        // Exponential backoff reconnect
        const delay = Math.min(
          BACKOFF_BASE * Math.pow(BACKOFF_FACTOR, attemptRef.current),
          BACKOFF_MAX
        )
        attemptRef.current += 1
        reconnectTimer.current = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        setConnectionState(WS_STATE.ERROR)
        ws.close()
      }

      wsRef.current = ws
    } catch (e) {
      setConnectionState(WS_STATE.ERROR)
      const delay = Math.min(
        BACKOFF_BASE * Math.pow(BACKOFF_FACTOR, attemptRef.current),
        BACKOFF_MAX
      )
      attemptRef.current += 1
      reconnectTimer.current = setTimeout(connect, delay)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [connect])

  return {
    connected: connectionState === WS_STATE.CONNECTED,
    connectionState,
  }
}
