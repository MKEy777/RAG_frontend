<template>
  <div class="kb-detail">
    <input
      ref="fileInput"
      type="file"
      multiple
      style="display: none"
      accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.md,.txt,.csv,.zip"
      @change="handleFileSelect"
    />
    <input
      ref="folderInputRef"
      type="file"
      webkitdirectory
      multiple
      style="display: none"
      @change="handleFolderSelected"
    />

    <PageHeader
      :title="kb?.name || '加载中...'"
      :subtitle="kb?.description || ''"
      back-to="/knowledge-bases"
    >
      <template #actions>
        <t-tag v-if="kb" :theme="kb.type === 'document' ? 'primary' : 'success'" variant="light">
          {{ kb.type === 'document' ? '文档' : 'FAQ' }}
        </t-tag>
        <t-button v-if="kb?.enable_graph" variant="outline" @click="router.push(`/knowledge-bases/${kbId}/graph`)">
          <template #icon><t-icon name="fork" /></template>
          知识图谱
          <t-tag theme="danger" variant="light" size="small" style="margin-left: 4px">NEW</t-tag>
        </t-button>
        <t-button size="small" variant="outline" :loading="suggestIconLoading" @click="handleSuggestIcon">
          AI 图标
        </t-button>
        <t-button variant="outline" @click="openSettings">
          <template #icon><t-icon name="setting" /></template>
          设置
        </t-button>
        <t-button variant="outline" @click="router.push(`/retrieval?kb_id=${kbId}`)">
          <template #icon><t-icon name="search" /></template>
          命中测试
        </t-button>
        <t-button theme="primary" @click="fileInput?.click()">
          <template #icon><t-icon name="cloud-upload" /></template>
          导入文件
        </t-button>
      </template>
    </PageHeader>

    <t-tabs v-model="activeTab" class="detail-tabs">
      <t-tab-panel value="files" label="知识库文件">

    <t-card :bordered="false" class="doc-card">
      <div
        class="upload-dropzone"
        :class="{ 'drag-over': isDragOver }"
        @dragover.prevent="isDragOver = true"
        @dragleave.prevent="isDragOver = false"
        @drop.prevent="handleDrop"
        @click="fileInput?.click()"
      >
        <t-icon name="cloud-upload" size="36px" class="upload-icon" />
        <p class="upload-text">点击或拖拽文件到此处上传</p>
        <p class="upload-hint">支持 PDF、Word、Excel、PPT、Markdown、TXT、ZIP 等格式</p>
      </div>

      <div v-if="processingCount > 0" class="task-bar">
        <t-loading size="small" />
        <span>{{ processingCount }} 个文档处理中，完成后自动刷新</span>
      </div>

      <div v-if="selectedIds.length" class="batch-bar">
        <span class="batch-count">已选 {{ selectedIds.length }} 项</span>
        <t-button size="small" variant="outline" :loading="batchWorking" @click="handleBatchReparse">
          批量重新解析
        </t-button>
        <t-popconfirm :content="`确定删除选中的 ${selectedIds.length} 个文档吗？`" @confirm="handleBatchDelete">
          <t-button size="small" theme="danger" variant="outline" :loading="batchWorking">批量删除</t-button>
        </t-popconfirm>
        <t-button size="small" variant="text" @click="selectedIds = []">取消选择</t-button>
      </div>

      <div class="filter-bar">
        <t-input
          v-model="filters.keyword"
          placeholder="搜索文件名..."
          clearable
          size="small"
          class="filter-input"
        >
          <template #prefix-icon><t-icon name="search" /></template>
        </t-input>
        <t-select
          v-model="filters.status"
          placeholder="状态"
          clearable
          size="small"
          class="filter-select"
          :options="[
            { label: '处理中', value: 'processing' },
            { label: '已完成', value: 'completed' },
            { label: '失败', value: 'failed' },
          ]"
        />
        <t-select
          v-model="filters.file_type"
          placeholder="文件类型"
          clearable
          size="small"
          class="filter-select"
          :options="[
            { label: 'PDF', value: 'pdf' },
            { label: 'Word', value: 'docx' },
            { label: 'Excel', value: 'xlsx' },
            { label: 'PPT', value: 'pptx' },
            { label: 'Markdown', value: 'md' },
            { label: 'TXT', value: 'txt' },
          ]"
        />
      </div>

      <t-table
        :data="documents"
        :columns="columns"
        :loading="docLoading || uploading"
        row-key="id"
        :selected-row-keys="selectedIds"
        :pagination="pagination"
        @page-change="handlePageChange"
        @select-change="handleSelectChange"
      >
        <template #file_name="{ row }">
          <span
            class="file-name-link"
            @click="row.parse_status === 'completed' && router.push(`/knowledge-bases/${kbId}/documents/${row.id}/chunks`)"
          >{{ row.file_name || row.title }}</span>
        </template>
        <template #parse_status="{ row }">
          <t-tag
            :theme="statusTheme(row.parse_status)"
            variant="light"
            class="status-tag"
            @click="openDrawer(row, 'progress')"
          >
            <t-loading v-if="row.parse_status === 'processing'" size="12px" style="margin-right: 4px" />
            {{ statusText(row.parse_status) }}
          </t-tag>
          <t-link
            v-if="row.parse_status === 'failed'"
            theme="danger"
            size="small"
            class="reason-link"
            @click="openDrawer(row, 'progress')"
          >
            查看原因
          </t-link>
        </template>
        <template #op="{ row }">
          <t-space size="0">
            <t-button variant="text" theme="primary" @click="openDrawer(row, 'info')">详情</t-button>
            <t-button
              v-if="row.parse_status === 'failed'"
              variant="text"
              theme="warning"
              @click="handleReparse(row.id)"
            >
              重试
            </t-button>
            <t-button
              v-if="row.needs_images"
              variant="text"
              theme="primary"
              @click="startImageSupplement(row)"
            >
              补充图片
            </t-button>
            <t-dropdown
              :options="moreOptions(row)"
              trigger="click"
              @click="(item: DropdownItem) => handleMore(String(item.value), row)"
            >
              <t-button variant="text" theme="primary">
                更多
                <template #suffix><t-icon name="chevron-down" size="14px" /></template>
              </t-button>
            </t-dropdown>
          </t-space>
        </template>
        <template #empty>
          <EmptyState text="暂无文档，上传文件开始构建知识库" icon="folder-open" />
        </template>
      </t-table>
    </t-card>

      </t-tab-panel>
      <t-tab-panel value="wiki" label="知识 Wiki">
        <div class="wiki-tab-placeholder">
          <t-button variant="outline" @click="router.push(`/knowledge-bases/${kbId}/wiki`)">
            <template #icon><t-icon name="book" /></template>
            进入 Wiki 页面
          </t-button>
        </div>
      </t-tab-panel>
    </t-tabs>

    <DocDetailDrawer
      v-model:visible="drawerVisible"
      :doc="drawerDoc"
      :kb-id="kbId"
      :initial-tab="drawerTab"
      @refresh="fetchDocuments"
    />

    <t-dialog
      v-model:visible="renameVisible"
      header="重命名文档"
      width="420px"
      :confirm-btn="{ loading: renaming }"
      @confirm="confirmRename"
    >
      <t-input v-model="renameValue" placeholder="输入新名称" @enter="confirmRename" />
    </t-dialog>

    <t-dialog
      v-model:visible="settingsVisible"
      header="知识库配置"
      width="560px"
      :confirm-btn="{ loading: savingSettings }"
      @confirm="saveSettings"
    >
      <t-form :label-width="90">
        <t-form-item label="名称">
          <t-input v-model="settingsForm.name" />
        </t-form-item>
        <t-form-item label="描述">
          <t-textarea v-model="settingsForm.description" :autosize="{ minRows: 2, maxRows: 4 }" />
        </t-form-item>
        <t-form-item label="Wiki" help="文档解析后自动生成百科页面，并为切片生成 FAQ 问句提升召回">
          <t-switch v-model="settingsForm.enable_wiki" />
        </t-form-item>
        <t-form-item label="知识图谱" help="抽取实体关系构建图谱，检索可图谱增强">
          <t-switch v-model="settingsForm.enable_graph" />
        </t-form-item>
      </t-form>
      <div class="settings-search-section">
        <h4 class="settings-section-title">检索设置</h4>
        <SearchSettingsForm v-model="searchSettings" />
      </div>
    </t-dialog>

    <t-dialog v-model:visible="urlDialogVisible" header="从 URL 导入" width="480px" :confirm-btn="{ loading: urlImporting }" @confirm="handleImportUrl">
      <t-input v-model="importUrlValue" placeholder="https://..." />
    </t-dialog>

    <t-dialog
      v-model:visible="editDialogVisible"
      header="编辑文档属性"
      width="560px"
      :confirm-btn="{ content: '保存' }"
      @confirm="handleSaveDocMeta"
    >
      <t-form v-if="editDoc" label-align="top">
        <t-form-item label="标题">
          <t-input v-model="editForm.title" />
        </t-form-item>
        <t-form-item label="标签">
          <t-tag-input v-model="editForm.tags" placeholder="输入后回车添加" />
        </t-form-item>
        <t-form-item label="权威度">
          <t-slider v-model="editForm.authority" :min="0" :max="100" />
        </t-form-item>
        <t-form-item label="启用 Wiki">
          <t-switch v-model="editForm.wiki_enabled" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import type { TableProps, DropdownOption as DropdownItem } from 'tdesign-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import DocDetailDrawer from '@/components/DocDetailDrawer.vue'
