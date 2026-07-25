import client from './client'

export interface RetrievalRequest {
  kb_ids: string[]
  query: string
  top_k?: number
  enable_graph?: boolean
  enable_wiki_boost?: boolean
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
