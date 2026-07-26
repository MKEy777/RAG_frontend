import client from './client'

export async function createSession(kbIds: string[]): Promise<{ id: string }> {
  const { data } = await client.post('/chat/sessions', { kb_ids: kbIds })
  return data
}
