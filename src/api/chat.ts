import { fetchEventSource } from '@microsoft/fetch-event-source'
import type { ChatReference } from '@/stores/chat'

export interface ChatParams {
  kb_ids: string[]
  query: string
  history: { role: string; content: string }[]
  enable_wiki_boost: boolean
  session_id?: string | null
}

export interface ChatStreamCallbacks {
  onToken: (token: string) => void
  onReferences: (references: ChatReference[]) => void
  onSuggestions?: (items: string[]) => void
  onDone: () => void
  onError?: (message: string) => void
}

export function streamChat(
  params: ChatParams,
  callbacks: ChatStreamCallbacks,
  signal: AbortSignal
): Promise<void> {
  return fetchEventSource('/api/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, top_k: 10, stream: true }),
    signal,
    openWhenHidden: true,
    async onopen(res) {
      if (res.ok) return
      if (res.status === 429) throw new Error('请求过于频繁，请稍后再试')
      throw new Error(`请求失败 (${res.status})`)
    },
    onmessage(ev) {
      if (ev.event === 'message') {
        callbacks.onToken(JSON.parse(ev.data).content ?? '')
      } else if (ev.event === 'references') {
        callbacks.onReferences(JSON.parse(ev.data).references ?? [])
      } else if (ev.event === 'suggestions') {
        callbacks.onSuggestions?.(JSON.parse(ev.data).suggestions ?? [])
      } else if (ev.event === 'error') {
        callbacks.onError?.(JSON.parse(ev.data).message ?? '生成中断')
      } else if (ev.event === 'done') {
        callbacks.onDone()
      }
    },
    onerror(err) {
      // 禁止 fetchEventSource 默认无限重连
      throw err
    },
  })
}
