import client from './client'
import type { PaginatedResponse } from './knowledgeBase'

export interface Document {
  id: string
  knowledge_base_id: string
  title: string | null
  file_name: string | null
  parse_status: string
  needs_images?: boolean
  file_size?: number | null
  file_type?: string | null
  file_hash?: string | null
  graph_status?: string | null
  wiki_status?: string | null
  error_message?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface DocumentStatus {
  doc_id: string
  parse_status: string
  graph_status: string | null
  wiki_status: string | null
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
  file: File,
  displayName?: string
): Promise<Document> {
  const formData = new FormData()
  formData.append('file', file)
  if (displayName) formData.append('display_name', displayName)
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

export async function renameDocument(id: string, title: string): Promise<Document> {
  const { data } = await client.patch(`/documents/${id}`, { title })
  return data
}

export async function reparseDocument(id: string): Promise<void> {
  await client.post(`/documents/${id}/reparse`)
}

export function documentDownloadUrl(id: string): string {
  return `/api/v1/documents/${id}/download`
}

export async function importLocalDocument(
  kbId: string,
  filePath: string
): Promise<Document> {
  const { data } = await client.post('/documents/import-local', {
    kb_id: kbId,
    file_path: filePath,
  })
  return data
}
