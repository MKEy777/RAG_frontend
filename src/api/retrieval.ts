import client from './client'

export interface RetrievalRequest {
  kb_ids: string[]
  query: string
  top_k?: number
  enable_graph?: boolean
  enable_wiki_boost?: boolean
  enable_rerank?: boolean
  expand_parent?: boolean
  recall_top_k?: number
  vector_threshold?: number
  keyword_threshold?: number
  rrf_k?: number
  vector_weight?: number
  keyword_weight?: number
  rerank_threshold?: number
  wiki_boost?: number
  search_mode?: 'hybrid' | 'vector' | 'fulltext'
  save_history?: boolean
}

export interface RetrievalHit {
  chunk_id: string
  score: number
  channel: string
  chunk_type: string
  title_path: string
  document_id: string
  content: string
}

export interface RetrievalResponse {
  hits: RetrievalHit[]
}

export async function retrieve(
  params: RetrievalRequest
): Promise<RetrievalResponse> {
  const { data } = await client.post('/retrieval', params)
  return data
}

export interface RetrievalHistoryItem {
  id: string
  kb_ids: string[]
  query: string
  params_snapshot: Record<string, unknown>
  hit_count: number
  top_score: number
  duration_ms: number
  created_at: string
}

export async function listRetrievalHistory(
  kbId?: string,
  page = 1,
  size = 20
): Promise<{ items: RetrievalHistoryItem[]; total: number; page: number; size: number }> {
  const { data } = await client.get('/retrieval/history', {
    params: { kb_id: kbId, page, size },
  })
  return data
}

export async function deleteRetrievalHistory(testId: string): Promise<void> {
  await client.delete(`/retrieval/history/${testId}`)
}
