import client from './client'

export interface GraphNode {
  name: string
  type: string
  description: string
  frequency: number
  degree: number
  belongs?: boolean
}

export interface GraphEdge {
  source: string
  target: string
  description: string
  weight: number
  belongs?: boolean
}

export interface GraphStats {
  total_entities: number
  total_relations: number
  returned_nodes: number
  truncated: boolean
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: GraphStats
}

export async function getGraph(
  kbId: string,
  limit = 300,
  knowledgeId?: string
): Promise<GraphData> {
  const params: Record<string, unknown> = { limit }
  if (knowledgeId) params.knowledge_id = knowledgeId
  const { data } = await client.get(`/graph/${kbId}`, { params })
  return data
}

export async function rebuildGraph(
  kbId: string
): Promise<{ status: string; documents: number }> {
  const { data } = await client.post(`/graph/${kbId}/rebuild`)
  return data
}

export async function deleteGraph(kbId: string): Promise<void> {
  await client.delete(`/graph/${kbId}`)
}
