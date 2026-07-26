import { onUnmounted } from 'vue'
import { getDocumentStatus, type Document, type DocumentStatus } from '@/api/documents'

const POLL_INTERVAL = 3000

export function isBuilding(status: DocumentStatus | null) {
  if (!status) return false
  return (
    status.parse_status === 'processing' ||
    status.graph_status === 'processing' ||
    status.wiki_status === 'processing'
  )
}

interface DocStatusEvent {
  doc_id: string
  parse_status: string
  graph_status: string | null
  wiki_status: string | null
  error_message: string | null
}

// SSE 状态流：单连接替代逐文档轮询，服务端状态变化才推送，全部解析完成自动关流
export function useDocStatusStream(kbId: string, getDocs: () => Document[], refresh: () => void) {
  let es: EventSource | null = null

  const stop = () => {
    es?.close()
    es = null
  }

  const startIfNeeded = () => {
    const hasProcessing = getDocs().some((d) => d.parse_status === 'processing')
    if (!hasProcessing) {
      stop()
      return
    }
    if (es) return
    es = new EventSource(`/api/v1/documents/status/stream?kb_id=${kbId}`)
    es.addEventListener('status', (ev) => {
      const snap = JSON.parse((ev as MessageEvent).data) as DocStatusEvent[]
      const byId = new Map(snap.map((s) => [s.doc_id, s]))
      let settled = false
      for (const doc of getDocs()) {
        const s = byId.get(doc.id)
        if (!s) continue
        if (doc.parse_status === 'processing' && s.parse_status !== 'processing') settled = true
        doc.parse_status = s.parse_status
      }
      if (settled) refresh()
    })
    es.addEventListener('done', stop)
    // 服务端关流/异常均触发 error；禁止 EventSource 默认无限重连
    es.onerror = stop
  }

  onUnmounted(stop)
  return { startIfNeeded, stop }
}

export function useSingleStatusPolling(
  onUpdate: (status: DocumentStatus) => void,
  onSettled?: () => void
) {
  let timer: ReturnType<typeof setInterval> | null = null

  const stop = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  const start = (docId: string) => {
    stop()
    timer = setInterval(async () => {
      try {
        const status = await getDocumentStatus(docId)
        onUpdate(status)
        if (!isBuilding(status)) {
          stop()
          onSettled?.()
        }
      } catch {
        stop()
      }
    }, POLL_INTERVAL)
  }

  onUnmounted(stop)
  return { start, stop }
}
