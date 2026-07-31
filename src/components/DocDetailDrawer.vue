<template>
  <t-drawer
    :visible="visible"
    :header="doc?.file_name || '文档详情'"
    size="560px"
    :footer="false"
    @update:visible="(v: boolean) => emit('update:visible', v)"
    @close="stopPolling"
  >
    <t-tabs v-model="activeTab" class="doc-tabs">
      <t-tab-panel value="info" label="基本信息">
        <t-descriptions :column="1" size="small" class="tab-body">
          <t-descriptions-item label="名称">{{ doc?.title || '-' }}</t-descriptions-item>
          <t-descriptions-item label="文件名">{{ doc?.file_name || '-' }}</t-descriptions-item>
          <t-descriptions-item label="大小">{{ formatSize(doc?.file_size ?? null) }}</t-descriptions-item>
          <t-descriptions-item label="类型">{{ doc?.file_type || '-' }}</t-descriptions-item>
          <t-descriptions-item label="上传时间">{{ formatTime(doc?.created_at ?? null) }}</t-descriptions-item>
          <t-descriptions-item label="哈希">
            <span class="mono">{{ doc?.file_hash?.slice(0, 16) || '-' }}</span>
          </t-descriptions-item>
          <t-descriptions-item label="解析状态">
            <t-tag :theme="statusTheme(doc?.parse_status || '')" variant="light" size="small">
              {{ statusText(doc?.parse_status || '') }}
            </t-tag>
          </t-descriptions-item>
          <t-descriptions-item v-if="doc?.graph_status" label="知识图谱">
            <t-tag :theme="statusTheme(doc.graph_status)" variant="light" size="small">
              {{ statusText(doc.graph_status) }}
            </t-tag>
          </t-descriptions-item>
          <t-descriptions-item v-if="doc?.wiki_status" label="Wiki">
            <t-tag :theme="statusTheme(doc.wiki_status)" variant="light" size="small">
              {{ statusText(doc.wiki_status) }}
            </t-tag>
          </t-descriptions-item>
        </t-descriptions>
        <div v-if="doc?.graph_status === 'completed'" class="info-actions">
          <t-button theme="primary" variant="outline" size="small" @click="gotoGraph">
            在图谱中查看本文档实体
          </t-button>
        </div>
      </t-tab-panel>

      <t-tab-panel value="progress" label="解析进度">
        <div class="tab-body">
          <t-steps :current="stepCurrent" :status="stepStatus" readonly class="progress-steps">
            <t-step-item v-for="s in STAGES" :key="s.key" :title="s.label" />
          </t-steps>
          <t-progress
            v-if="status && status.parse_status === 'processing'"
            :percentage="status.progress.percent"
            class="progress-bar"
          />
          <t-alert
            v-if="status?.error_message"
            theme="error"
            class="progress-error"
          >
            <div class="error-msg">{{ status.error_message }}</div>
          </t-alert>
          <div class="progress-actions">
            <t-button
              v-if="status?.parse_status === 'failed'"
              theme="primary"
              size="small"
              :loading="reparsing"
              @click="handleReparse"
            >
              重试解析
            </t-button>
            <t-button
              v-else-if="status?.parse_status === 'completed'"
              variant="outline"
              size="small"
              :loading="reparsing"
              @click="handleReparse"
            >
              重新解析
            </t-button>
          </div>
        </div>
      </t-tab-panel>

      <t-tab-panel value="chunks" label="文档切片">
        <div class="tab-body">
          <t-loading :loading="chunksLoading" style="min-height: 120px">
            <t-empty v-if="!chunksLoading && chunks.length === 0" description="暂无切片" />
            <div v-else class="chunk-list">
              <div v-for="c in chunks" :key="c.id" class="chunk-item">
                <div class="chunk-meta">
                  <t-tag variant="light" size="small">{{ c.chunk_type }}</t-tag>
                  <span class="chunk-pos">{{ c.start_at ?? '-' }} – {{ c.end_at ?? '-' }}</span>
                </div>
                <div class="chunk-content">{{ c.content }}</div>
              </div>
            </div>
          </t-loading>
          <div class="chunks-footer">
            <span class="chunks-total">共 {{ chunksTotal }} 个切片（显示前 {{ chunks.length }} 个）</span>
            <t-link theme="primary" @click="gotoChunksPage">打开完整切片页 →</t-link>
          </div>
        </div>
      </t-tab-panel>

      <t-tab-panel value="recall" label="召回测试">
        <div class="tab-body">
          <div class="recall-bar">
            <t-input
              v-model="recallQuery"
              placeholder="输入问题，测试本文档能否被召回"
              @enter="handleRecall"
            />
            <t-button theme="primary" :loading="recalling" :disabled="!recallQuery.trim()" @click="handleRecall">
              检索
            </t-button>
          </div>
          <p v-if="recallDone" class="recall-summary">
            共命中 {{ recallHits.length }} 条，其中本文档 {{ ownHitCount }} 条
          </p>
          <div class="recall-list">
            <div
              v-for="(hit, i) in recallHits"
              :key="hit.chunk_id"
              class="recall-item"
              :class="{ own: hit.document_id === doc?.id }"
            >
              <div class="chunk-meta">
                <t-tag :theme="hit.document_id === doc?.id ? 'primary' : 'default'" variant="light" size="small">
                  #{{ i + 1 }}
                </t-tag>
                <t-tag variant="light" size="small">{{ hit.channel }}</t-tag>
                <span class="chunk-pos">score {{ hit.score.toFixed(4) }}</span>
                <t-tag v-if="hit.document_id === doc?.id" theme="success" variant="light" size="small">本文档</t-tag>
              </div>
              <div class="chunk-content">{{ hit.content }}</div>
            </div>
          </div>
        </div>
      </t-tab-panel>
    </t-tabs>
  </t-drawer>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import {
  getDocumentStatus,
  reparseDocument,
  type Document,
  type DocumentStatus,
} from '@/api/documents'
import { listChunks, type Chunk } from '@/api/chunks'
import { retrieve, type RetrievalHit } from '@/api/retrieval'
import { formatSize, formatTime, statusTheme, statusText } from '@/utils/format'

