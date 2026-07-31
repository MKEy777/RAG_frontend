<template>
  <div class="kb-list">
    <PageHeader title="知识库" subtitle="管理你的文档知识库">
      <template #actions>
        <t-select v-model="sortBy" size="small" style="width: 130px">
          <t-option value="updated" label="最近更新" />
          <t-option value="name" label="按名称" />
        </t-select>
      </template>
    </PageHeader>

    <!-- 工作流引导条 -->
    <div class="workflow-banner">
      <div v-for="(step, i) in workflowSteps" :key="i" class="workflow-step">
        <div class="step-icon">
          <t-icon :name="step.icon" size="20px" />
        </div>
        <div class="step-text">
          <span class="step-title">{{ step.title }}</span>
          <span class="step-desc">{{ step.desc }}</span>
        </div>
        <t-icon v-if="i < workflowSteps.length - 1" name="chevron-right" size="16px" class="step-arrow" />
      </div>
    </div>

    <div class="kb-list-body">
      <!-- 左侧筛选栏 -->
      <aside class="filter-sidebar">
        <div v-if="groups.length" class="filter-group">
          <div class="filter-label">分组</div>
          <div
            v-for="g in groups"
            :key="g"
            class="filter-item"
            :class="{ active: filterGroup === g }"
            @click="filterGroup = filterGroup === g ? '' : g"
          >{{ g }}</div>
        </div>
        <div class="filter-group">
          <div class="filter-label">功能</div>
          <div
            v-for="opt in featureFilters"
            :key="opt.value"
            class="filter-item"
            :class="{ active: filterFeature === opt.value }"
            @click="filterFeature = filterFeature === opt.value ? '' : opt.value"
          >{{ opt.label }}</div>
        </div>
      </aside>

      <!-- 右侧卡片网格 -->
      <div class="kb-main">
        <div v-if="loading" class="kb-grid">
          <div v-for="i in 4" :key="i" class="kb-card skeleton-card">
            <t-skeleton :row-col="[{ width: '60%' }, { width: '100%' }, { width: '40%' }]" animation="gradient" />
          </div>
        </div>

        <div v-else class="kb-grid">
          <div class="kb-card create-card" @click="router.push('/knowledge-bases/create')">
            <t-icon name="add" size="28px" />
            <span>新建知识库</span>
          </div>

          <div
            v-for="kb in filteredBases"
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
              <t-tag v-if="kb.enable_wiki" variant="outline" size="small">Wiki</t-tag>
              <t-tag v-if="kb.enable_graph" variant="outline" size="small">图谱</t-tag>
            </div>
            <div class="kb-card-meta">
              <span>{{ kb.doc_count ?? '-' }} 个文档</span>
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import {
  listKnowledgeBases,
  deleteKnowledgeBase,
  listGroups,
  type KnowledgeBase,
} from '@/api/knowledgeBase'

const router = useRouter()
const loading = ref(false)
const knowledgeBases = ref<KnowledgeBase[]>([])
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })

const sortBy = ref('updated')
const filterFeature = ref('')
const groups = ref<string[]>([])
const filterGroup = ref('')

const workflowSteps = [
  { icon: 'cloud-upload', title: '上传文档', desc: '上传本地文件或导入网页' },
  { icon: 'precise-monitor', title: '解析切片', desc: '自动提取、解析并入库' },
  { icon: 'search', title: '命中测试', desc: '获取最佳配置，辅助调优' },
  { icon: 'api', title: 'API 调用', desc: '业务侧通过接口调用知识' },
]

const featureFilters = [
  { label: 'Wiki', value: 'wiki' },
  { label: '图谱', value: 'graph' },
]

const filteredBases = computed(() => {
  let list = knowledgeBases.value
  if (filterFeature.value === 'wiki') list = list.filter((kb) => kb.enable_wiki)
  if (filterFeature.value === 'graph') list = list.filter((kb) => kb.enable_graph)
  if (filterGroup.value) list = list.filter((kb) => kb.group_name === filterGroup.value)
  if (sortBy.value === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
  return list
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

const handleDelete = async (id: string) => {
  try {
    await deleteKnowledgeBase(id)
    MessagePlugin.success('删除成功')
    fetchData()
  } catch {
    // client 拦截器已弹错
  }
}

onMounted(async () => {
  fetchData()
  try {
    const res = await listGroups()
    groups.value = res.groups
  } catch { /* ignore */ }
})
</script>

<style scoped>
.kb-list {
  max-width: var(--kl-content-max-width);
  margin: 0 auto;
}

.workflow-banner {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
  padding: var(--kl-space-4) var(--kl-space-5);
  background: var(--kl-gradient-subtle);
  border-radius: var(--kl-radius-card);
  margin-bottom: var(--kl-space-5);
}

.workflow-step {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
  flex: 1;
}

.step-icon {
  width: var(--kl-control-height-lg);
  height: var(--kl-control-height-lg);
  border-radius: var(--kl-radius-md);
  background: var(--td-bg-color-container);
  box-shadow: var(--kl-elevation-1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--kl-accent);
  flex-shrink: 0;
}

.step-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.step-title {
  font-size: var(--kl-text-base);
  font-weight: var(--kl-weight-medium);
  color: var(--td-text-color-primary);
}

.step-desc {
  font-size: var(--kl-text-xs);
  color: var(--td-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.step-arrow {
  color: var(--td-text-color-placeholder);
  flex-shrink: 0;
}

.kb-list-body {
  display: flex;
  gap: var(--kl-space-5);
}

.filter-sidebar {
  width: var(--kl-filter-sidebar-width);
  flex-shrink: 0;
}

.filter-group {
  margin-bottom: var(--kl-space-4);
}

.filter-label {
  font-size: var(--kl-text-xs);
  font-weight: var(--kl-weight-semibold);
  color: var(--td-text-color-placeholder);
  padding: 0 var(--kl-space-2) var(--kl-space-1);
  text-transform: uppercase;
  letter-spacing: var(--kl-tracking-wide);
}

.filter-item {
  padding: var(--kl-space-1) var(--kl-space-2);
  font-size: var(--kl-text-sm);
  border-radius: var(--kl-radius-md);
  cursor: pointer;
  color: var(--td-text-color-secondary);
  transition: background var(--kl-duration-fast) var(--kl-ease-default),
    color var(--kl-duration-fast) var(--kl-ease-default);
}

.filter-item:hover {
  background: var(--td-gray-color-2);
}

.filter-item.active {
  background: var(--kl-accent-light);
  color: var(--kl-accent);
  font-weight: var(--kl-weight-medium);
}

.kb-main {
  flex: 1;
  min-width: 0;
}

.kb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--kl-space-4);
}

.kb-card {
  background: var(--td-gray-color-1);
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
  background: var(--td-bg-color-container);
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
  border: 2px dashed var(--td-component-stroke);
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

.kb-card-meta {
  display: flex;
  gap: var(--kl-space-3);
  font-size: var(--kl-text-xs);
  color: var(--td-text-color-placeholder);
  padding-top: var(--kl-space-2);
  border-top: var(--kl-border-width) solid var(--td-component-stroke);
}

.kb-pagination {
  margin-top: var(--kl-space-5);
  display: flex;
  justify-content: flex-end;
}
</style>
