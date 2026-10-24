<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useOffice } from '~/composables/useOffice'
import { statusMeta, STATUS_META } from '~/utils/status'

definePageMeta({ ssr: false })

useHead({
  title: 'Agent Office · Supervisión de agentes',
})

const office = useOffice()
const composerOpen = ref(false)
const composerAgent = ref<string | null>(null)

const agents = computed(() => office.state.value?.agents ?? [])
const counts = computed(() => office.state.value?.counts)
const connections = computed(() => office.state.value?.connections ?? [])
const hasAgents = computed(() => agents.value.length > 0)

const canCreate = computed(() =>
  agents.value.some(
    (agent) =>
      agent.capabilities.includes('tasks:create') &&
      agent.status !== 'disconnected' &&
      agent.currentTask === null,
  ),
)

const primaryConnection = computed(() => connections.value[0] ?? null)

const legend = computed(() =>
  (Object.keys(STATUS_META) as Array<keyof typeof STATUS_META>).map((key) => ({
    key,
    ...statusMeta(key),
  })),
)

onMounted(() => {
  void office.bootstrap()
})

onBeforeUnmount(() => {
  office.dispose()
})

function openComposer(agentId: string | null = null) {
  composerAgent.value = agentId
  composerOpen.value = true
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand-block">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 2.6 21 7v10l-9 4.4L3 17V7l9-4.4Z" stroke="currentColor" stroke-width="1.4" />
            <path d="M3 7l9 4.4L21 7M12 11.4v10" stroke="currentColor" stroke-width="1.4" />
          </svg>
        </span>
        <div>
          <p class="brand-block__name">Agent Office</p>
          <p class="brand-block__sub">Supervisión de agentes CLI</p>
        </div>
      </div>

      <div class="topbar__connections">
        <div
          v-for="connection in connections"
          :key="connection.id"
          class="conn-chip"
          :data-status="connection.status"
          :title="connection.error || `${connection.adapter} · ${connection.status}`"
        >
          <span class="conn-chip__dot" />
          <span class="conn-chip__name">{{ connection.name }}</span>
          <span class="conn-chip__state">
            {{ connection.status === 'connected' ? 'en línea' : connection.status }}
          </span>
          <button
            v-if="connection.status !== 'connected'"
            type="button"
            class="conn-chip__retry"
            :disabled="office.busy.value === `reconnect:${connection.id}`"
            aria-label="Reconectar"
            @click="office.reconnect(connection.id)"
          >
            ↻
          </button>
        </div>
      </div>

      <div class="topbar__right">
        <div class="metrics">
          <div class="metric">
            <span class="metric__value" data-tone="working">{{ counts?.working ?? 0 }}</span>
            <span class="metric__label">trabajando</span>
          </div>
          <div class="metric">
            <span class="metric__value" data-tone="waiting">{{ counts?.waiting_approval ?? 0 }}</span>
            <span class="metric__label">aprobaciones</span>
          </div>
          <div class="metric">
            <span class="metric__value" data-tone="error">{{ counts?.error ?? 0 }}</span>
            <span class="metric__label">errores</span>
          </div>
        </div>

        <span class="live-pill" :class="{ 'is-off': !office.sseConnected.value }">
          <span class="live-pill__dot" />
          {{ office.sseConnected.value ? 'En vivo' : 'Sin stream' }}
        </span>

        <button
          type="button"
          class="btn btn--primary"
          :disabled="!canCreate"
          @click="openComposer()"
        >
          <span aria-hidden="true">+</span> Nueva tarea
        </button>
      </div>
    </header>

    <main class="workspace">
      <section class="stage">
        <OfficeScene
          v-if="hasAgents"
          :agents="agents"
          :selected-id="office.selectedId.value"
          @select="office.selectAgent($event)"
        />

        <div v-if="!hasAgents && !office.loading.value" class="empty-stage">
          <div class="empty-card">
            <span class="empty-card__icon" aria-hidden="true">◍</span>
            <h1>La oficina está vacía</h1>
            <p>
              No hay agentes conectados. Inicia un servidor de OpenCode y vuelve a intentar la
              conexión.
            </p>
            <code class="empty-card__code">opencode serve --port 4096</code>
            <p v-if="primaryConnection?.error" class="empty-card__error">
              {{ primaryConnection.error }}
            </p>
            <button
              v-if="primaryConnection"
              type="button"
              class="btn btn--primary"
              :disabled="office.busy.value === `reconnect:${primaryConnection.id}`"
              @click="office.reconnect(primaryConnection.id)"
            >
              Reconectar ahora
            </button>
          </div>
        </div>

        <div v-if="office.loading.value" class="stage-loading">
          <span class="spinner" aria-hidden="true" />
          Preparando la oficina…
        </div>

        <div class="stage-hud">
          <div class="stage-hud__top">
            <div class="legend">
              <span v-for="item in legend" :key="item.key" class="legend__item">
                <span class="legend__dot" :style="{ background: item.color }" />
                {{ item.label }}
              </span>
            </div>
            <p v-if="office.loadError.value" class="stage-error">
              {{ office.loadError.value }}
            </p>
          </div>

          <div class="stage-hud__bottom">
            <p class="stage-hint">
              Clic en un escritorio para supervisar · Arrastra para desplazar · Rueda para zoom
            </p>
          </div>
        </div>
      </section>

      <AgentPanel @new-task="openComposer($event)" />
    </main>

    <TaskComposer
      :open="composerOpen"
      :agent-id="composerAgent"
      @close="composerOpen = false"
    />
    <TaskDrawer />
    <ToastStack />
  </div>
</template>
