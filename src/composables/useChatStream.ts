import { ref } from 'vue'
import { streamChat } from '@/api/chat'
import { useChatStore, type ChatSession } from '@/stores/chat'

const HISTORY_LIMIT = 20

export function useChatStream() {
  const store = useChatStore()
  const isStreaming = ref(false)
  let controller: AbortController | null = null
  let generation = 0

  const send = async (session: ChatSession, query: string) => {
    const gen = ++generation

    if (!session.serverSessionId) {
      try {
        const { createSession } = await import('@/api/sessions')
        session.serverSessionId = (await createSession(session.kbIds)).id
      } catch {
        // 后端会话不可用时退回无状态模式
      }
    }

    const history = session.messages
      .filter((m) => m.complete && !m.error)
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: m.content }))

    session.messages.push({ role: 'user', content: query, complete: true })
    session.messages.push({ role: 'assistant', content: '', complete: false })
    const msg = session.messages[session.messages.length - 1]
    if (session.title === '新对话') session.title = query.slice(0, 30)
    store.touch(session)
    store.persist()

    isStreaming.value = true
    controller = new AbortController()
    try {
      await streamChat(
        {
          kb_ids: session.kbIds,
          query,
          history,
          enable_wiki_boost: session.enableWikiBoost,
          session_id: session.serverSessionId ?? null,
        },
        {
          onToken: (token) => {
            if (gen === generation) msg.content += token
          },
          onReferences: (references) => {
            if (gen === generation) msg.references = references
          },
          onSuggestions: (items) => {
            if (gen === generation) msg.suggestions = items
          },
          onDone: () => {
            if (gen === generation) msg.complete = true
          },
          onError: (message) => {
            if (gen === generation) msg.error = message
          },
        },
        controller.signal
      )
    } catch (e) {
      if (gen === generation && !msg.complete) {
        const aborted = (e as Error).name === 'AbortError'
        if (!aborted) msg.error = (e as Error).message || '请求失败'
      }
    } finally {
      if (gen === generation) {
        msg.complete = true
        isStreaming.value = false
        store.touch(session)
        store.persist(true)
      }
    }
  }

  const stop = () => {
    controller?.abort()
    controller = null
  }

  return { isStreaming, send, stop }
}
