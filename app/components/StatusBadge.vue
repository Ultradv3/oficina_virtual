<script setup lang="ts">
import { computed } from 'vue'
import type { AgentStatus } from '~/types/office'
import { statusMeta } from '~/utils/status'

const props = defineProps<{
  status: AgentStatus
  pulse?: boolean
  compact?: boolean
}>()

const meta = computed(() => statusMeta(props.status))
</script>

<template>
  <span
    class="status-badge"
    :class="{ 'status-badge--compact': compact }"
    :style="{ '--tone': meta.color, '--tone-soft': meta.soft }"
  >
    <span class="status-badge__dot" :class="{ 'is-pulse': pulse }" />
    {{ meta.label }}
  </span>
</template>
