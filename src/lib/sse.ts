import { EventSourcePolyfill } from 'event-source-polyfill'
import { getAccessToken } from './auth'
import { API_BASE_URL } from '../api/config'

export async function openRunStream(
  runId: number,
  onMessage: (e: MessageEvent) => void,
  onError?: (e: Event) => void
): Promise<EventSourcePolyfill> {
  const token = await getAccessToken()
  if (!token) throw new Error('No auth token available')

  const es = new EventSourcePolyfill(`${API_BASE_URL}/runs/${runId}/stream`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    withCredentials: false,
  })

  es.onmessage = onMessage
  es.onerror = (e) => {
    console.error('SSE error', e)
    if (onError) onError(e)
    es.close()
  }

  return es
}

export async function openAssistantStream(
  prompt: string,
  model: string | undefined,
  onMessage: (e: MessageEvent) => void,
  onError?: (e: Event) => void
): Promise<EventSourcePolyfill | null> {
  const token = await getAccessToken()
  if (!token) throw new Error('No auth token available')

  // EventSourcePolyfill doesn't support POST bodies directly; use fetch with ReadableStream
  // Return null for now; caller should use fetch-based approach
  return null
}

