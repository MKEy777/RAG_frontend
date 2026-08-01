import client from './client'

export interface FastPathEntry {
  id: string
  kb_id: string
  canonical_query: string
  example_queries: string[]
  answer_template: string
  variables: { name: string; description?: string }[]
  target_chunk_id: string | null
  target_document_id: string | null
  status: 'active' | 'draft' | 'disabled' | 'stale'
  source: 'faq' | 'manual' | 'mined'
  source_chunk_id: string | null
  hit_count: number
  last_hit_at: string | null
  created_at: string | null
}

export interface FaqCandidate {
  chunk_id: string
  question: string
  source_chunk_id: string | null
  promoted: boolean
}

export interface CacheEntry {
  id: string
  kb_key: string
  query_text: string
  answer_text: string
  source_chunk_ids: string[]
  expires_at: string | null
  hit_count: number
  created_at: string | null
}

export interface FastPathStats {
  total_hits: number
  by_layer: Record<string, number>
  hit_rate: number
  avg_duration_ms: Record<string, number>
  total_entries: number
  active_entries: number
  cache_entries: number
}

export async function listEntries(kbId: string, status?: string): Promise<{ total: number; items: FastPathEntry[] }> {
  const { data } = await client.get(`/fastpath/${kbId}/entries`, { params: { status } })
  return data
}

export async function createEntry(payload: Partial<FastPathEntry> & { kb_id: string; canonical_query: string }): Promise<FastPathEntry> {
  const { data } = await client.post('/fastpath/entries', payload)
  return data
}

export async function updateEntry(entryId: string, payload: Record<string, unknown>): Promise<FastPathEntry> {
  const { data } = await client.patch(`/fastpath/entries/${entryId}`, payload)
  return data
}

export async function deleteEntry(entryId: string): Promise<{ ok: boolean }> {
  const { data } = await client.delete(`/fastpath/entries/${entryId}`)
  return data
}

export async function activateEntry(entryId: string): Promise<FastPathEntry> {
  const { data } = await client.post(`/fastpath/entries/${entryId}/activate`)
  return data
}

export async function disableEntry(entryId: string): Promise<FastPathEntry> {
  const { data } = await client.post(`/fastpath/entries/${entryId}/disable`)
  return data
}

export async function listFaqCandidates(kbId: string): Promise<{ items: FaqCandidate[] }> {
  const { data } = await client.get(`/fastpath/${kbId}/faq-candidates`)
  return data
}

export async function promoteFaq(kbId: string, chunkIds: string[]): Promise<{ count: number }> {
  const { data } = await client.post(`/fastpath/${kbId}/promote`, { chunk_ids: chunkIds })
  return data
}

export async function mine(kbId: string): Promise<{ created: number }> {
  const { data } = await client.post(`/fastpath/${kbId}/mine`)
  return data
}

export async function getStats(kbId: string): Promise<FastPathStats> {
  const { data } = await client.get(`/fastpath/${kbId}/stats`)
  return data
}

export async function listCache(kbId: string): Promise<{ items: CacheEntry[] }> {
  const { data } = await client.get(`/fastpath/${kbId}/cache`)
  return data
}

export async function deleteCacheEntry(entryId: string): Promise<{ ok: boolean }> {
  const { data } = await client.delete(`/fastpath/cache/${entryId}`)
  return data
}
