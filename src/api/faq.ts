import client from './client'

export interface FaqItem {
  faq_id: string
  question: string
  similar_questions: string[]
  answer: string
  tags: string[]
}

export interface FaqItemCreate {
  question: string
  similar_questions: string[]
  answer: string
  negative_questions: string[]
  tags: string[]
}

export async function listFaqItems(
  kbId: string
): Promise<{ items: FaqItem[]; total: number }> {
  const { data } = await client.get(`/faq/${kbId}/items`)
  return data
}

export async function importFaqItem(
  kbId: string,
  body: FaqItemCreate
): Promise<{ faq_id: string; chunk_count: number }> {
  const { data } = await client.post(`/faq/${kbId}/items`, body)
  return data
}

export async function deleteFaqItem(kbId: string, faqId: string): Promise<void> {
  await client.delete(`/faq/${kbId}/items/${faqId}`)
}

export interface FaqBatchResult {
  valid: number
  errors: { index: number; error: string }[]
  imported: number
}

export async function importFaqBatch(
  kbId: string,
  items: FaqItemCreate[],
  dryRun = false
): Promise<FaqBatchResult> {
  const { data } = await client.post(`/faq/${kbId}/items/batch`, {
    items,
    dry_run: dryRun,
  })
  return data
}

export async function exportFaq(kbId: string): Promise<void> {
  const { data } = await client.get(`/faq/${kbId}/export`, { responseType: 'blob' })
  const url = URL.createObjectURL(data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `faq-${kbId}.json`
  a.click()
  URL.revokeObjectURL(url)
}
