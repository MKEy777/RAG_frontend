<template>
  <div class="fastpath-view">
    <PageHeader title="快路径" subtitle="高频问题预生成 · 命中即返回 · 语义缓存兜底" />

    <div class="stat-row">
      <div class="stat-item">
        <div class="stat-value">{{ stats.hit_rate ? (stats.hit_rate * 100).toFixed(1) : 0 }}%</div>
        <div class="stat-label">快路径命中率（exact+semantic+cache）</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ stats.total_hits }}</div>
        <div class="stat-label">
          总查询日志 · exact {{ stats.by_layer.exact || 0 }} / semantic {{ stats.by_layer.semantic || 0 }} /
          cache {{ stats.by_layer.cache || 0 }} / miss {{ stats.by_layer.miss || 0 }}
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ stats.active_entries }}/{{ stats.total_entries }}</div>
        <div class="stat-label">激活条目 / 总条目 · 语义缓存 {{ stats.cache_entries }} 条</div>
      </div>
    </div>

    <t-card :bordered="false" class="main-card">
      <template #title>
        <div class="card-title-row">
          <span>快路径管理</span>
          <t-select
            v-model="kbId"
            :options="kbOptions"
            :loading="kbLoading"
            placeholder="选择知识库"
            clearable
            size="small"
            style="width: 220px"
            @change="onKbChange"
          />
        </div>
      </template>

      <t-tabs v-model="tab" @change="onTabChange">
        <!-- 条目管理 -->
        <t-tab-panel value="entries" label="条目管理">
          <div class="toolbar">
            <t-radio-group v-model="statusFilter" variant="default-filled" size="small" @change="loadEntries">
              <t-radio-button value="">全部</t-radio-button>
              <t-radio-button value="active">激活</t-radio-button>
              <t-radio-button value="draft">草稿</t-radio-button>
              <t-radio-button value="stale">失效</t-radio-button>
              <t-radio-button value="disabled">停用</t-radio-button>
            </t-radio-group>
            <t-button theme="primary" size="small" :disabled="!kbId" @click="openCreateDialog">
              <template #icon><t-icon name="add" /></template>新建条目
            </t-button>
          </div>

          <t-table
            :data="entries"
            :columns="entryColumns"
            row-key="id"
            :hover="true"
            :loading="entriesLoading"
            size="medium"
          >
            <template #status="{ row }">
              <t-tag :theme="statusTheme(row.status)" size="small">{{ statusText(row.status) }}</t-tag>
            </template>
            <template #source="{ row }">
              <t-tag theme="default" variant="light" size="small">{{ sourceText(row.source) }}</t-tag>
            </template>
            <template #operation="{ row }">
              <t-button variant="text" size="small" @click="openEditDialog(row)">编辑</t-button>
              <t-button
                v-if="row.status !== 'active'"
                variant="text"
                theme="success"
                size="small"
                @click="handleActivate(row)"
              >激活</t-button>
              <t-button
                v-if="row.status === 'active'"
                variant="text"
                theme="warning"
                size="small"
                @click="handleDisable(row)"
              >停用</t-button>
              <t-popconfirm content="确认删除该条目？" @confirm="handleDelete(row)">
                <t-button variant="text" theme="danger" size="small">删除</t-button>
              </t-popconfirm>
            </template>
          </t-table>
        </t-tab-panel>

        <!-- 候选问句 -->
        <t-tab-panel value="candidates" label="候选问句">
          <div class="toolbar">
            <span class="toolbar-hint">
              FAQ 自动生成问句（共 {{ faqCandidates.length }} 条，未升级 {{ unPromoted.length }} 条）
            </span>
            <div class="toolbar-actions">
              <t-checkbox v-model="onlyUnPromoted" size="small">只看未升级</t-checkbox>
              <t-button theme="primary" size="small" :disabled="!selectedFaq.length || !kbId" @click="handlePromote">
                <template #icon><t-icon name="check-circle" /></template>升级所选（{{ selectedFaq.length }}）
              </t-button>
              <t-button theme="warning" variant="outline" size="small" :loading="mining" :disabled="!kbId" @click="handleMine">
                <template #icon><t-icon name="search" /></template>离线挖掘
              </t-button>
            </div>
          </div>

          <t-table
            :data="displayFaqCandidates"
            :columns="faqColumns"
            row-key="chunk_id"
            :hover="true"
            :loading="faqLoading"
          >
            <template #promoted="{ row }">
              <t-tag v-if="row.promoted" theme="success" variant="light" size="small">已升级</t-tag>
              <t-tag v-else theme="default" variant="light" size="small">未升级</t-tag>
            </template>
          </t-table>
        </t-tab-panel>

        <!-- 语义缓存 -->
        <t-tab-panel value="cache" label="语义缓存">
          <t-table
            :data="cacheItems"
            :columns="cacheColumns"
            row-key="id"
            :hover="true"
            :loading="cacheLoading"
          >
            <template #operation="{ row }">
              <t-popconfirm content="确认清除该缓存条目？" @confirm="handleDeleteCache(row)">
                <t-button variant="text" theme="danger" size="small">清除</t-button>
              </t-popconfirm>
            </template>
          </t-table>
        </t-tab-panel>
      </t-tabs>
    </t-card>

    <!-- 新建/编辑条目对话框 -->
    <t-dialog
      v-model:visible="dialogVisible"
      :header="editingId ? '编辑快路径条目' : '新建快路径条目'"
      :confirm-btn="{ content: '保存', loading: saving }"
      @confirm="handleSave"
    >
      <t-form :data="form" label-width="100">
        <t-form-item label="知识库" required>
          <t-select v-model="form.kb_id" :options="kbOptions" :disabled="!!editingId" placeholder="选择知识库" />
        </t-form-item>
        <t-form-item label="标准问法" required>
          <t-input v-model="form.canonical_query" placeholder="如：重疾险等待期是多久" />
        </t-form-item>
        <t-form-item label="相似问法">
          <t-tag-input
            v-model="form.example_queries"
            placeholder="回车添加同义问法"
            clearable
          />
        </t-form-item>
        <t-form-item label="答案模板">
          <t-textarea
            v-model="form.answer_template"
            :autosize="{ minRows: 2, maxRows: 6 }"
            placeholder="支持 {变量} 占位，如：根据{product_name}条款，等待期为{waiting_period}天"
          />
        </t-form-item>
        <t-form-item label="目标切片 ID">
          <t-input v-model="form.target_chunk_id" placeholder="定位到的 chunk_id（可在切片页复制）" />
        </t-form-item>
        <t-form-item label="目标文档 ID">
          <t-input v-model="form.target_document_id" placeholder="chunk 所属文档 id（可留空）" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import { listKnowledgeBases } from '@/api/knowledgeBase'
