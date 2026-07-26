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
  gap: var(--kl-space-2);
  padding-bottom: var(--kl-space-2);
  margin-bottom: var(--kl-space-6);
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
  font-size: var(--kl-text-xl);
  font-weight: var(--kl-weight-medium);
  line-height: var(--kl-leading-tight);
  color: var(--td-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-header-subtitle {
  font-size: var(--kl-text-sm);
  color: var(--td-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-header-actions {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
  flex-shrink: 0;
}
</style>
