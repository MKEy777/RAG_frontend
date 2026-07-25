import client from './client'
import type { PaginatedResponse } from './knowledgeBase'

export interface Document {
  id: string
  knowledge_base_id: string
  title: string | null
  file_name: string | null
  parse_status: string
}

export interface DocumentStatus {
  doc_id: string
  parse_status: string
  progress: {
    stage: string
    percent: number
  }
  error_message: string | null
}

export async function listDocuments(
  kbId: string,
  page = 1,
  size = 20
): Promise<PaginatedResponse<Document>> {
  const { data } = await client.get('/documents', {
    params: { kb_id: kbId, page, size },
  })
  return data
}

export async function getDocument(id: string): Promise<Document> {
  const { data } = await client.get(`/documents/${id}`)
  return data
}

export async function getDocumentStatus(id: string): Promise<DocumentStatus> {
  const { data } = await client.get(`/documents/${id}/status`)
  return data
}

export async function uploadDocument(
  kbId: string,
  file: File
): Promise<Document> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await client.post(
    `/documents/upload?kb_id=${kbId}`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  )
  return data
}

export async function deleteDocument(id: string): Promise<void> {
  await client.delete(`/documents/${id}`)
}