import {
  activateEntry,
  createEntry,
  deleteCacheEntry,
  deleteEntry,
  disableEntry,
  getStats,
  listCache,
  listEntries,
  listFaqCandidates,
  mine,
  promoteFaq,
  updateEntry,
  type CacheEntry,
  type FastPathEntry,
  type FaqCandidate,
  type FastPathStats,
} from '@/api/fastpath'

const kbOptions = ref<{ label: string; value: string }[]>([])
const kbLoading = ref(false)
const kbId = ref('')

const tab = ref('entries')
const statusFilter = ref('')
const entries = ref<FastPathEntry[]>([])
const entriesLoading = ref(false)

const faqCandidates = ref<FaqCandidate[]>([])
const faqLoading = ref(false)
const onlyUnPromoted = ref(false)
const selectedFaq = ref<string[]>([])
const mining = ref(false)

const cacheItems = ref<CacheEntry[]>([])
const cacheLoading = ref(false)

const stats = ref<FastPathStats>({
  total_hits: 0,
  by_layer: {},
  hit_rate: 0,
  avg_duration_ms: {},
  total_entries: 0,
  active_entries: 0,
  cache_entries: 0,
})

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const form = ref({
  kb_id: '',
  canonical_query: '',
  example_queries: [] as string[],
  answer_template: '',
  target_chunk_id: '',
  target_document_id: '',
})

const statusText = (s: string) => ({ active: '激活', draft: '草稿', stale: '失效', disabled: '停用' })[s] || s
const sourceText = (s: string) => ({ faq: 'FAQ升级', manual: '手工', mined: '挖掘' })[s] || s
const statusTheme = (s: string) =>
  ({ active: 'success', draft: 'warning', stale: 'danger', disabled: 'default' })[s] || 'default'

const entryColumns = [
  { colKey: 'canonical_query', title: '标准问法', ellipsis: true, width: 220 },
  { colKey: 'answer_template', title: '答案模板', ellipsis: true, minWidth: 260 },
  { colKey: 'status', title: '状态', width: 90 },
  { colKey: 'source', title: '来源', width: 100 },
  { colKey: 'hit_count', title: '命中', width: 70 },
  { colKey: 'operation', title: '操作', width: 170, fixed: 'right' },
]

const faqColumns = [
  { colKey: 'question', title: '问句', ellipsis: true, minWidth: 300 },
  { colKey: 'promoted', title: '状态', width: 100 },
]

const cacheColumns = [
  { colKey: 'query_text', title: '问句', ellipsis: true, width: 220 },
  { colKey: 'answer_text', title: '答案（截断）', ellipsis: true, minWidth: 260 },
  { colKey: 'hit_count', title: '命中', width: 70 },
  { colKey: 'created_at', title: '创建时间', width: 170 },
  { colKey: 'operation', title: '操作', width: 90 },
]

const displayFaqCandidates = computed(() =>
  onlyUnPromoted.value ? faqCandidates.value.filter((c) => !c.promoted) : faqCandidates.value
)

const unPromoted = computed(() => faqCandidates.value.filter((c) => !c.promoted))

function openCreateDialog() {
  editingId.value = null
  form.value = {
    kb_id: kbId.value,
    canonical_query: '',
    example_queries: [],
    answer_template: '',
    target_chunk_id: '',
    target_document_id: '',
  }
  dialogVisible.value = true
}

