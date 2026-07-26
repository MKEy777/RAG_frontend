<template>
  <div class="chunks-view">
    <div class="toolbar">
      <t-button variant="text" shape="square" @click="goBack">
        <t-icon name="chevron-left" />
      </t-button>
      <span class="toolbar-title">切片详情</span>
      <t-tag v-if="docTitle" theme="primary" variant="light" size="small">{{ docTitle }}</t-tag>
      <div class="toolbar-spacer" />
      <t-select
        v-model="chunkTypeFilter"
        :options="typeOptions"
        placeholder="全部类型"
        clearable
        size="small"
        style="width: 140px"
        @change="handleTypeChange"
      />
    </div>

    <div class="split">
      <div class="pane source-pane">
        <div class="pane-header">解析后源文</div>
        <div class="pane-body" ref="sourceScroll">
          <t-loading :loading="sourceLoading" style="min-height: 200px">
            <t-empty
              v-if="!sourceLoading && !sourceContent"
              description="暂无源文本（文档可能尚未解析完成）"
            />
            <pre v-else class="source-pre"><span>{{ hl.before }}</span><mark v-if="hl.mid" ref="hlMark" class="hl-mark">{{ hl.mid }}</mark><span>{{ hl.after }}</span></pre>
          </t-loading>
        </div>
      </div>

      <div class="pane chunks-pane">
        <div class="pane-header">
          切块列表
          <t-tag variant="light" size="small">共 {{ pagination.total }}</t-tag>
        </div>
        <div class="pane-body">
          <t-loading :loading="loading" style="min-height: 200px">
            <t-empty v-if="!loading && chunks.length === 0" description="暂无切块" />
            <div v-else class="chunk-list">
              <div
                v-for="c in chunks"
                :key="c.id"
                class="chunk-item"
                :class="{ active: selected?.id === c.id }"
                @click="selectChunk(c)"
              >
                <div class="chunk-meta">
                  <t-tag :theme="getTypeTheme(c.chunk_type)" variant="light" size="small">
                    {{ getTypeText(c.chunk_type) }}
                  </t-tag>
                  <span class="chunk-pos">{{ c.start_at ?? '-' }} – {{ c.end_at ?? '-' }}</span>
                  <span v-if="c.parent_chunk_id" class="chunk-parent">父: {{ c.parent_chunk_id.slice(0, 8) }}</span>
                </div>
                <div class="chunk-content">{{ c.content }}</div>
              </div>
            </div>
          </t-loading>
        </div>
        <div class="pane-footer">
          <t-pagination
            v-model="pagination.current"
            v-model:page-size="pagination.pageSize"
            :total="pagination.total"
            size="small"
            :page-size-options="[20, 50, 100]"
            @change="handlePageChange"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getDocument } from '@/api/documents'
import { listChunks, getDocumentContent, type Chunk } from '@/api/chunks'

const route = useRoute()
const router = useRouter()
const kbId = route.params.id as string
const docId = route.params.docId as string

const docTitle = ref('')
const chunks = ref<Chunk[]>([])
const loading = ref(false)
const sourceLoading = ref(false)
const sourceContent = ref('')
const selected = ref<Chunk | null>(null)
const chunkTypeFilter = ref<string | undefined>(undefined)
const hlMark = ref<HTMLElement | null>(null)

const typeOptions = [
  { label: '全部类型', value: '' },
  { label: '文本', value: 'text' },
  { label: '父块', value: 'parent_text' },
  { label: '图片', value: 'image' },
]

const pagination = reactive({
  current: 1,
  pageSize: 50,
  total: 0,
})

const hl = computed(() => {
  const src = sourceContent.value
  const c = selected.value
  if (!src || !c || c.start_at == null || c.end_at == null || c.start_at >= src.length) {
    return { before: src, mid: '', after: '' }
  }
  const start = Math.max(0, Math.min(c.start_at, src.length))
  const end = Math.max(start, Math.min(c.end_at, src.length))
  return { before: src.slice(0, start), mid: src.slice(start, end), after: src.slice(end) }
})

const getTypeTheme = (type?: string) => {
  switch (type) {
    case 'text': return 'primary'
    case 'parent_text': return 'warning'
    case 'image': return 'danger'
    default: return 'default'
  }
}

const getTypeText = (type?: string) => {
  switch (type) {
    case 'text': return '文本'
    case 'parent_text': return '父块'
    case 'image': return '图片'
    default: return type || '-'
  }
}

const fetchDocTitle = async () => {
  try {
    const doc = await getDocument(docId)
    docTitle.value = doc.title || doc.file_name || ''
  } catch {
    // ignore
  }
}

const fetchSource = async () => {
  sourceLoading.value = true
  try {
    const res = await getDocumentContent(docId)
    sourceContent.value = res.content
  } catch {
    sourceContent.value = ''
  } finally {
    sourceLoading.value = false
  }
}

const fetchChunks = async () => {
  loading.value = true
  try {
    const res = await listChunks(docId, pagination.current, pagination.pageSize, chunkTypeFilter.value)
    chunks.value = res.items
    pagination.total = res.total
  } finally {
    loading.value = false
  }
}

const selectChunk = async (c: Chunk) => {
  selected.value = c
  await nextTick()
  hlMark.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

const handlePageChange = (pageInfo: { current: number; pageSize: number }) => {
  pagination.current = pageInfo.current
  pagination.pageSize = pageInfo.pageSize
  fetchChunks()
}

const handleTypeChange = () => {
  pagination.current = 1
  fetchChunks()
}

const goBack = () => {
  router.push(`/knowledge-bases/${kbId}/documents`)
}

onMounted(() => {
  fetchDocTitle()
  fetchSource()
  fetchChunks()
})
</script>

<style scoped>
.chunks-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.toolbar-title {
  font-size: 16px;
  font-weight: 600;
}

.toolbar-spacer {
  flex: 1;
}

.split {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
  height: calc(100vh - 180px);
}

.pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: var(--td-radius-medium);
}

.pane-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  border-bottom: 1px solid var(--td-border-level-1-color);
}

.pane-body {
  flex: 1;
  overflow: auto;
  padding: 12px 16px;
}

.pane-footer {
  padding: 8px 16px;
  border-top: 1px solid var(--td-border-level-1-color);
}

.source-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.7;
  font-family: inherit;
}

.hl-mark {
  background: rgba(0, 82, 217, 0.16);
  color: inherit;
  border-radius: 2px;
  box-shadow: 0 0 0 2px rgba(0, 82, 217, 0.16);
}

.chunk-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chunk-item {
  padding: 10px 12px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.chunk-item:hover {
  border-color: var(--td-brand-color);
}

.chunk-item.active {
  border-color: var(--td-brand-color);
  background: var(--td-brand-color-light);
}

.chunk-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.chunk-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--td-text-color-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow: auto;
}
</style>
