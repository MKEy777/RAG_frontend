<template>
  <div class="doc-list">
    <t-card :bordered="false">
      <template #title>
        <div class="card-title">
          <t-button variant="text" shape="square" @click="goBack">
            <t-icon name="chevron-left" />
          </t-button>
          <span>文档管理</span>
          <t-tag v-if="kbName" theme="primary" variant="light" size="small">{{ kbName }}</t-tag>
        </div>
      </template>
      <template #action>
        <t-upload
          :auto-upload="false"
          :multiple="true"
          @change="handleFileChange"
        >
          <t-button theme="primary">
            <template #icon><t-icon name="upload" /></template>
            上传文档
          </t-button>
        </t-upload>
      </template>

      <t-table
        :data="documents"
        :columns="columns"
        :loading="loading"
        row-key="id"
        :pagination="pagination"
        @page-change="handlePageChange"
      >
        <template #parse_status="{ row }">
          <t-tag :theme="getStatusTheme(row.parse_status)" variant="light">
            {{ getStatusText(row.parse_status) }}
          </t-tag>
        </template>
        <template #file_size="{ row }">
          {{ formatSize(row.file_size) }}
        </template>
        <template #op="{ row }">
          <t-space>
            <t-button variant="text" theme="primary" @click="viewStatus(row.id)">
              状态
            </t-button>
            <t-popconfirm
              content="确定要删除这个文档吗？"
              @confirm="handleDelete(row.id)"
            >
              <t-button variant="text" theme="danger">删除</t-button>
            </t-popconfirm>
          </t-space>
        </template>
      </t-table>
    </t-card>

    <!-- 状态详情对话框 -->
    <t-dialog
      v-model:visible="showStatusDialog"
      header="文档处理状态"
      :footer="false"
      width="400px"
    >
      <div v-if="docStatus" class="status-detail">
        <t-descriptions :column="1">
          <t-descriptions-item label="文档 ID">{{ docStatus.doc_id }}</t-descriptions-item>
          <t-descriptions-item label="解析状态">
            <t-tag :theme="getStatusTheme(docStatus.parse_status)" variant="light">
              {{ getStatusText(docStatus.parse_status) }}
            </t-tag>
          </t-descriptions-item>
          <t-descriptions-item label="处理阶段">{{ docStatus.progress.stage }}</t-descriptions-item>
          <t-descriptions-item label="进度">
            <t-progress :percentage="docStatus.progress.percent" />
          </t-descriptions-item>
          <t-descriptions-item v-if="docStatus.error_message" label="错误信息">
            <t-text theme="danger">{{ docStatus.error_message }}</t-text>
          </t-descriptions-item>
        </t-descriptions>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import type { TableProps, UploadChangeContext } from 'tdesign-vue-next'
import { getKnowledgeBase } from '@/api/knowledgeBase'
import {
  listDocuments,
  uploadDocument,
  deleteDocument,
  getDocumentStatus,
  type Document,
  type DocumentStatus,
} from '@/api/documents'

const route = useRoute()
const router = useRouter()
const kbId = route.params.id as string

const kbName = ref('')
const documents = ref<Document[]>([])
const loading = ref(false)
const showStatusDialog = ref(false)
const docStatus = ref<DocumentStatus | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
})

const columns: TableProps['columns'] = [
  { colKey: 'file_name', title: '文件名', ellipsis: true },
  { colKey: 'parse_status', title: '状态', width: 100 },
  { colKey: 'op', title: '操作', width: 140, align: 'center' },
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

const formatSize = (bytes: number | null) => {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const fetchKbName = async () => {
  try {
    const kb = await getKnowledgeBase(kbId)
    kbName.value = kb.name
  } catch {
    // ignore
  }
}

const fetchDocuments = async () => {
  loading.value = true
  try {
    const res = await listDocuments(kbId, pagination.current, pagination.pageSize)
    documents.value = res.items
    pagination.total = res.total
    startPollingIfNeeded()
  } finally {
    loading.value = false
  }
}

const handlePageChange = (pageInfo: { current: number; pageSize: number }) => {
  pagination.current = pageInfo.current
  pagination.pageSize = pageInfo.pageSize
  fetchDocuments()
}

const handleFileChange = async (files: UploadChangeContext['currentSelectedFiles']) => {
  if (!files || files.length === 0) return

  for (const file of files) {
    try {
      await uploadDocument(kbId, file.raw as File)
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

const viewStatus = async (docId: string) => {
  try {
    docStatus.value = await getDocumentStatus(docId)
    showStatusDialog.value = true
  } catch {
    MessagePlugin.error('获取状态失败')
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
  router.push(`/knowledge-bases/${kbId}`)
}

onMounted(() => {
  fetchKbName()
  fetchDocuments()
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
  }
})
</script>

<style scoped>
.doc-list {
  max-width: 1200px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-detail {
  padding: 8px 0;
}
</style>
