<template>
  <div class="faq-view">
    <PageHeader title="FAQ 管理" subtitle="问答知识库条目导入与维护">
      <template #actions>
        <t-select
          v-model="kbId"
          :options="kbOptions"
          placeholder="选择知识库"
          style="width: 240px"
          @change="fetchItems"
        />
        <t-button theme="primary" :disabled="!kbId" @click="dialogVisible = true">
          <template #icon><t-icon name="add" /></template>
          新增条目
        </t-button>
      </template>
    </PageHeader>

    <t-alert
      v-if="kbId && selectedKbType !== 'faq'"
      theme="info"
      message="当前知识库不是 FAQ 类型，导入的条目不会走 FAQ 独立检索路径（建议创建 type=faq 的知识库）"
      style="margin-bottom: 16px"
    />

    <t-card :bordered="false">
      <t-table
        :data="items"
        :columns="columns"
        row-key="faq_id"
        :loading="loading"
        :empty="kbId ? '暂无 FAQ 条目' : '请先选择知识库'"
      >
        <template #similar="{ row }">
          <t-tag v-if="row.similar_questions.length" variant="light" size="small">
            {{ row.similar_questions.length }} 条
          </t-tag>
          <span v-else>-</span>
        </template>
        <template #tags="{ row }">
          <t-space size="4px">
            <t-tag v-for="tag in row.tags" :key="tag" size="small" variant="light" theme="primary">
              {{ tag }}
            </t-tag>
            <span v-if="!row.tags.length">-</span>
          </t-space>
        </template>
        <template #answer="{ row }">
          <span class="answer-preview">{{ row.answer }}</span>
        </template>
        <template #op="{ row }">
          <t-popconfirm content="确认删除该条目？向量索引将同步清理" @confirm="handleDelete(row)">
            <t-button variant="text" theme="danger" size="small">删除</t-button>
          </t-popconfirm>
        </template>
      </t-table>
    </t-card>

    <t-dialog
      v-model:visible="dialogVisible"
      header="新增 FAQ 条目"
      width="640px"
      :confirm-btn="{ content: '导入', loading: submitting }"
      @confirm="handleSubmit"
      @close="resetForm"
    >
      <t-form :data="form" label-align="top">
        <t-form-item label="标准问" required-mark>
          <t-input v-model="form.question" placeholder="用户最常见的问法" />
        </t-form-item>
        <t-form-item label="相似问" help="每条相似问会单独嵌入进向量索引">
          <t-tag-input v-model="form.similar_questions" placeholder="输入后回车添加" />
        </t-form-item>
        <t-form-item label="答案" required-mark>
          <t-textarea v-model="form.answer" :autosize="{ minRows: 3, maxRows: 8 }" placeholder="标准答案" />
        </t-form-item>
        <t-form-item label="反例问" help="不应命中该答案的问法（仅存储）">
          <t-tag-input v-model="form.negative_questions" placeholder="输入后回车添加" />
        </t-form-item>
        <t-form-item label="标签" help="检索时按知识库 tag_priority 排序">
          <t-tag-input v-model="form.tags" placeholder="输入后回车添加" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { listKnowledgeBases, type KnowledgeBase } from '@/api/knowledgeBase'
import { listFaqItems, importFaqItem, deleteFaqItem, type FaqItem } from '@/api/faq'
import PageHeader from '@/components/PageHeader.vue'

const kbId = ref('')
const kbList = ref<KnowledgeBase[]>([])
const kbOptions = ref<{ label: string; value: string }[]>([])
const items = ref<FaqItem[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const submitting = ref(false)

const selectedKbType = computed(
  () => kbList.value.find((k) => k.id === kbId.value)?.type ?? ''
)

const columns = [
  { colKey: 'question', title: '标准问', width: 240, ellipsis: true },
  { colKey: 'similar', title: '相似问', width: 90, align: 'center' as const },
  { colKey: 'answer', title: '答案', ellipsis: true },
  { colKey: 'tags', title: '标签', width: 160 },
  { colKey: 'op', title: '操作', width: 90, align: 'center' as const },
]

const form = reactive({
  question: '',
  similar_questions: [] as string[],
  answer: '',
  negative_questions: [] as string[],
  tags: [] as string[],
})

const resetForm = () => {
  form.question = ''
  form.similar_questions = []
  form.answer = ''
  form.negative_questions = []
  form.tags = []
}

const fetchItems = async () => {
  if (!kbId.value) return
  loading.value = true
  try {
    const res = await listFaqItems(kbId.value)
    items.value = res.items
  } catch {
    MessagePlugin.error('获取 FAQ 列表失败')
  } finally {
    loading.value = false
  }
}

const handleSubmit = async () => {
  if (!form.question.trim() || !form.answer.trim()) {
    MessagePlugin.warning('标准问和答案不能为空')
    return
  }
  submitting.value = true
  try {
    await importFaqItem(kbId.value, { ...form })
    MessagePlugin.success('导入成功')
    dialogVisible.value = false
    resetForm()
    fetchItems()
  } catch {
    MessagePlugin.error('导入失败')
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (row: FaqItem) => {
  try {
    await deleteFaqItem(kbId.value, row.faq_id)
    MessagePlugin.success('已删除')
    fetchItems()
  } catch {
    MessagePlugin.error('删除失败')
  }
}

onMounted(async () => {
  try {
    const res = await listKnowledgeBases(1, 100)
    kbList.value = res.items
    kbOptions.value = res.items.map((kb) => ({
      label: kb.type === 'faq' ? `${kb.name}（FAQ）` : kb.name,
      value: kb.id,
    }))
    const faqKb = res.items.find((kb) => kb.type === 'faq')
    if (faqKb) kbId.value = faqKb.id
    else if (res.items.length > 0) kbId.value = res.items[0].id
    if (kbId.value) fetchItems()
  } catch {
    // ignore
  }
})
</script>

<style scoped>
.faq-view {
  max-width: 1200px;
  margin: 0 auto;
}

.answer-preview {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--td-text-color-secondary);
}
</style>
