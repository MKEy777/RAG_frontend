<template>
  <div class="kb-list">
    <PageHeader title="知识库" subtitle="管理你的文档知识库" />

    <div v-if="loading" class="kb-grid">
      <div v-for="i in 4" :key="i" class="kb-card skeleton-card">
        <t-skeleton :row-col="[{ width: '60%' }, { width: '100%' }, { width: '40%' }]" animation="gradient" />
      </div>
    </div>

    <div v-else class="kb-grid">
      <div class="kb-card create-card" @click="showCreateDialog = true">
        <t-icon name="add" size="28px" />
        <span>新建知识库</span>
      </div>

      <div
        v-for="kb in knowledgeBases"
        :key="kb.id"
        class="kb-card"
        @click="router.push(`/knowledge-bases/${kb.id}`)"
      >
        <div class="kb-card-head">
          <div class="kb-card-icon">
            <t-icon name="server" size="20px" />
          </div>
          <span class="kb-card-name">{{ kb.name }}</span>
          <span @click.stop>
            <t-popconfirm
              content="确定要删除这个知识库吗？删除后无法恢复。"
              @confirm="handleDelete(kb.id)"
            >
              <t-icon name="delete" class="kb-card-delete" />
            </t-popconfirm>
          </span>
        </div>
        <p class="kb-card-desc">{{ kb.description || '暂无描述' }}</p>
        <div class="kb-card-foot">
          <t-tag :theme="kb.type === 'document' ? 'primary' : 'success'" variant="light" size="small">
            {{ kb.type === 'document' ? '文档' : 'FAQ' }}
          </t-tag>
          <t-tag v-if="kb.enable_wiki" variant="outline" size="small">Wiki</t-tag>
          <t-tag v-if="kb.enable_graph" variant="outline" size="small">图谱</t-tag>
        </div>
      </div>
    </div>

    <div v-if="pagination.total > pagination.pageSize" class="kb-pagination">
      <t-pagination
        v-model="pagination.current"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        @change="fetchData"
      />
    </div>

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
        <t-form-item label="启用 Wiki" name="enable_wiki">
          <t-switch v-model="formData.enable_wiki" />
        </t-form-item>
        <t-form-item label="启用知识图谱" name="enable_graph">
          <t-switch v-model="formData.enable_graph" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import PageHeader from '@/components/PageHeader.vue'
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

const pagination = reactive({ current: 1, pageSize: 20, total: 0 })

const formData = reactive<KBCreateParams>({
  name: '',
  type: 'document',
  description: '',
  embedding_model_id: 'Qwen/Qwen3-Embedding-0.6B',
  enable_wiki: true,
  enable_graph: true,
})

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

const handleDelete = async (id: string) => {
  try {
    await deleteKnowledgeBase(id)
    MessagePlugin.success('删除成功')
    fetchData()
  } catch {
    // client 拦截器已弹错
  }
}

onMounted(fetchData)
</script>

<style scoped>
.kb-list {
  max-width: var(--kl-content-max-width);
  margin: 0 auto;
}

.kb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--kl-space-4);
}

.kb-card {
  background: #F8F9FA;
  border-radius: var(--kl-radius-card);
  padding: var(--kl-card-padding);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: var(--kl-space-3);
  min-height: 140px;
  border: none;
  box-shadow: var(--kl-elevation-1);
  transition: box-shadow var(--kl-duration-fast) var(--kl-ease-default),
    background var(--kl-duration-fast) var(--kl-ease-default);
}

.kb-card:hover {
  box-shadow: var(--kl-elevation-2);
  background: #fff;
}

.skeleton-card {
  cursor: default;
}

.skeleton-card:hover {
  background: transparent;
}

.create-card {
  align-items: center;
  justify-content: center;
  border: 2px dashed #E8EAED;
  background: transparent;
  box-shadow: none;
  color: var(--td-text-color-secondary);
  gap: var(--kl-space-2);
}

.create-card:hover {
  border-color: var(--kl-accent);
  color: var(--kl-accent);
  background: var(--kl-accent-light);
  box-shadow: none;
}

.kb-card-head {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
}

.kb-card-icon {
  width: var(--kl-control-height-md);
  height: var(--kl-control-height-md);
  border-radius: var(--kl-radius-lg);
  background: var(--kl-accent-light);
  color: var(--kl-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.kb-card-name {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: var(--kl-weight-semibold);
  color: var(--td-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kb-card-delete {
  color: var(--td-text-color-placeholder);
  transition: color var(--kl-duration-fast) var(--kl-ease-default);
}

.kb-card-delete:hover {
  color: var(--td-error-color);
}

.kb-card-desc {
  flex: 1;
  font-size: var(--kl-text-sm);
  color: var(--td-text-color-secondary);
  line-height: var(--kl-leading-normal);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}

.kb-card-foot {
  display: flex;
  gap: var(--kl-space-1);
}

.kb-pagination {
  margin-top: var(--kl-space-5);
  display: flex;
  justify-content: flex-end;
}
</style>
