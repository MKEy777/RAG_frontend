<template>
  <div class="kb-list">
    <!-- 操作栏 -->
    <div class="toolbar">
      <h2 class="page-title">知识库管理</h2>
      <t-button theme="primary" size="large" @click="showCreateDialog = true">
        <template #icon><t-icon name="add" /></template>
        新建知识库
      </t-button>
    </div>

    <t-card :bordered="false">

      <t-table
        :data="knowledgeBases"
        :columns="columns"
        :loading="loading"
        row-key="id"
        :pagination="pagination"
        @page-change="handlePageChange"
      >
        <template #type="{ row }">
          <t-tag :theme="row.type === 'document' ? 'primary' : 'success'" variant="light">
            {{ row.type === 'document' ? '文档' : 'FAQ' }}
          </t-tag>
        </template>
        <template #op="{ row }">
          <t-space>
            <t-button variant="text" theme="primary" @click="goToDetail(row.id)">
              管理
            </t-button>
            <t-popconfirm
              content="确定要删除这个知识库吗？删除后无法恢复。"
              @confirm="handleDelete(row.id)"
            >
              <t-button variant="text" theme="danger">删除</t-button>
            </t-popconfirm>
          </t-space>
        </template>
      </t-table>
    </t-card>

    <!-- 新建知识库对话框 -->
    <t-dialog
      v-model:visible="showCreateDialog"
      header="新建知识库"
      :confirm-btn="{ content: '创建', loading: creating }"
      @confirm="handleCreate"
    >
      <t-form :data="formData" :label-width="100">
        <t-form-item label="名称" name="name">
          <t-input v-model="formData.name" placeholder="请输入知识库名称" />
        </t-form-item>
        <t-form-item label="类型" name="type">
          <t-select v-model="formData.type">
            <t-option value="document" label="文档知识库" />
            <t-option value="faq" label="FAQ 知识库" />
          </t-select>
        </t-form-item>
        <t-form-item label="描述" name="description">
          <t-textarea
            v-model="formData.description"
            placeholder="请输入描述（可选）"
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
        </t-form-item>
        <t-form-item label="嵌入模型" name="embedding_model_id">
          <t-input v-model="formData.embedding_model_id" placeholder="Qwen/Qwen3-Embedding-0.6B" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import type { TableProps } from 'tdesign-vue-next'
import {
  listKnowledgeBases,
  createKnowledgeBase,
  deleteKnowledgeBase,
  type KnowledgeBase,
  type KBCreateParams,
} from '@/api/knowledgeBase'

const router = useRouter()
const loading = ref(false)
const creating = ref(false)
const showCreateDialog = ref(false)
const knowledgeBases = ref<KnowledgeBase[]>([])

const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
})

const formData = reactive<KBCreateParams>({
  name: '',
  type: 'document',
  description: '',
  embedding_model_id: 'Qwen/Qwen3-Embedding-0.6B',
})

const columns: TableProps['columns'] = [
  { colKey: 'name', title: '名称', ellipsis: true },
  { colKey: 'type', title: '类型', width: 100 },
  { colKey: 'description', title: '描述', ellipsis: true },
  { colKey: 'op', title: '操作', width: 140, align: 'center' },
]

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listKnowledgeBases(pagination.current, pagination.pageSize)
    knowledgeBases.value = res.items
    pagination.total = res.total
  } finally {
    loading.value = false
  }
}

const handlePageChange = (pageInfo: { current: number; pageSize: number }) => {
  pagination.current = pageInfo.current
  pagination.pageSize = pageInfo.pageSize
  fetchData()
}

const handleCreate = async () => {
  if (!formData.name?.trim()) {
    MessagePlugin.warning('请输入知识库名称')
    return
  }
  creating.value = true
  try {
    await createKnowledgeBase(formData)
    MessagePlugin.success('创建成功')
    showCreateDialog.value = false
    formData.name = ''
    formData.description = ''
    fetchData()
  } finally {
    creating.value = false
  }
}

const goToDetail = (id: string) => {
  router.push(`/knowledge-bases/${id}`)
}

const handleDelete = async (id: string) => {
  try {
    await deleteKnowledgeBase(id)
    MessagePlugin.success('删除成功')
    fetchData()
  } catch {
    MessagePlugin.error('删除失败')
  }
}

onMounted(fetchData)
</script>

<style scoped>
.kb-list {
  max-width: 1200px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
</style>
