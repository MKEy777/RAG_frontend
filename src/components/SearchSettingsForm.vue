<template>
  <div class="search-settings">
    <div class="strategy-group">
      <div
        v-for="opt in strategies"
        :key="opt.value"
        class="strategy-item"
        :class="{ active: model.strategy === opt.value }"
        @click="update('strategy', opt.value)"
      >
        <div class="strategy-head">
          <span class="strategy-radio" :class="{ checked: model.strategy === opt.value }" />
          <span class="strategy-name">{{ opt.label }}</span>
          <t-tag v-if="opt.recommended" theme="primary" variant="light" size="small">推荐</t-tag>
        </div>
        <p class="strategy-desc">{{ opt.desc }}</p>
      </div>
    </div>

    <div v-if="model.strategy === 'hybrid'" class="weight-row">
      <span class="weight-label">关键词 {{ model.keywordWeight.toFixed(1) }}</span>
      <t-slider
        :value="model.vectorWeight * 100"
        :min="0"
        :max="100"
        :step="5"
        @change="(v: number) => handleWeightChange(v)"
      />
      <span class="weight-label">语义 {{ model.vectorWeight.toFixed(1) }}</span>
    </div>

    <div class="params-row">
      <div class="param-item">
        <label>最大返回数量</label>
        <t-input-number
          :value="model.topK"
          :min="1"
          :max="100"
          :step="1"
          size="small"
          theme="column"
          @change="(v: number) => update('topK', v)"
        />
      </div>
      <div class="param-item">
        <label>最小匹配度</label>
        <div class="param-inline">
          <t-input-number
            :value="model.minScore"
            :min="0"
            :max="1"
            :step="0.05"
            :decimal-places="2"
            :disabled="!model.minScoreEnabled"
            size="small"
            theme="column"
            @change="(v: number) => update('minScore', v)"
          />
          <t-checkbox
            :checked="model.minScoreEnabled"
            @change="(v: boolean) => update('minScoreEnabled', v)"
          >启用</t-checkbox>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface SearchSettings {
  strategy: 'hybrid' | 'vector' | 'fulltext'
  vectorWeight: number
  keywordWeight: number
  topK: number
  minScore: number
  minScoreEnabled: boolean
}

const props = defineProps<{ modelValue: SearchSettings }>()
const emit = defineEmits<{ 'update:modelValue': [value: SearchSettings] }>()

const model = computed(() => props.modelValue)

const strategies = [
  {
    value: 'hybrid' as const,
    label: '混合检索',
    recommended: true,
    desc: '同时执行全文检索和向量检索，并应用重排序步骤，从两类查询结果中选择匹配用户问题的最佳结果',
  },
  {
    value: 'vector' as const,
    label: '向量检索',
    recommended: false,
    desc: '通过生成查询嵌入并查询与其向量表示最相似的文本分段',
  },
  {
    value: 'fulltext' as const,
    label: '全文检索',
    recommended: false,
    desc: '索引文档中的所有词汇，从而允许用户查询任意词汇，并返回包含这些词汇的文本片段',
  },
]

const update = (key: keyof SearchSettings, value: unknown) => {
  emit('update:modelValue', { ...model.value, [key]: value })
}

const handleWeightChange = (v: number) => {
  const vw = v / 100
  emit('update:modelValue', { ...model.value, vectorWeight: vw, keywordWeight: Math.round((1 - vw) * 100) / 100 })
}
</script>

<style scoped>
.search-settings {
  display: flex;
  flex-direction: column;
  gap: var(--kl-space-4);
}

.strategy-group {
  display: flex;
  flex-direction: column;
  gap: var(--kl-space-2);
}

.strategy-item {
  padding: var(--kl-space-3) var(--kl-space-4);
  border: var(--kl-border-width) solid var(--kl-border-color);
  border-radius: var(--kl-radius-md);
  cursor: pointer;
  transition: border-color var(--kl-duration-fast) var(--kl-ease-default);
}

.strategy-item.active {
  border-color: var(--kl-accent);
  background: var(--kl-accent-light);
}

.strategy-head {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
}

.strategy-radio {
  width: 16px;
  height: 16px;
  border-radius: var(--kl-radius-full);
  border: 2px solid var(--td-gray-color-5);
  flex-shrink: 0;
  transition: border-color var(--kl-duration-fast) var(--kl-ease-default);
}

.strategy-radio.checked {
  border-color: var(--kl-accent);
  background: var(--kl-accent);
  box-shadow: inset 0 0 0 3px #fff;
}

.strategy-name {
  font-size: var(--kl-text-base);
  font-weight: var(--kl-weight-medium);
  color: var(--td-text-color-primary);
}

.strategy-desc {
  margin: var(--kl-space-1) 0 0 var(--kl-space-6);
  font-size: var(--kl-text-sm);
  color: var(--td-text-color-secondary);
  line-height: var(--kl-leading-normal);
}

.weight-row {
  display: flex;
  align-items: center;
  gap: var(--kl-space-3);
}

.weight-label {
  font-size: var(--kl-text-sm);
  color: var(--td-text-color-secondary);
  white-space: nowrap;
  min-width: 72px;
}

.weight-label:last-child {
  text-align: right;
}

.params-row {
  display: flex;
  gap: var(--kl-space-6);
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: var(--kl-space-1);
}

.param-item label {
  font-size: var(--kl-text-sm);
  color: var(--td-text-color-secondary);
}

.param-inline {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
}
</style>
