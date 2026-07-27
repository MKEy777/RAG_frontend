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
  faq_hits: RetrievalHit[]
  request_id?: string
}

export async function retrieve(
  params: RetrievalRequest
): Promise<RetrievalResponse> {
  const { data } = await client.post('/retrieval', params)
  return data
}
