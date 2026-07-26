<template>
  <div class="chunks-view">
    <PageHeader
      :title="kbMode ? '切片检查' : '切片详情'"
      :subtitle="docTitle"
      :back-to="`/knowledge-bases/${kbId}`"
    >
      <template #actions>
        <t-select
          v-model="chunkTypeFilter"
          :options="typeOptions"
          placeholder="全部类型"
          clearable
          size="small"
          style="width: 140px"
          @change="handleTypeChange"
        />
      </template>
    </PageHeader>

    <div class="split">
      <div
        v-if="kbMode"
        class="pane files-pane"
        :class="{ collapsed: filesCollapsed }"
        @mouseenter="filesCollapsed && (flyoutVisible = true)"
        @mouseleave="filesCollapsed && (flyoutVisible = false)"
      >
        <div class="pane-header files-header" @click="filesCollapsed = !filesCollapsed">
          <t-icon :name="filesCollapsed ? 'chevron-right' : 'chevron-down'" size="14px" class="collapse-icon" />
          <template v-if="!filesCollapsed">
            文件
            <t-tag variant="light" size="small">{{ docs.length }}</t-tag>
          </template>
        </div>
        <div class="files-body-wrapper">
          <div class="pane-body files-body">
            <t-loading :loading="docsLoading" style="min-height: 120px">
              <t-empty v-if="!docsLoading && docs.length === 0" description="暂无文档" />
              <div v-else class="file-list">
                <div
                  v-for="d in docs"
                  :key="d.id"
                  class="file-item"
                  :class="{ active: d.id === activeDocId, disabled: d.parse_status !== 'completed' }"
                  @click="selectDoc(d)"
                  @mouseenter="hoveredDocId = d.id"
                >
                  <t-icon name="file" size="14px" class="file-icon" />
                  <template v-if="!filesCollapsed">
                    <span class="file-name">{{ d.file_name || d.title }}</span>
                    <t-tag
                      v-if="d.parse_status !== 'completed'"
                      :theme="statusTheme(d.parse_status)"
                      variant="light"
                      size="small"
                    >
                      {{ statusText(d.parse_status) }}
                    </t-tag>
                  </template>
                </div>
              </div>
            </t-loading>
          </div>
        </div>
        <div v-if="filesCollapsed && flyoutVisible" class="flyout">
          <div
            v-for="d in docs"
            :key="d.id"
            class="flyout-item"
            :class="{ highlighted: d.id === hoveredDocId, active: d.id === activeDocId }"
            @click="selectDoc(d)"
          >
            {{ d.file_name || d.title }}
          </div>
        </div>
      </div>

      <div class="pane source-pane">
        <div class="pane-header">
          解析后源文
          <t-button
            v-if="sourceContent"
            variant="text"
            size="small"
            shape="square"
            @click="copySource"
          >
            <t-icon name="file-copy" />
          </t-button>
        </div>
        <div class="pane-body" ref="sourceScroll">
          <t-loading :loading="sourceLoading" style="min-height: 200px">
            <t-empty
              v-if="!sourceLoading && !sourceContent"
              :description="activeDocId ? '暂无源文本（文档可能尚未解析完成）' : '请在左侧选择文件'"
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
                  <span
                    v-if="c.parent_chunk_id"
                    class="chunk-parent"
                    @click.stop="jumpToParent(c.parent_chunk_id)"
                  >↑ 父块</span>
                  <t-button
                    variant="text"
                    size="small"
                    shape="square"
                    class="copy-btn"
                    @click.stop="copyChunk(c)"
                  >
                    <t-icon name="file-copy" />
                  </t-button>
                  <t-button variant="text" size="small" class="copy-btn" @click.stop="openEdit(c)">编辑</t-button>
                  <t-popconfirm content="删除该切块？将同步从索引移除" theme="danger" @confirm="handleDelete(c)">
                    <t-button variant="text" size="small" theme="danger" class="copy-btn" @click.stop>删除</t-button>
                  </t-popconfirm>
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

    <t-dialog v-model:visible="editVisible" header="编辑切块" width="680px" :confirm-btn="{ loading: saving }" @confirm="handleSave">
      <t-textarea v-model="editContent" :autosize="{ minRows: 8, maxRows: 20 }" />
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { getDocument, listDocuments, type Document } from '@/api/documents'
import { listChunks, getDocumentContent, updateChunk, deleteChunk, type Chunk } from '@/api/chunks'
import { statusTheme, statusText } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'

