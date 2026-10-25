<script setup lang="ts">
import { useSoundscape } from '~/composables/useSoundscape'

const { enabled, toggle } = useSoundscape()
</script>

<template>
  <button
    type="button"
    class="icon-btn sound-toggle"
    :class="{ 'is-on': enabled }"
    :aria-pressed="enabled"
    :aria-label="enabled ? 'Desactivar sonido ambiental' : 'Activar sonido ambiental'"
    :title="enabled ? 'Sonido ambiental activado' : 'Activar sonido ambiental'"
    @click="toggle"
  >
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M4 9.5v5h3.6L13 19V5L7.6 9.5H4Z"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
      <path
        v-if="enabled"
        d="M16.4 8.4a5 5 0 0 1 0 7.2M18.8 5.9a8.4 8.4 0 0 1 0 12.2"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
      />
      <path
        v-else
        d="M16.5 9.5l5 5m0-5-5 5"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
      />
    </svg>
  </button>
</template>

<style scoped>
.sound-toggle {
  width: 2.15rem;
  height: 2.15rem;
  display: grid;
  place-items: center;
  color: var(--muted);
}

.sound-toggle svg {
  width: 1.05rem;
  height: 1.05rem;
}

.sound-toggle.is-on {
  color: var(--accent);
  border-color: rgba(125, 211, 252, 0.35);
  background: rgba(125, 211, 252, 0.08);
}
</style>
