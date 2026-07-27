import client from './client'

export interface KnowledgeBase {
  id: string
  name: string
  type: string
  description: string | null
  enable_wiki: boolean
  enable_graph: boolean
  owner?: string
  document_count?: number
  total_size?: number
  updated_at?: string
}

export interface KBUpdateParams {
  name?: string
  description?: string
  enable_wiki?: boolean
  enable_graph?: boolean
}

export interface KBCreateParams {
  name: string
  type?: string
  description?: string
  embedding_model_id?: string
  chunking_config?: Record<string, unknown>
  indexing_strategy?: Record<string, unknown>
  enable_wiki?: boolean
  enable_graph?: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export async function listKnowledgeBases(
  page = 1,
  size = 20
): Promise<PaginatedResponse<KnowledgeBase>> {
  const { data } = await client.get('/knowledge-bases', {
    params: { page, size },
  })
  return data
}

export async function getKnowledgeBase(id: string): Promise<KnowledgeBase> {
  const { data } = await client.get(`/knowledge-bases/${id}`)
  return data
}

export async function createKnowledgeBase(
  params: KBCreateParams
): Promise<KnowledgeBase> {
  const { data } = await client.post('/knowledge-bases', params)
  return data
}

export async function updateKnowledgeBase(
  id: string,
  params: KBUpdateParams
): Promise<KnowledgeBase> {
  const { data } = await client.patch(`/knowledge-bases/${id}`, params)
  return data
}

export async function deleteKnowledgeBase(id: string): Promise<void> {
  await client.delete(`/knowledge-bases/${id}`)
}