const route = useRoute()
const kbId = route.params.id as string
const routeDocId = (route.params.docId as string) || ''
const kbMode = !routeDocId

const filesCollapsed = ref(false)
const flyoutVisible = ref(false)
const hoveredDocId = ref('')
const activeDocId = ref(routeDocId)
const docs = ref<Document[]>([])
const docsLoading = ref(false)
const docTitle = ref('')
const chunks = ref<Chunk[]>([])
const loading = ref(false)
const sourceLoading = ref(false)
const sourceContent = ref('')
const selected = ref<Chunk | null>(null)
const chunkTypeFilter = ref<string | undefined>('text')
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

const fetchSource = async () => {
  if (!activeDocId.value) return
  sourceLoading.value = true
  try {
    const res = await getDocumentContent(activeDocId.value)
    sourceContent.value = res.content
  } catch {
    sourceContent.value = ''
  } finally {
    sourceLoading.value = false
  }
}

const fetchChunks = async () => {
  if (!activeDocId.value) return
  loading.value = true
  try {
    const res = await listChunks(activeDocId.value, pagination.current, pagination.pageSize, chunkTypeFilter.value)
    chunks.value = res.items
    pagination.total = res.total
  } finally {
    loading.value = false
  }
}

const loadDoc = () => {
  selected.value = null
  sourceContent.value = ''
  chunks.value = []
  pagination.current = 1
  pagination.total = 0
  fetchSource()
  fetchChunks()
}

const selectDoc = (d: Document) => {
  if (d.parse_status !== 'completed' || d.id === activeDocId.value) return
  activeDocId.value = d.id
  docTitle.value = d.file_name || d.title || ''
  loadDoc()
}

const selectChunk = async (c: Chunk) => {
  selected.value = c
  await nextTick()
  hlMark.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

const jumpToParent = (parentId: string) => {
  const parent = chunks.value.find((c) => c.id === parentId)
  if (parent) {
    selectChunk(parent)
  } else {
    MessagePlugin.warning('父块不在当前页，请切换分页或筛选“父块”类型查看')
  }
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

const copySource = async () => {
  try {
    await navigator.clipboard.writeText(sourceContent.value || '')
    MessagePlugin.success('已复制源文到剪贴板')
  } catch {
    MessagePlugin.error('复制失败')
  }
}

const copyChunk = async (c: Chunk) => {
  try {
    await navigator.clipboard.writeText(c.content || '')
    MessagePlugin.success('已复制到剪贴板')
  } catch {
    MessagePlugin.error('复制失败')
  }
}

const editVisible = ref(false)
const editContent = ref('')
const saving = ref(false)
let editingChunk: Chunk | null = null

function openEdit(chunk: Chunk) {
  editingChunk = chunk
  editContent.value = chunk.content
  editVisible.value = true
}

async function handleSave() {
  if (!editingChunk) return
  saving.value = true
  try {
    await updateChunk(activeDocId.value, editingChunk.id, editContent.value)
    editingChunk.content = editContent.value
    editVisible.value = false
    MessagePlugin.success('切块已更新')
  } finally {
    saving.value = false
  }
}

async function handleDelete(chunk: Chunk) {
  await deleteChunk(activeDocId.value, chunk.id)
  MessagePlugin.success('切块已删除')
  await fetchChunks()
}

onMounted(async () => {
  if (kbMode) {
    docsLoading.value = true
    try {
      const res = await listDocuments(kbId, 1, 100)
      docs.value = res.items
      const first = res.items.find((d) => d.parse_status === 'completed')
      if (first) selectDoc(first)
    } finally {
      docsLoading.value = false
    }
  } else {
    try {
      const doc = await getDocument(routeDocId)
      docTitle.value = doc.title || doc.file_name || ''
    } catch {
      // ignore
    }
    loadDoc()
  }
})
</script>

<style scoped>
.chunks-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--kl-page-padding-y) var(--kl-page-padding-x) var(--kl-space-4);
}

.split {
  display: flex;
  gap: var(--kl-space-4);
  flex: 1;
  min-height: 0;
}

.pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--td-bg-color-container);
  border: 1px solid #E8EAED;
  border-radius: var(--kl-radius-card);
}

.files-pane {
  flex: none;
  width: 240px;
  transition: width var(--kl-duration-normal) var(--kl-ease-default);
  position: relative;
}

.files-pane.collapsed {
  width: var(--kl-control-height-md);
}

.files-pane.collapsed .files-header {
  justify-content: center;
  padding: var(--kl-space-3) 0;
}

