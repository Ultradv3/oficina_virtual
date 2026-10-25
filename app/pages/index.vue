<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useOffice } from '~/composables/useOffice'
import { statusMeta, STATUS_META } from '~/utils/status'
import { QUALITY_PROFILES, type QualityLevel } from '~/utils/perf-budget'
import StageState from '~/components/StageState.vue'
import SoundToggle from '~/components/SoundToggle.vue'

definePageMeta({ ssr: false })

useHead({
  title: 'Agent Office · Supervisión de agentes',
})

const office = useOffice()
const composerOpen = ref(false)
const composerAgent = ref<string | null>(null)
const panelOpen = ref(false)
const sceneQuality = ref<{ level: QualityLevel; fps: number } | null>(null)
const SIDEBAR_KEY = 'agent-office-sidebar-collapsed'

function readSidebarPreference(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

const sidebarCollapsed = ref(readSidebarPreference())

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

const accessibilitySummary = computed(() => {
  const current = counts.value
  return `${agents.value.length} agentes. ${current?.working ?? 0} trabajando, ${current?.waiting_approval ?? 0} esperando aprobación, ${current?.error ?? 0} con error.`
})

const stageState = computed<'loading' | 'empty' | 'error'>(() => {
  if (office.loadError.value) return 'error'
  if (office.loading.value) return 'loading'
  return 'empty'
})

const stageCause = computed(
  () => primaryConnection.value?.error ?? office.loadError.value ?? undefined,
)

const stageActionLabel = computed(() =>
  primaryConnection.value ? 'Reconectar ahora' : 'Reintentar',
)

const stageBusy = computed(
  () =>
    office.refreshing.value ||
    (primaryConnection.value
      ? office.busy.value === `reconnect:${primaryConnection.value.id}`
      : false),
)

async function retryStage() {
  if (primaryConnection.value) {
    await office.reconnect(primaryConnection.value.id)
  }
  await office.retryState()
}

const legend = computed(() =>
  (Object.keys(STATUS_META) as Array<keyof typeof STATUS_META>).map((key) => ({
    key,
    ...statusMeta(key),
  })),
)

onMounted(() => {
  void office.bootstrap()
})

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  try {
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.value ? '1' : '0')
  } catch {
    // La preferencia es cosmética: si no se puede persistir, la sesión sigue.
  }
}

onBeforeUnmount(() => {
  office.dispose()
})

function openComposer(agentId: string | null = null) {
  composerAgent.value = agentId
  composerOpen.value = true
}

function onSceneQuality(level: QualityLevel, fps: number) {
  sceneQuality.value = { level, fps }
}
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#office-workspace">Saltar al contenido principal</a>
    <p class="sr-only" role="status" aria-live="polite">{{ accessibilitySummary }}</p>

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

        <SoundToggle />

        <button
          type="button"
          class="btn btn--ghost btn--sm sidebar-toggle"
          :aria-expanded="!sidebarCollapsed"
          aria-controls="agent-panel"
          :title="sidebarCollapsed ? 'Mostrar panel lateral' : 'Ocultar panel lateral'"
          :aria-label="sidebarCollapsed ? 'Mostrar panel lateral' : 'Ocultar panel lateral'"
          @click="toggleSidebar"
        >
          {{ sidebarCollapsed ? 'Mostrar panel' : 'Ocultar panel' }}
        </button>

        <button
          type="button"
          class="btn btn--ghost btn--sm panel-toggle"
          :aria-expanded="panelOpen"
          aria-controls="agent-panel"
          @click="panelOpen = !panelOpen"
        >
          Panel
        </button>

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

    <main id="office-workspace" class="workspace" :class="{ 'is-panel-hidden': sidebarCollapsed }" tabindex="-1">
      <section class="stage" aria-label="Oficina de agentes">
        <OfficeScene
          v-if="hasAgents"
          :agents="agents"
          :tasks="office.state.value?.tasks ?? []"
          :selected-id="office.selectedId.value"
          aria-hidden="true"
          @quality="onSceneQuality"
          @select="office.selectAgent($event)"
        />

        <StageState
          v-if="!hasAgents"
          :state="stageState"
          :cause="stageCause"
          :action-label="stageActionLabel"
          :busy="stageBusy"
          @action="retryStage"
        />

        <section class="sr-only" aria-labelledby="accessible-agents-title">
          <h2 id="accessible-agents-title">Agentes y estados</h2>
          <ul>
            <li v-for="agent in agents" :key="agent.id">
              <button
                type="button"
                :aria-pressed="office.selectedId.value === agent.id"
                @click="office.selectAgent(agent.id)"
              >
                {{ agent.name }} — {{ statusMeta(agent.status).label }} — {{ agent.currentTask ?? 'sin tarea activa' }}
              </button>
            </li>
          </ul>
        </section>

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
            <span
              v-if="sceneQuality && sceneQuality.fps > 0"
              class="scene-quality"
              :data-quality="sceneQuality.level"
              :title="`Calidad de escena: ${QUALITY_PROFILES[sceneQuality.level].label}`"
              aria-hidden="true"
            >
              Calidad {{ QUALITY_PROFILES[sceneQuality.level].label }} · {{ sceneQuality.fps }} fps
            </span>
          </div>
        </div>
      </section>

      <AgentPanel
        id="agent-panel"
        :drawer-open="panelOpen"
        @new-task="openComposer($event)"
        @close-drawer="panelOpen = false"
      />
    </main>

    <div v-if="panelOpen" class="drawer-backdrop" @click="panelOpen = false" />

    <TaskComposer
      :open="composerOpen"
      :agent-id="composerAgent"
      @close="composerOpen = false"
    />
    <TaskDrawer />
    <ToastStack />
  </div>
</template>
