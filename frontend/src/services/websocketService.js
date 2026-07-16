import { Client } from '@stomp/stompjs'

const WS_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api')
  .replace('/api', '')
  .replace('http', 'ws') + '/ws/websocket'

let client = null

export const connectWebSocket = (onMessage, onAgmMessage) => {
  client = new Client({
    brokerURL: WS_URL,
    reconnectDelay: 5000,
    onConnect: () => {
      client.subscribe('/topic/stores', (msg) => {
        onMessage(JSON.parse(msg.body))
      })
      client.subscribe('/topic/agm', (msg) => {
        onAgmMessage?.(JSON.parse(msg.body))
      })
    },
    onStompError: (frame) => {
      console.warn('STOMP error', frame)
    },
  })
  client.activate()
}

export const disconnectWebSocket = () => {
  client?.deactivate()
}
