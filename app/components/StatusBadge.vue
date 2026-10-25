<script setup lang="ts">
import { computed } from 'vue'
import type { AgentStatus } from '~/types/office'
import { statusMeta } from '~/utils/status'
import AppIcon from './AppIcon.vue'

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
    role="status"
    :aria-label="meta.ariaLabel"
  >
    <AppIcon :name="meta.icon" :size="compact ? 12 : 14" />
    {{ meta.label }}
  </span>
</template>