import SearchSettingsForm from '@/components/SearchSettingsForm.vue'
import type { SearchSettings } from '@/components/SearchSettingsForm.vue'
import { getKnowledgeBase, updateKnowledgeBase, suggestIcon, type KnowledgeBase } from '@/api/knowledgeBase'
import {
  listDocuments,
  deleteDocument,
  renameDocument,
  reparseDocument,
  documentDownloadUrl,
  importUrl,
  updateDocument,
  type Document,
  type DocUpdateBody,
} from '@/api/documents'
import { statusTheme, statusText } from '@/utils/format'
import { useDocStatusStream } from '@/composables/useDocStatusPolling'
import { useDocUpload } from '@/composables/useDocUpload'

const route = useRoute()
const router = useRouter()
const kbId = route.params.id as string
const activeTab = ref('files')

const kb = ref<KnowledgeBase | null>(null)
const documents = ref<Document[]>([])
const docLoading = ref(false)
const isDragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const selectedIds = ref<string[]>([])
const batchWorking = ref(false)

const drawerVisible = ref(false)
const drawerDoc = ref<Document | null>(null)
const drawerTab = ref('info')

const filters = reactive({
  keyword: '',
  status: '' as string,
  file_type: '' as string,
})

const renameVisible = ref(false)
const renameValue = ref('')
const renaming = ref(false)
let renameTarget: Document | null = null

