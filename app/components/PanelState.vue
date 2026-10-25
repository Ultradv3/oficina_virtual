<script setup lang="ts">
import AppIcon from './AppIcon.vue'

defineProps<{
  state: 'loading' | 'empty' | 'error'
  title?: string
  message?: string
  cause?: string
  actionLabel?: string
  busy?: boolean
}>()

defineEmits<{ action: [] }>()
</script>

<template>
  <div class="panel-state" :data-state="state" role="status" aria-live="polite">
    <template v-if="state === 'loading'">
      <span v-for="index in 4" :key="index" class="panel-state__skeleton" aria-hidden="true" />
    </template>

    <template v-else-if="state === 'error'">
      <AppIcon name="alert" :size="22" class="panel-state__icon" />
      <h3>{{ title ?? 'No se pudo cargar' }}</h3>
      <p class="panel-state__message">{{ message ?? cause ?? 'Inténtalo de nuevo.' }}</p>
      <button
        v-if="actionLabel"
        type="button"
        class="btn btn--ghost btn--sm"
        :disabled="busy"
        @click="$emit('action')"
      >
        {{ busy ? 'Reintentando…' : actionLabel }}
      </button>
    </template>

    <template v-else>
      <p class="empty-note">{{ title ?? 'Sin datos todavía.' }}</p>
      <p v-if="message" class="panel-state__message">{{ message }}</p>
      <button
        v-if="actionLabel"
        type="button"
        class="btn btn--ghost btn--sm"
        :disabled="busy"
        @click="$emit('action')"
      >
        {{ actionLabel }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.panel-state {
  display: grid;
  gap: 0.55rem;
  justify-items: start;
  padding: 0.35rem 0;
}

.panel-state__icon {
  color: var(--danger);
}

.panel-state h3 {
  margin: 0;
  font-size: var(--text-sm);
}

.panel-state__message {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-sm);
  line-height: 1.5;
}

.panel-state__skeleton {
  width: 100%;
  height: 3rem;
  border-radius: var(--radius-sm);
  background: linear-gradient(90deg, var(--panel-2), var(--panel-3), var(--panel-2));
  background-size: 200% 100%;
  animation: skeleton 1.6s var(--ease-in-out) infinite;
}

@keyframes skeleton {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .panel-state__skeleton {
    animation: none;
  }
}
</style>
