import { useEffect } from 'react'
import { connectWebSocket, disconnectWebSocket } from '../services/websocketService'

export function useRealtime(onUpdate) {
  useEffect(() => {
    connectWebSocket(onUpdate)
    return () => disconnectWebSocket()
  }, [])
}
