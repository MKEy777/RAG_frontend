import client from './client'

export interface GraphNode {
  name: string
  type: string
  description: string
  frequency: number
  degree: number
}

export interface GraphEdge {
  source: string
  target: string
  description: string
  weight: number
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
  limit = 300
): Promise<GraphData> {
  const { data } = await client.get(`/graph/${kbId}`, {
    params: { limit },
  })
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
