<template>
  <div class="empty-state">
    <t-icon :name="icon" size="48px" class="empty-state-icon" />
    <p class="empty-state-text">{{ text }}</p>
    <div class="empty-state-actions">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ text: string; icon?: string }>(), {
  icon: 'inbox',
})
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  gap: 12px;
}

.empty-state-icon {
  color: var(--td-gray-color-5);
}

.empty-state-text {
  font-size: 14px;
  color: var(--td-text-color-secondary);
}
</style>
