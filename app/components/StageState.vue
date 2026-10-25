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
  <div class="stage-state" :data-state="state" role="status" aria-live="polite">
    <div v-if="state === 'loading'" class="stage-state__loading">
      <div class="stage-state__skeleton" aria-hidden="true">
        <span class="skeleton skeleton--hud" />
        <span class="skeleton skeleton--plate" />
        <span class="skeleton skeleton--desk skeleton--desk-a" />
        <span class="skeleton skeleton--desk skeleton--desk-b" />
      </div>
      <p class="stage-state__loading-text">Preparando la oficina…</p>
    </div>

    <div v-else class="empty-card stage-state__card">
      <AppIcon v-if="state === 'error'" name="alert" :size="30" class="stage-state__icon" />
      <span v-else class="stage-state__icon" aria-hidden="true">◍</span>
      <h1>{{ title ?? (state === 'error' ? 'No se pudo cargar la oficina' : 'La oficina está vacía') }}</h1>
      <p>
        {{ message ?? (state === 'error' ? 'Revisa la conexión e inténtalo de nuevo.' : 'No hay agentes conectados. Inicia el servicio y vuelve a intentarlo.') }}
      </p>
      <code v-if="state === 'empty'" class="empty-card__code">opencode serve --port 4096</code>
      <p v-if="cause" class="empty-card__error">{{ cause }}</p>
      <button
        v-if="actionLabel"
        type="button"
        class="btn btn--primary"
        :disabled="busy"
        @click="$emit('action')"
      >
        {{ busy ? 'Conectando…' : actionLabel }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.stage-state {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  z-index: 2;
}

.stage-state__loading {
  display: grid;
  gap: 0.9rem;
  justify-items: center;
  width: min(34rem, 90%);
}

.stage-state__skeleton {
  position: relative;
  width: 100%;
  height: 19rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-soft);
  background:
    radial-gradient(60% 45% at 50% 38%, rgba(125, 211, 252, 0.08), transparent 70%),
    var(--panel);
  overflow: hidden;
}

.skeleton {
  position: absolute;
  display: block;
  border-radius: var(--radius-sm);
  background: linear-gradient(90deg, var(--panel-2), var(--panel-3), var(--panel-2));
  background-size: 200% 100%;
  animation: skeleton 1.6s var(--ease-in-out) infinite;
}

.skeleton--hud {
  top: 1rem;
  left: 1rem;
  right: 1rem;
  height: 2rem;
}

.skeleton--plate {
  left: 12%;
  right: 12%;
  bottom: 2.2rem;
  height: 9rem;
  border-radius: 50% / 26%;
}

.skeleton--desk {
  bottom: 6.4rem;
  width: 5.5rem;
  height: 3.2rem;
}

.skeleton--desk-a {
  left: 20%;
}

.skeleton--desk-b {
  right: 20%;
}

.stage-state__loading-text {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-sm);
}

.stage-state__card {
  max-width: min(34rem, 92%);
}

.stage-state__icon {
  color: var(--accent);
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
  .skeleton {
    animation: none;
  }
}
</style>