const suggestIconLoading = ref(false)
const handleSuggestIcon = async () => {
  suggestIconLoading.value = true
  try {
    const res = await suggestIcon(kbId)
    await updateKnowledgeBase(kbId, { icon: res.icon })
    kb.value = await getKnowledgeBase(kbId)
    MessagePlugin.success(`已设置图标: ${res.icon}`)
  } catch {
    MessagePlugin.error('推荐图标失败')
  } finally {
    suggestIconLoading.value = false
  }
}

const settingsVisible = ref(false)
const savingSettings = ref(false)
const settingsForm = reactive({
  name: '',
  description: '',
  enable_wiki: true,
  enable_graph: true,
})
const searchSettings = ref<SearchSettings>({
  strategy: 'hybrid',
  vectorWeight: 0.7,
  keywordWeight: 0.3,
  topK: 10,
  minScore: 0.5,
  minScoreEnabled: true,
})

const pagination = reactive({ current: 1, pageSize: 20, total: 0 })

const urlDialogVisible = ref(false)
const importUrlValue = ref('')
const urlImporting = ref(false)

const editDialogVisible = ref(false)
const editDoc = ref<Document | null>(null)
const editForm = reactive<DocUpdateBody>({
  title: '',
  tags: [],
  authority: 0,
  wiki_enabled: false,
})

const openEditDialog = (doc: Document) => {
  editDoc.value = doc
  editForm.title = doc.title || ''
  editForm.tags = doc.tags ? [...doc.tags] : []
  editForm.authority = doc.authority ?? 0
  editForm.wiki_enabled = doc.wiki_enabled ?? false
  editDialogVisible.value = true
}

const handleSaveDocMeta = async () => {
  if (!editDoc.value) return
  try {
    await updateDocument(editDoc.value.id, { ...editForm })
    MessagePlugin.success('已更新')
    editDialogVisible.value = false
    fetchDocuments()
  } catch {
    MessagePlugin.error('更新失败')
  }
}

async function handleImportUrl() {
  if (!importUrlValue.value) return
  urlImporting.value = true
  try {
    await importUrl(kbId, importUrlValue.value)
    urlDialogVisible.value = false
    importUrlValue.value = ''
    MessagePlugin.success('URL 导入已提交')
    await fetchDocuments()
  } catch (e: any) {
    MessagePlugin.error(e?.response?.data?.message || 'URL 导入失败')
  } finally {
    urlImporting.value = false
  }
}

