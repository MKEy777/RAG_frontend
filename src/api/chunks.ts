import client from './client'
import type { PaginatedResponse } from './knowledgeBase'

export interface Chunk {
  id: string
  content: string
  chunk_type: string
  parent_chunk_id: string | null
  start_at: number | null
  end_at: number | null
  created_at: string | null
}

export async function listChunks(
  docId: string,
  page = 1,
  size = 20,
  chunkType?: string
): Promise<PaginatedResponse<Chunk>> {
  const params: Record<string, string | number> = { page, size }
  if (chunkType) params.chunk_type = chunkType
  const { data } = await client.get(`/documents/${docId}/chunks`, { params })
  return data
}

export async function getDocumentContent(docId: string): Promise<{ doc_id: string; content: string; length: number }> {
  const { data } = await client.get(`/documents/${docId}/content`)
  return data
}

export async function updateChunk(docId: string, chunkId: string, content: string): Promise<void> {
  await client.put(`/documents/${docId}/chunks/${chunkId}`, { content })
}

export async function deleteChunk(docId: string, chunkId: string): Promise<void> {
  await client.delete(`/documents/${docId}/chunks/${chunkId}`)
}
