import { ref, computed } from 'vue'
import { listKnowledgeBases, type KnowledgeBase } from '@/api/knowledgeBase'

const kbList = ref<KnowledgeBase[]>([])
const loading = ref(false)
let fetched = false

export function useKbList() {
  const kbOptions = computed(() =>
    kbList.value.map((kb) => ({ label: kb.name, value: kb.id }))
  )

  const getKb = (id: string) => kbList.value.find((k) => k.id === id)

  const fetchKbList = async (force = false) => {
    if (fetched && !force) return
    loading.value = true
    try {
      const res = await listKnowledgeBases(1, 100)
      kbList.value = res.items
      fetched = true
    } finally {
      loading.value = false
    }
  }

  return { kbList, kbOptions, loading, getKb, fetchKbList }
}
