<template>
  <t-table
    :data="documents"
    :columns="columns"
    :loading="loading"
    row-key="id"
    :selected-row-keys="selectedIds"
    :pagination="pagination"
    @page-change="(info: { current: number; pageSize: number }) => emit('page-change', info)"
    @select-change="(keys: (string | number)[]) => emit('select-change', keys as string[])"
  >
    <template #file_name="{ row }">
      <span
        class="file-name-link"
        :class="{ disabled: row.parse_status !== 'completed' }"
        @click="row.parse_status === 'completed' && emit('row-action', 'chunks', row)"
      >{{ row.file_name || row.title }}</span>
    </template>
    <template #doc_id="{ row }">
      <span class="doc-id">{{ row.id.slice(0, 8) }}</span>
    </template>
    <template #parse_status="{ row }">
      <span class="status-dot" :class="row.parse_status" />
      <span class="status-text">{{ statusText(row.parse_status) }}</span>
    </template>
    <template #file_type="{ row }">
      <span>{{ row.file_type ?? '-' }}</span>
    </template>
    <template #wiki_status="{ row }">
      <span v-if="row.wiki_status === 'completed'" class="wiki-yes">✓</span>
      <span v-else class="wiki-no">—</span>
    </template>
    <template #op="{ row }">
      <t-space size="0">
        <t-button variant="text" theme="primary" size="small" @click="emit('row-action', 'info', row)">详情</t-button>
        <t-button
          v-if="row.parse_status === 'failed'"
          variant="text"
          theme="warning"
          size="small"
          @click="emit('row-action', 'reparse', row)"
        >重试</t-button>
        <t-dropdown
          :options="moreOptions(row)"
          trigger="click"
          @click="(item: { value?: string | number }) => emit('row-action', String(item.value), row)"
        >
          <t-button variant="text" theme="primary" size="small">
            更多
            <template #suffix><t-icon name="chevron-down" size="14px" /></template>
          </t-button>
        </t-dropdown>
      </t-space>
    </template>
    <template #empty>
      <slot name="empty" />
    </template>
  </t-table>
</template>

<script setup lang="ts">
import type { TableProps } from 'tdesign-vue-next'
import type { Document } from '@/api/documents'
import { statusText } from '@/utils/format'

defineProps<{
  documents: Document[]
  loading: boolean
  pagination: { current: number; pageSize: number; total: number }
  selectedIds: string[]
}>()

const emit = defineEmits<{
  'page-change': [info: { current: number; pageSize: number }]
  'select-change': [keys: string[]]
  'row-action': [action: string, row: Document]
}>()

const columns: TableProps['columns'] = [
  { colKey: 'row-select', type: 'multiple', width: 46 },
  { colKey: 'file_name', title: '文件名', ellipsis: true },
  { colKey: 'doc_id', title: '文档ID', width: 100 },
  { colKey: 'parse_status', title: '状态', width: 120 },
  { colKey: 'file_type', title: '格式', width: 80 },
  { colKey: 'wiki_status', title: 'Wiki', width: 60, align: 'center' },
  { colKey: 'op', title: '操作', width: 200, align: 'center' },
]

const moreOptions = (row: Document) => {
  const opts: { content: string; value: string; theme?: string }[] = []
  if (row.parse_status === 'completed') opts.push({ content: '查看切片', value: 'chunks' })
  opts.push({ content: '重新解析', value: 'reparse' })
  opts.push({ content: '重命名', value: 'rename' })
  opts.push({ content: '下载原文件', value: 'download' })
  opts.push({ content: '删除', value: 'delete', theme: 'error' })
  return opts
}
</script>

<style scoped>
.file-name-link {
  cursor: pointer;
  color: var(--td-text-color-primary);
  transition: color var(--kl-duration-fast) var(--kl-ease-default);
}

.file-name-link:hover {
  color: var(--kl-accent);
  text-decoration: underline;
}

.file-name-link.disabled {
  cursor: default;
  color: var(--td-text-color-secondary);
}

.file-name-link.disabled:hover {
  color: var(--td-text-color-secondary);
  text-decoration: none;
}

.doc-id {
  font-family: var(--app-font-family-mono);
  font-size: var(--kl-text-xs);
  color: var(--td-text-color-placeholder);
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: var(--kl-radius-full);
  margin-right: var(--kl-space-1);
}

.status-dot.completed {
  background: var(--td-success-color);
}

.status-dot.processing {
  background: var(--td-warning-color);
}

.status-dot.failed {
  background: var(--td-error-color);
}

.status-dot.pending {
  background: var(--td-gray-color-5);
}

.status-text {
  font-size: var(--kl-text-sm);
}

.wiki-yes {
  color: var(--td-success-color);
  font-weight: var(--kl-weight-semibold);
}

.wiki-no {
  color: var(--td-text-color-placeholder);
}
</style>