.files-pane.collapsed .file-item {
  justify-content: center;
  padding: var(--kl-space-2) 0;
}

.files-body-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: 0 0 var(--kl-radius-lg) var(--kl-radius-lg);
}

.flyout {
  position: absolute;
  top: 44px;
  left: 100%;
  margin-left: var(--kl-space-1);
  min-width: 180px;
  max-width: 260px;
  max-height: 100%;
  overflow-y: auto;
  padding: var(--kl-space-1);
  border-radius: var(--kl-radius-lg);
  background: var(--td-bg-color-container);
  border: var(--kl-border-width) solid var(--kl-border-color);
  box-shadow: var(--kl-elevation-flyout);
  z-index: var(--kl-z-flyout);
}

.flyout-item {
  display: flex;
  align-items: center;
  height: 30px;
  padding: 0 var(--kl-space-2);
  font-size: var(--kl-text-sm);
  border-radius: var(--kl-radius-md);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--td-text-color-secondary);
  cursor: pointer;
  transition: background var(--kl-duration-instant) var(--kl-ease-default),
    color var(--kl-duration-instant) var(--kl-ease-default);
}

.flyout-item.highlighted {
  background: var(--td-gray-color-3);
  color: var(--td-text-color-primary);
  font-weight: var(--kl-weight-semibold);
}

.flyout-item.active {
  color: var(--td-brand-color);
}

.files-header {
  cursor: pointer;
  user-select: none;
}

.files-header:hover {
  background: none;
}

.collapse-icon {
  flex-shrink: 0;
  transition: transform var(--kl-duration-fast) var(--kl-ease-default);
}

.files-body {
  padding: var(--kl-space-2);
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
  padding: var(--kl-space-2) var(--kl-space-2);
  border-radius: var(--kl-radius-md);
  cursor: pointer;
  transition: background var(--kl-duration-fast) var(--kl-ease-default);
}

.file-item:hover {
  background: var(--td-gray-color-2);
}

.file-item.active {
  font-weight: var(--kl-weight-semibold);
}

.file-item.disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.file-icon {
  color: var(--td-text-color-placeholder);
  flex-shrink: 0;
}

.file-name {
  flex: 1;
  min-width: 0;
  font-size: var(--kl-text-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pane-header {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
  padding: var(--kl-space-3) var(--kl-space-4);
  font-size: var(--kl-text-base);
  font-weight: var(--kl-weight-semibold);
  border-bottom: var(--kl-border-width) solid var(--td-border-level-1-color);
}

.pane-body {
  flex: 1;
  overflow: auto;
  padding: var(--kl-space-3) var(--kl-space-4);
}

.files-pane .pane-body {
  padding: var(--kl-space-2);
}

.pane-footer {
  padding: var(--kl-space-2) var(--kl-space-4);
  border-top: var(--kl-border-width) solid var(--td-border-level-1-color);
}

.source-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: var(--kl-text-sm);
  line-height: var(--kl-leading-relaxed);
  font-family: inherit;
}

.hl-mark {
  background: color-mix(in srgb, var(--td-brand-color) 18%, transparent);
  color: inherit;
  border-radius: var(--kl-radius-sm);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--td-brand-color) 18%, transparent);
}

.chunk-list {
  display: flex;
  flex-direction: column;
  gap: var(--kl-space-2);
}

.chunk-item {
  padding: var(--kl-space-2) var(--kl-space-3);
  border: 1px solid #E8EAED;
  border-radius: var(--kl-radius-lg);
  cursor: pointer;
  transition: all var(--kl-duration-fast) var(--kl-ease-default);
}

.chunk-item:hover {
  border-color: var(--td-brand-color);
}

.chunk-item.active {
  border-color: var(--kl-accent);
  background: var(--kl-accent-light);
}

.chunk-meta {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
  margin-bottom: var(--kl-space-1);
  font-size: var(--kl-text-xs);
  color: var(--td-text-color-placeholder);
}

.chunk-parent {
  color: var(--td-brand-color);
  cursor: pointer;
  font-size: var(--kl-text-xs);
}

.chunk-parent:hover {
  text-decoration: underline;
}

.copy-btn {
  margin-left: auto;
  opacity: 0;
  transition: opacity var(--kl-duration-fast) var(--kl-ease-default);
}

.chunk-item:hover .copy-btn {
  opacity: 1;
}

.chunk-content {
  font-size: var(--kl-text-sm);
  line-height: 1.6;
  color: var(--td-text-color-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow: auto;
}
</style>
