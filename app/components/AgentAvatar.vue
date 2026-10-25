<script setup lang="ts">
import { computed } from 'vue'
import type { AgentStatus } from '~/types/office'
import { minifigHair, minifigTorso, minifigVariant } from '~/utils/lego'
import { useAgentPortraits } from '~/composables/useAgentPortraits'

const props = defineProps<{
  agentId: string
  name: string
  status?: AgentStatus
  size?: number
}>()

const { portraits } = useAgentPortraits()
const portrait = computed(() => portraits.value[props.agentId])
const torso = computed(() => minifigTorso(props.name))
const hair = computed(() => minifigHair(props.name))
const variant = computed(() => minifigVariant(props.name))
const alt = computed(() => portrait.value?.alt ?? `Minifigura de ${props.name}`)
const dimension = computed(() => `${props.size ?? 38}px`)
</script>

<template>
  <span
    class="agent-avatar agent-avatar--portrait"
    :style="{
      '--avatar': torso,
      width: dimension,
      height: dimension,
    }"
  >
    <img v-if="portrait" :src="portrait.url" :alt="alt">
    <svg v-else viewBox="0 0 48 48" role="img" :aria-label="alt">
      <rect width="48" height="48" fill="#0d1621" />
      <rect x="8" y="42" width="32" height="6" rx="2" fill="#111c26" />
      <!-- torso y brazos -->
      <rect x="16" y="28" width="16" height="13" rx="2.5" :fill="torso" />
      <rect x="11" y="29" width="5" height="10" rx="2" :fill="torso" />
      <rect x="32" y="29" width="5" height="10" rx="2" :fill="torso" />
      <!-- cabeza -->
      <circle cx="24" cy="19" r="9.5" fill="#ffd83f" />
      <circle cx="20.6" cy="18" r="1.35" fill="#151515" />
      <circle cx="27.4" cy="18" r="1.35" fill="#151515" />
      <path d="M20.5 23.2c2.2 1.6 4.8 1.6 7 0" stroke="#151515" stroke-width="1.2" fill="none" stroke-linecap="round" />
      <!-- variantes -->
      <template v-if="variant === 0">
        <path d="M14.8 15.4a9.4 9.4 0 0 1 18.4 0z" fill="#f2cd37" />
        <rect x="14.5" y="14.2" width="19" height="2.4" rx="1.2" fill="#e0a92e" />
      </template>
      <template v-else-if="variant === 3">
        <path d="M14.8 16.2a9.4 9.4 0 0 1 18.4 0z" fill="#1d3350" />
      </template>
      <template v-else>
        <path d="M14.6 17.4c0-6.2 4.2-9.8 9.4-9.8s9.4 3.6 9.4 9.8c-1.8-2.6-4.6-4-9.4-4s-7.6 1.4-9.4 4z" :fill="hair" />
      </template>
      <template v-if="variant === 1 || variant === 3">
        <path d="M13.8 17.6v-1.4a10.2 10.2 0 0 1 20.4 0v1.4" stroke="#232a33" stroke-width="2" fill="none" />
        <rect x="12.2" y="15.4" width="4" height="7" rx="2" fill="#232a33" />
        <rect x="31.8" y="15.4" width="4" height="7" rx="2" fill="#232a33" />
      </template>
    </svg>
  </span>
</template>

<style scoped>
.agent-avatar--portrait {
  overflow: hidden;
  padding: 0;
}

.agent-avatar--portrait img,
.agent-avatar--portrait svg {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
</style>
