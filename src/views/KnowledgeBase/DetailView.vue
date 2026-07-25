<template>
  <div class="kb-detail">
    <!-- 隐藏的文件输入框 -->
    <input
      ref="fileInput"
      type="file"
      multiple
      style="display: none"
      accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.md,.txt,.csv"
      @change="handleFileSelect"
    />

    <!-- 知识库信息 -->
    <t-card :bordered="false" class="info-card">
      <template #title>
        <div class="card-title">
          <t-button variant="text" shape="square" @click="goBack">
            <t-icon name="chevron-left" />
          </t-button>
          <span>{{ kb?.name || '加载中...' }}</span>
        </div>
      </template>
      <t-descriptions :column="1" layout="vertical" v-if="kb">
        <t-descriptions-item label="ID">
          <span class="kb-id">{{ kb.id }}</span>
        </t-descriptions-item>
        <t-descriptions-item label="类型">
          <t-tag :theme="kb.type === 'document' ? 'primary' : 'success'" variant="light">
            {{ kb.type === 'document' ? '文档' : 'FAQ' }}
          </t-tag>
        </t-descriptions-item>
        <t-descriptions-item label="描述">{{ kb.description || '-' }}</t-descriptions-item>
      </t-descriptions>
    </t-card>

    <!-- 文档管理 -->
    <t-card title="文档管理" :bordered="false" class="doc-card">
      <template #action>
        <t-button theme="primary" @click="triggerUpload">
          <template #icon><t-icon name="upload" /></template>
          上传文档
        </t-button>
      </template>

      <!-- 拖拽上传区域 -->
      <div
        class="upload-dropzone"
        :class="{ 'drag-over': isDragOver }"
        @dragover.prevent="isDragOver = true"
        @dragleave.prevent="isDragOver = false"
        @drop.prevent="handleDrop"
        @click="triggerUpload"
      >
        <t-icon name="cloud-upload" size="40px" class="upload-icon" />
        <p class="upload-text">点击或拖拽文件到此处上传</p>
        <p class="upload-hint">支持 PDF、Word、Excel、PPT、Markdown、TXT 等格式</p>
      </div>

      <t-table
        :data="documents"
        :columns="columns"
        :loading="docLoading"
        row-key="id"
        :pagination="pagination"
        @page-change="handlePageChange"
      >
        <template #parse_status="{ row }">
          <t-tag :theme="getStatusTheme(row.parse_status)" variant="light">
            {{ getStatusText(row.parse_status) }}
          </t-tag>
        </template>
        <template #op="{ row }">
          <t-popconfirm
            content="确定要删除这个文档吗？"
            @confirm="handleDelete(row.id)"
          >
            <t-button variant="text" theme="danger">删除</t-button>
          </t-popconfirm>
        </template>
      </t-table>
    </t-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import type { TableProps } from 'tdesign-vue-next'
import { getKnowledgeBase, type KnowledgeBase } from '@/api/knowledgeBase'
import {
  listDocuments,
  uploadDocument,
  deleteDocument,
  getDocumentStatus,
  type Document,
} from '@/api/documents'

const route = useRoute()
const router = useRouter()
const kbId = route.params.id as string

const kb = ref<KnowledgeBase | null>(null)
const documents = ref<Document[]>([])
const docLoading = ref(false)
const isDragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
})

const columns: TableProps['columns'] = [
  { colKey: 'file_name', title: '文件名', ellipsis: true },
  { colKey: 'parse_status', title: '状态', width: 120 },
  { colKey: 'op', title: '操作', width: 100, align: 'center' },
]

const getStatusTheme = (status: string) => {
  switch (status) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'danger'
    case 'processing':
      return 'warning'
    default:
      return 'default'
  }
}

const getStatusText = (status: string) => {
  switch (status) {
    case 'completed':
      return '已完成'
    case 'failed':
      return '失败'
    case 'processing':
      return '处理中'
    default:
      return status
  }
}

const fetchKb = async () => {
  try {
    kb.value = await getKnowledgeBase(kbId)
  } catch {
    MessagePlugin.error('获取知识库信息失败')
  }
}

const fetchDocuments = async () => {
  docLoading.value = true
  try {
    const res = await listDocuments(kbId, pagination.current, pagination.pageSize)
    documents.value = res.items
    pagination.total = res.total
    startPollingIfNeeded()
  } finally {
    docLoading.value = false
  }
}

const handlePageChange = (pageInfo: { current: number; pageSize: number }) => {
  pagination.current = pageInfo.current
  pagination.pageSize = pageInfo.pageSize
  fetchDocuments()
}

const triggerUpload = () => {
  fileInput.value?.click()
}

const handleFileSelect = async (e: Event) => {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  await uploadFiles(Array.from(input.files))
  input.value = '' // 清空以便重复选择同一文件
}

const handleDrop = async (e: DragEvent) => {
  isDragOver.value = false
  if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) return
  await uploadFiles(Array.from(e.dataTransfer.files))
}

const uploadFiles = async (files: File[]) => {
  for (const file of files) {
    try {
      await uploadDocument(kbId, file)
      MessagePlugin.success(`${file.name} 上传成功`)
    } catch {
      MessagePlugin.error(`${file.name} 上传失败`)
    }
  }
  fetchDocuments()
}

const handleDelete = async (docId: string) => {
  try {
    await deleteDocument(docId)
    MessagePlugin.success('删除成功')
    fetchDocuments()
  } catch {
    MessagePlugin.error('删除失败')
  }
}

const startPollingIfNeeded = () => {
  const hasProcessing = documents.value.some((d) => d.parse_status === 'processing')

  if (hasProcessing && !pollTimer) {
    pollTimer = setInterval(async () => {
      let needsRefresh = false
      for (const doc of documents.value) {
        if (doc.parse_status === 'processing') {
          try {
            const status = await getDocumentStatus(doc.id)
            if (status.parse_status !== 'processing') {
              needsRefresh = true
            }
          } catch {
            // ignore
          }
        }
      }
      if (needsRefresh) {
        fetchDocuments()
      }
    }, 3000)
  } else if (!hasProcessing && pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const goBack = () => {
  router.push('/knowledge-bases')
}

onMounted(() => {
  fetchKb()
  fetchDocuments()
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
  }
})
</script>

<style scoped>
.kb-detail {
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-card {
  margin-bottom: 0;
}

.kb-id {
  font-family: monospace;
  font-size: 13px;
  word-break: break-all;
  color: var(--td-text-color-secondary);
}

.upload-dropzone {
  border: 2px dashed var(--td-border-level-2-color);
  border-radius: 8px;
  padding: 32px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 16px;
  background: var(--td-bg-color-secondarycontainer);
}

.upload-dropzone:hover,
.upload-dropzone.drag-over {
  border-color: var(--td-brand-color);
  background: var(--td-brand-color-light);
}

.upload-icon {
  color: var(--td-text-color-placeholder);
  margin-bottom: 8px;
}

.upload-dropzone:hover .upload-icon,
.upload-dropzone.drag-over .upload-icon {
  color: var(--td-brand-color);
}

.upload-text {
  font-size: 14px;
  color: var(--td-text-color-primary);
  margin: 0 0 4px;
}

.upload-hint {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  margin: 0;
}
</style>