const processingCount = computed(
  () => documents.value.filter((d) => d.parse_status === 'processing').length
)

const columns: TableProps['columns'] = [
  { colKey: 'row-select', type: 'multiple', width: 46 },
  { colKey: 'file_name', title: '文件名', ellipsis: true },
  { colKey: 'parse_status', title: '状态', width: 150 },
  { colKey: 'op', title: '操作', width: 250, align: 'center' },
]

const fetchDocuments = async () => {
  docLoading.value = true
  try {
    const filterParams: Record<string, string> = {}
    if (filters.keyword.trim()) filterParams.keyword = filters.keyword.trim()
    if (filters.status) filterParams.status = filters.status
    if (filters.file_type) filterParams.file_type = filters.file_type
    const res = await listDocuments(kbId, pagination.current, pagination.pageSize, filterParams)
    documents.value = res.items
    pagination.total = res.total
    listPolling.startIfNeeded()
  } finally {
    docLoading.value = false
  }
}

const listPolling = useDocStatusStream(kbId, () => documents.value, fetchDocuments)
const { uploading, folderInputRef, uploadFiles, startImageSupplement, handleFolderSelected } =
  useDocUpload(kbId, fetchDocuments)

watch(
  () => [filters.keyword, filters.status, filters.file_type],
  () => {
    pagination.current = 1
    fetchDocuments()
  }
)

const handlePageChange = (pageInfo: { current: number; pageSize: number }) => {
  pagination.current = pageInfo.current
  pagination.pageSize = pageInfo.pageSize
  fetchDocuments()
}

const handleSelectChange = (keys: (string | number)[]) => {
  selectedIds.value = keys as string[]
}

const handleFileSelect = async (e: Event) => {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  await uploadFiles(Array.from(input.files))
  input.value = ''
}

const handleDrop = async (e: DragEvent) => {
  isDragOver.value = false
  if (!e.dataTransfer?.files?.length) return
  await uploadFiles(Array.from(e.dataTransfer.files))
}

const openDrawer = (doc: Document, tab: string) => {
  drawerDoc.value = doc
  drawerTab.value = tab
  drawerVisible.value = true
}

const moreOptions = (row: Document) => {
  const opts: { content: string; value: string; theme?: string }[] = []
  if (row.parse_status === 'completed') opts.push({ content: '查看切片', value: 'chunks' })
  opts.push({ content: '编辑属性', value: 'edit' })
  opts.push({ content: '重新解析', value: 'reparse' })
  opts.push({ content: '重命名', value: 'rename' })
  opts.push({ content: '下载原文件', value: 'download' })
  opts.push({ content: '删除', value: 'delete', theme: 'error' })
  return opts
}

const handleMore = (action: string, row: Document) => {
  switch (action) {
    case 'chunks':
      router.push(`/knowledge-bases/${kbId}/documents/${row.id}/chunks`)
      break
    case 'edit':
      openEditDialog(row)
      break
    case 'reparse':
      handleReparse(row.id)
      break
    case 'rename':
      renameTarget = row
      renameValue.value = row.title || row.file_name || ''
      renameVisible.value = true
      break
    case 'download':
      window.open(documentDownloadUrl(row.id), '_blank')
      break
    case 'delete':
      handleDelete(row.id)
      break
  }
}

const handleReparse = async (docId: string) => {
  try {
    await reparseDocument(docId)
    MessagePlugin.success('已触发重新解析')
    fetchDocuments()
  } catch {
    // client 拦截器已弹错
  }
}

const confirmRename = async () => {
  if (!renameTarget || renaming.value) return
  const name = renameValue.value.trim()
  if (!name) {
    MessagePlugin.warning('名称不能为空')
    return
  }
  renaming.value = true
  try {
    await renameDocument(renameTarget.id, name)
    MessagePlugin.success('重命名成功')
    renameVisible.value = false
    fetchDocuments()
  } catch {
    // client 拦截器已弹错
  } finally {
    renaming.value = false
  }
}

const handleDelete = async (docId: string) => {
  try {
    await deleteDocument(docId)
    MessagePlugin.success('删除成功')
    selectedIds.value = selectedIds.value.filter((id) => id !== docId)
    fetchDocuments()
  } catch {
    // client 拦截器已弹错
  }
}

const handleBatchDelete = async () => {
  batchWorking.value = true
  try {
    for (const id of selectedIds.value) {
      await deleteDocument(id)
    }
    MessagePlugin.success(`已删除 ${selectedIds.value.length} 个文档`)
    selectedIds.value = []
    fetchDocuments()
  } catch {
    fetchDocuments()
  } finally {
    batchWorking.value = false
  }
}

