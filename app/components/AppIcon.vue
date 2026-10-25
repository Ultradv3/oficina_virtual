<script setup lang="ts">
import type { StatusIcon } from '~/utils/status'

defineProps<{
  name: StatusIcon
  size?: number
}>()

const PATHS: Record<StatusIcon, string[]> = {
  check: ['M4.5 12.5l5 5 10-10.5'],
  activity: ['M3 12h4l2.5-6 5.5 12 2.5-6H21'],
  hand: [
    'M18 11V6a2 2 0 0 0-4 0v5',
    'M14 10V4a2 2 0 0 0-4 0v6',
    'M10 10.5V6a2 2 0 0 0-4 0v8a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6v-3a2 2 0 0 0-4 0v2',
  ],
  alert: ['M12 3.5 21 20H3L12 3.5Z', 'M12 9.5v5', 'M12 17.5h.01'],
  'plug-off': ['M8 3v5', 'M16 3v5', 'M6 8h12v3a6 6 0 0 1-6 6v4', 'M3 3l18 18'],
}
</script>

<template>
  <svg
    class="app-icon"
    :width="size ?? 16"
    :height="size ?? 16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="(path, index) in PATHS[name]" :key="index" :d="path" />
  </svg>
</template>

<style scoped>
.app-icon {
  flex: 0 0 auto;
  display: block;
}
</style>
