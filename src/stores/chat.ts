import { defineStore } from 'pinia'

export interface ChatReference {
  id: string
  chunk_id: string
  document_id: string
  title_path: string
  score: number
  channel: string
  chunk_type: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  references?: ChatReference[]
  suggestions?: string[]
  via?: 'fastpath' | 'cache'
  complete: boolean
  error?: string
}

export interface ChatSession {
  id: string
  title: string
  kbIds: string[]
  enableWikiBoost: boolean
  enableGraph: boolean
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
  serverSessionId?: string
}

const STORAGE_KEY = 'knowlink_chat_sessions'
const MAX_SESSIONS = 50

function load(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const sessions = raw ? (JSON.parse(raw) as ChatSession[]) : []
    for (const s of sessions) {
      const last = s.messages[s.messages.length - 1]
      if (last && !last.complete) {
        last.complete = true
        last.content += '\n\n(已中断)'
      }
    }
    return sessions
  } catch {
    return []
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null

export const useChatStore = defineStore('chat', {
  state: () => ({
    sessions: load(),
    activeId: '',
  }),
  getters: {
    active(state): ChatSession | undefined {
      return state.sessions.find((s) => s.id === state.activeId)
    },
    sorted(state): ChatSession[] {
      return [...state.sessions].sort((a, b) => b.updatedAt - a.updatedAt)
    },
  },
  actions: {
    createSession(kbIds: string[], enableWikiBoost: boolean, enableGraph = false): ChatSession {
      const now = Date.now()
      const session: ChatSession = {
        id: crypto.randomUUID(),
        title: '新对话',
        kbIds,
        enableWikiBoost,
        enableGraph,
        createdAt: now,
        updatedAt: now,
        messages: [],
      }
      this.sessions.push(session)
      if (this.sessions.length > MAX_SESSIONS) {
        const oldest = [...this.sessions].sort((a, b) => a.updatedAt - b.updatedAt)[0]
        this.sessions = this.sessions.filter((s) => s.id !== oldest.id)
      }
      this.activeId = session.id
      this.persist()
      return session
    },
    removeSession(id: string) {
      this.sessions = this.sessions.filter((s) => s.id !== id)
      if (this.activeId === id) this.activeId = ''
      this.persist(true)
    },
    touch(session: ChatSession) {
      session.updatedAt = Date.now()
    },
    persist(flush = false) {
      if (persistTimer) clearTimeout(persistTimer)
      const write = () => {
        persistTimer = null
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sessions))
      }
      if (flush) write()
      else persistTimer = setTimeout(write, 500)
    },
  },
})
