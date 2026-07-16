import { useEffect } from 'react'
import { connectWebSocket, disconnectWebSocket } from '../services/websocketService'

export function useRealtime(onUpdate, onAgmNewTasks) {
  useEffect(() => {
    connectWebSocket(onUpdate, onAgmNewTasks)
    return () => disconnectWebSocket()
  }, [])
}
