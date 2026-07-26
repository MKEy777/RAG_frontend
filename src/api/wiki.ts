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

export interface WikiIndexPayload {
  intro: string
  groups: WikiIndexGroup[]
  folders: WikiIndexFolder[]
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
