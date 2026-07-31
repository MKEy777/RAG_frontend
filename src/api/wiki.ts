import client from './client'
import type { PaginatedResponse } from './knowledgeBase'

export interface WikiPageSummary {
  page_id: string
  title: string
  slug: string
  kind: string
  summary: string | null
  status: string
  version: number
  folder_id: string | null
  updated_at: string | null
}

export interface WikiPageDetail extends WikiPageSummary {
  content: string | null
  source_refs: string[] | null
  out_links: string[] | null
  in_links: string[] | null
  aliases: string[] | null
}

export interface WikiStatus {
  page_count: number
  pending_count: number
  total_operations: number
  completed_operations: number
  building: boolean
  last_updated: string | null
}

export interface WikiIndexFolder {
  id: string
  name: string
  parent_id: string | null
  page_count: number
}

export interface WikiIndexGroup {
  type: string
  total: number
  items: { slug: string; title: string; summary: string; folder_id: string | null }[]
}

export interface WikiGraphNode {
  id: string
  name: string
  kind: string
}

export interface WikiGraphEdge {
  source: string
  target: string
}

export interface WikiIndexPayload {
  intro: string
  overview: string
  groups: WikiIndexGroup[]
  folders: WikiIndexFolder[]
  graph: { nodes: WikiGraphNode[]; edges: WikiGraphEdge[] }
}

export async function listWikiPages(
  kbId: string,
  page = 1,
  size = 20
): Promise<PaginatedResponse<WikiPageSummary>> {
  const { data } = await client.get(`/wiki/${kbId}/pages`, {
    params: { page, size },
  })
  return data
}

export async function getWikiPage(
  kbId: string,
  pageId: string
): Promise<WikiPageDetail> {
  const { data } = await client.get(`/wiki/${kbId}/pages/${pageId}`)
  return data
}

export async function buildWiki(kbId: string): Promise<{ status: string }> {
  const { data } = await client.post(`/wiki/${kbId}/build`)
  return data
}

export async function getWikiStatus(kbId: string): Promise<WikiStatus> {
  const { data } = await client.get(`/wiki/${kbId}/status`)
  return data
}

export async function getWikiIndex(kbId: string): Promise<WikiIndexPayload> {
  const { data } = await client.get(`/wiki/${kbId}/index`)
  return data
}

export interface WikiFaqQuestion {
  id: string
  question: string
  source_chunk_id: string | null
}

export interface WikiFaqGroup {
  knowledge_id: string
  title: string
  questions: WikiFaqQuestion[]
}

export async function listWikiFaq(
  kbId: string
): Promise<{ groups: WikiFaqGroup[]; total: number }> {
  const { data } = await client.get(`/wiki/${kbId}/faq`)
  return data
}

export async function updateWikiPage(
  kbId: string,
  pageId: string,
  body: { title?: string; content?: string; folder_id?: string }
): Promise<{ status: string; version: number }> {
  const { data } = await client.put(`/wiki/${kbId}/pages/${pageId}`, body)
  return data
}

export async function clearWikiPages(kbId: string): Promise<{ status: string; deleted: number }> {
  const { data } = await client.delete(`/wiki/${kbId}/pages`)
  return data
}

export interface WikiFolder {
  id: string
  name: string
  parent_id: string | null
}

export async function listWikiFolders(kbId: string): Promise<{ folders: WikiFolder[] }> {
  const { data } = await client.get(`/wiki/${kbId}/folders`)
  return data
}

export async function createWikiFolder(
  kbId: string,
  body: { name: string; parent_id?: string }
): Promise<WikiFolder> {
  const { data } = await client.post(`/wiki/${kbId}/folders`, body)
  return data
}

export async function deleteWikiFolder(kbId: string, folderId: string): Promise<void> {
  await client.delete(`/wiki/${kbId}/folders/${folderId}`)
}