const props = defineProps<{
  visible: boolean
  doc: Document | null
  kbId: string
  initialTab?: string
}>()

const emit = defineEmits<{ 'update:visible': [v: boolean]; refresh: [] }>()

const router = useRouter()
const activeTab = ref('info')
const status = ref<DocumentStatus | null>(null)
const reparsing = ref(false)

const STAGES = [
  { key: 'parsing', label: '文本解析' },
  { key: 'chunking', label: '切片' },
  { key: 'embedding', label: '向量化' },
  { key: 'vlm', label: '图片理解' },
]

const stepCurrent = computed(() => {
  if (!status.value) return 0
  if (status.value.parse_status === 'completed') return STAGES.length
  const idx = STAGES.findIndex((s) => s.key === status.value?.progress.stage)
  return idx === -1 ? 0 : idx
})

const stepStatus = computed(() =>
  status.value?.parse_status === 'failed' ? 'error' : status.value?.parse_status === 'completed' ? 'finish' : 'process'
)

let statusTimer: ReturnType<typeof setInterval> | null = null

const stopPolling = () => {
  if (statusTimer) {
    clearInterval(statusTimer)
    statusTimer = null
  }
}

const loadStatus = async () => {
  if (!props.doc) return
  try {
    status.value = await getDocumentStatus(props.doc.id)
    if (status.value.parse_status !== 'processing') {
      stopPolling()
      emit('refresh')
    }
  } catch {
    stopPolling()
  }
}

const startPolling = () => {
  stopPolling()
  loadStatus()
  statusTimer = setInterval(loadStatus, 2500)
}

const handleReparse = async () => {
  if (!props.doc) return
  reparsing.value = true
  try {
    await reparseDocument(props.doc.id)
    MessagePlugin.success('已触发重新解析')
    emit('refresh')
    startPolling()
  } catch {
    // client 拦截器已弹错
  } finally {
    reparsing.value = false
  }
}

// 切片
const chunks = ref<Chunk[]>([])
const chunksTotal = ref(0)
const chunksLoading = ref(false)
let chunksLoadedFor = ''

const loadChunks = async () => {
  if (!props.doc || chunksLoadedFor === props.doc.id) return
  chunksLoading.value = true
  try {
    const res = await listChunks(props.doc.id, 1, 20)
    chunks.value = res.items
    chunksTotal.value = res.total
    chunksLoadedFor = props.doc.id
  } finally {
    chunksLoading.value = false
  }
}

const gotoChunksPage = () => {
  if (!props.doc) return
  emit('update:visible', false)
  router.push(`/knowledge-bases/${props.kbId}/documents/${props.doc.id}/chunks`)
}

const gotoGraph = () => {
  if (!props.doc) return
  emit('update:visible', false)
  router.push(`/knowledge-bases/${props.kbId}/graph?knowledge_id=${props.doc.id}`)
}

// 召回测试
const recallQuery = ref('')
const recallHits = ref<RetrievalHit[]>([])
const recalling = ref(false)
const recallDone = ref(false)
const ownHitCount = computed(() => recallHits.value.filter((h) => h.document_id === props.doc?.id).length)

const handleRecall = async () => {
  const q = recallQuery.value.trim()
  if (!q || recalling.value) return
  recalling.value = true
  try {
    const res = await retrieve({ kb_ids: [props.kbId], query: q, top_k: 10 })
    recallHits.value = res.hits
    recallDone.value = true
  } catch {
    // client 拦截器已弹错
  } finally {
    recalling.value = false
  }
}

watch(
  () => [props.visible, props.doc?.id] as const,
  ([visible]) => {
    if (!visible) {
      stopPolling()
      return
    }
    activeTab.value = props.initialTab || 'info'
    status.value = null
    chunks.value = []
    chunksTotal.value = 0
    chunksLoadedFor = ''
    recallHits.value = []
    recallDone.value = false
    if (props.doc?.parse_status === 'processing') startPolling()
    else loadStatus()
  }
)

watch(activeTab, (tab) => {
  if (tab === 'chunks') loadChunks()
})

onUnmounted(stopPolling)
</script>

<style scoped>
.tab-body {
  padding: 16px 4px;
}

.info-actions {
  margin-top: 12px;
  padding: 0 4px;
}

.mono {
  font-family: var(--app-font-family-mono);
  font-size: 12px;
}

.progress-steps {
  margin: 8px 0 20px;
}

.progress-bar {
  margin-bottom: 16px;
}

.progress-error {
  margin-bottom: 16px;
}

.error-msg {
  max-height: 160px;
  overflow: auto;
  font-size: 12px;
  word-break: break-all;
  white-space: pre-wrap;
}

.progress-actions {
  display: flex;
  gap: 8px;
}

.chunk-list,
.recall-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chunk-item,
.recall-item {
  padding: 8px 10px;
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
}

.recall-item.own {
  border-color: var(--td-brand-color);
}

.chunk-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.chunk-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--td-text-color-secondary);
  max-height: 96px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.chunks-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  font-size: 12px;
}

.chunks-total {
  color: var(--td-text-color-placeholder);
}

.recall-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.recall-summary {
  font-size: 13px;
  color: var(--td-text-color-secondary);
  margin: 0 0 10px;
}
</style>
