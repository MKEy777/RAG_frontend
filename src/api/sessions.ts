import client from './client'

export async function createSession(kbIds: string[]): Promise<{ id: string }> {
  const { data } = await client.post('/chat/sessions', { kb_ids: kbIds })
  return data
}

export interface SessionInfo {
  id: string
  title: string
  kb_ids: string[]
  updated_at: string
}

export interface SessionMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  references?: unknown[]
}

export async function listSessions(): Promise<{ sessions: SessionInfo[] }> {
  const { data } = await client.get('/chat/sessions')
  return data
}

export async function listMessages(sessionId: string): Promise<{ messages: SessionMessage[] }> {
  const { data } = await client.get(`/chat/sessions/${sessionId}/messages`)
  return data
}

export async function deleteSession(sessionId: string): Promise<void> {
  await client.delete(`/chat/sessions/${sessionId}`)
}

export async function updateSession(sessionId: string, payload: { title?: string }): Promise<void> {
  await client.patch(`/chat/sessions/${sessionId}`, payload)
}
