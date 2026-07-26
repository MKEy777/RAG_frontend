<template>
  <div class="page-header">
    <t-button
      v-if="backTo !== undefined"
      variant="text"
      shape="square"
      class="page-header-back"
      @click="handleBack"
    >
      <t-icon name="chevron-left" size="20px" />
    </t-button>
    <div class="page-header-main">
      <h2 class="page-header-title">{{ title }}</h2>
      <p v-if="subtitle" class="page-header-subtitle">{{ subtitle }}</p>
    </div>
    <div class="page-header-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const props = defineProps<{
  title: string
  subtitle?: string
  backTo?: string
}>()

const router = useRouter()

const handleBack = () => {
  if (props.backTo) router.push(props.backTo)
  else router.back()
}
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 16px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--td-component-stroke);
}

.page-header-back {
  flex-shrink: 0;
}

.page-header-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.page-header-title {
  font-size: 22px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--td-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-header-subtitle {
  font-size: 13px;
  color: var(--td-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
</style>