function openEditDialog(row: FastPathEntry) {
  editingId.value = row.id
  form.value = {
    kb_id: row.kb_id,
    canonical_query: row.canonical_query,
    example_queries: [...(row.example_queries || [])],
    answer_template: row.answer_template || '',
    target_chunk_id: row.target_chunk_id || '',
    target_document_id: row.target_document_id || '',
  }
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.value.canonical_query.trim() || !form.value.kb_id) {
    MessagePlugin.warning('请填写标准问法并选择知识库')
    return
  }
  saving.value = true
  try {
    const payload = {
      kb_id: form.value.kb_id,
      canonical_query: form.value.canonical_query.trim(),
      example_queries: form.value.example_queries,
      answer_template: form.value.answer_template,
      target_chunk_id: form.value.target_chunk_id || null,
      target_document_id: form.value.target_document_id || null,
    }
    if (editingId.value) {
      await updateEntry(editingId.value, payload)
      MessagePlugin.success('已更新')
    } else {
      await createEntry(payload)
      MessagePlugin.success('已创建')
    }
    dialogVisible.value = false
    await loadEntries()
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false
  }
}

async function handleActivate(row: FastPathEntry) {
  try {
    await activateEntry(row.id)
    MessagePlugin.success('已激活')
    await loadEntries()
  } catch {
    /* noop */
  }
}

async function handleDisable(row: FastPathEntry) {
  try {
    await disableEntry(row.id)
    MessagePlugin.success('已停用')
    await loadEntries()
  } catch {
    /* noop */
  }
}

async function handleDelete(row: FastPathEntry) {
  try {
    await deleteEntry(row.id)
    MessagePlugin.success('已删除')
    await loadEntries()
  } catch {
    /* noop */
  }
}

async function handlePromote() {
  if (!kbId.value || !selectedFaq.value.length) return
  try {
    const { count } = await promoteFaq(kbId.value, selectedFaq.value)
    MessagePlugin.success(`已升级 ${count} 条 FAQ 问句`)
    selectedFaq.value = []
    await loadFaqCandidates()
    await loadEntries()
    await loadStats()
  } catch {
    /* noop */
  }
}

async function handleMine() {
  if (!kbId.value) return
  mining.value = true
  try {
    const { created } = await mine(kbId.value)
    MessagePlugin.success(`挖掘完成，生成 ${created} 条草稿`)
    await loadEntries()
    await loadFaqCandidates()
  } catch {
    /* noop */
  } finally {
    mining.value = false
  }
}

async function handleDeleteCache(row: CacheEntry) {
  try {
    await deleteCacheEntry(row.id)
    MessagePlugin.success('缓存已清除')
    await loadCache()
    await loadStats()
  } catch {
    /* noop */
  }
}

async function loadEntries() {
  if (!kbId.value) {
    entries.value = []
    return
  }
  entriesLoading.value = true
  try {
    const res = await listEntries(kbId.value, statusFilter.value || undefined)
    entries.value = res.items
  } catch {
    /* noop */
  } finally {
    entriesLoading.value = false
  }
}

async function loadFaqCandidates() {
  if (!kbId.value) {
    faqCandidates.value = []
    return
  }
  faqLoading.value = true
  try {
    const res = await listFaqCandidates(kbId.value)
    faqCandidates.value = res.items
  } catch {
    /* noop */
  } finally {
    faqLoading.value = false
  }
}

async function loadCache() {
  if (!kbId.value) {
    cacheItems.value = []
    return
  }
  cacheLoading.value = true
  try {
    const res = await listCache(kbId.value)
    cacheItems.value = res.items
  } catch {
    /* noop */
  } finally {
    cacheLoading.value = false
  }
}

async function loadStats() {
  if (!kbId.value) {
    stats.value = { total_hits: 0, by_layer: {}, hit_rate: 0, avg_duration_ms: {}, total_entries: 0, active_entries: 0, cache_entries: 0 }
    return
  }
  try {
    stats.value = await getStats(kbId.value)
  } catch {
    /* noop */
  }
}

function onKbChange() {
  selectedFaq.value = []
  loadEntries()
  loadFaqCandidates()
  loadCache()
  loadStats()
}

function onTabChange(value: string | number) {
  if (value === 'cache') loadCache()
  if (value === 'candidates') loadFaqCandidates()
}

async function loadKbs() {
  kbLoading.value = true
  try {
    const res = await listKnowledgeBases(1, 100)
    kbOptions.value = (res.items || []).map((kb) => ({ label: kb.name, value: kb.id }))
    if (res.items?.length === 1) {
      kbId.value = res.items[0].id
      onKbChange()
    }
  } catch {
    /* noop */
  } finally {
    kbLoading.value = false
  }
}

onMounted(loadKbs)
</script>

<style scoped>
.stat-row {
  display: flex;
  align-items: baseline;
  gap: 32px;
  flex-wrap: wrap;
  padding: 4px 0;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--td-brand-color);
  white-space: nowrap;
}
.stat-label {
  font-size: var(--kl-text-sm);
  color: var(--td-text-color-secondary);
  line-height: 1.4;
}
.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.toolbar-hint {
  font-size: var(--kl-text-sm);
  color: var(--td-text-color-secondary);
}
</style>