const handleBatchReparse = async () => {
  batchWorking.value = true
  try {
    for (const id of selectedIds.value) {
      await reparseDocument(id)
    }
    MessagePlugin.success(`已触发 ${selectedIds.value.length} 个文档重新解析`)
    selectedIds.value = []
    fetchDocuments()
  } catch {
    fetchDocuments()
  } finally {
    batchWorking.value = false
  }
}

const openSettings = () => {
  if (!kb.value) return
  settingsForm.name = kb.value.name
  settingsForm.description = kb.value.description || ''
  settingsForm.enable_wiki = kb.value.enable_wiki
  settingsForm.enable_graph = kb.value.enable_graph
  settingsVisible.value = true
}

const saveSettings = async () => {
  if (savingSettings.value) return
  savingSettings.value = true
  try {
    kb.value = await updateKnowledgeBase(kbId, { ...settingsForm })
    MessagePlugin.success('配置已保存')
    settingsVisible.value = false
  } catch {
    // client 拦截器已弹错
  } finally {
    savingSettings.value = false
  }
}

onMounted(async () => {
  try {
    kb.value = await getKnowledgeBase(kbId)
  } catch {
    // client 拦截器已弹错
  }
  fetchDocuments()
})
</script>

<style scoped>
.kb-detail {
  max-width: var(--kl-content-max-width);
  margin: 0 auto;
}

.doc-card {
  border-radius: var(--kl-radius-xl);
  box-shadow: var(--kl-elevation-1);
}

.upload-dropzone {
  border: 2px dashed var(--td-component-stroke);
  border-radius: var(--kl-radius-card);
  padding: var(--kl-space-8);
  text-align: center;
  cursor: pointer;
  transition: all var(--kl-duration-normal) var(--kl-ease-default);
  margin-bottom: var(--kl-space-4);
  background: var(--td-gray-color-1);
}

.upload-dropzone:hover,
.upload-dropzone.drag-over {
  border-color: var(--kl-accent);
  background: var(--kl-accent-light);
}

.upload-icon {
  color: var(--td-text-color-placeholder);
  margin-bottom: var(--kl-space-2);
}

.upload-dropzone:hover .upload-icon,
.upload-dropzone.drag-over .upload-icon {
  color: var(--kl-accent);
}

.upload-text {
  font-size: var(--kl-text-base);
  color: var(--td-text-color-primary);
  margin: 0 0 var(--kl-space-1);
}

.upload-hint {
  font-size: var(--kl-text-xs);
  color: var(--td-text-color-placeholder);
  margin: 0;
}

.task-bar {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
  padding: var(--kl-space-2) var(--kl-space-3);
  margin-bottom: var(--kl-space-3);
  border-radius: var(--kl-radius-md);
  background: var(--td-gray-color-1);
  font-size: var(--kl-text-sm);
  color: var(--td-text-color-secondary);
}

.batch-bar {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
  padding: var(--kl-space-2) var(--kl-space-3);
  margin-bottom: var(--kl-space-3);
  border-radius: var(--kl-radius-md);
  background: var(--td-brand-color-1);
  font-size: var(--kl-text-sm);
}

.batch-count {
  color: var(--td-text-color-secondary);
  margin-right: var(--kl-space-1);
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
  margin-bottom: var(--kl-space-3);
}

.filter-input {
  flex: 1;
  min-width: 0;
}

.filter-select {
  width: 130px;
  flex-shrink: 0;
}

.status-tag {
  cursor: pointer;
}

.reason-link {
  margin-left: var(--kl-space-1);
  font-size: var(--kl-text-xs);
}

.file-name-link {
  cursor: pointer;
  color: var(--td-text-color-primary);
  transition: color var(--kl-duration-fast) var(--kl-ease-default);
}

.file-name-link:hover {
  color: var(--kl-accent);
  text-decoration: underline;
}

.detail-tabs {
  margin-top: var(--kl-space-2);
}

.wiki-tab-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.settings-search-section {
  margin-top: var(--kl-space-4);
  padding-top: var(--kl-space-4);
  border-top: var(--kl-border-width) solid var(--td-component-stroke);
}

.settings-section-title {
  font-size: var(--kl-text-base);
  font-weight: var(--kl-weight-semibold);
  color: var(--td-text-color-primary);
  margin: 0 0 var(--kl-space-3);
}
</style>
