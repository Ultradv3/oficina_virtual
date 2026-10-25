<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useOffice } from '~/composables/useOffice'
import { useFocusTrap } from '~/composables/useFocusTrap'
import AgentCardList from './AgentCardList.vue'
import AgentDetailPanel from './AgentDetailPanel.vue'
import EventFeed from './EventFeed.vue'
import ApprovalsPanel from './ApprovalsPanel.vue'
import AuditPanel from './AuditPanel.vue'
import PanelState from './PanelState.vue'

const props = defineProps<{ drawerOpen?: boolean }>()
const emit = defineEmits<{ 'new-task': [agentId: string]; 'close-drawer': [] }>()

const office = useOffice()
const panel = ref<HTMLElement>()
const { activate, deactivate } = useFocusTrap({ onEscape: () => emit('close-drawer') })
type Tab = 'agent' | 'activity' | 'approvals' | 'audit'
const tab = ref<Tab>('agent')
const nav = ref<HTMLElement>()
const indicator = ref({ left: '0px', width: '0px' })

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'agent', label: 'Agente' },
  { id: 'activity', label: 'Actividad' },
  { id: 'approvals', label: 'Aprobaciones' },
  { id: 'audit', label: 'Auditoría' },
]

function measureIndicator() {
  const active = nav.value?.querySelector<HTMLElement>(`[data-tab="${tab.value}"]`)
  if (!active) return
  indicator.value = { left: `${active.offsetLeft}px`, width: `${active.offsetWidth}px` }
}

function onTabKeydown(event: KeyboardEvent, index: number) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const nextIndex =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : event.key === 'ArrowRight'
          ? (index + 1) % tabs.length
          : (index - 1 + tabs.length) % tabs.length
  const next = tabs[nextIndex]
  if (!next) return
  tab.value = next.id
  window.requestAnimationFrame(() => {
    nav.value?.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus()
  })
}

watch(
  () => office.selectedId.value,
  (id) => {
    if (id) tab.value = 'agent'
  },
)

watch(tab, async () => {
  await nextTick()
  measureIndicator()
})

watch(
  () => props.drawerOpen,
  async (open) => {
    if (!open) {
      deactivate()
      return
    }
    await nextTick()
    activate(panel.value)
  },
)

onMounted(() => {
  measureIndicator()
  window.addEventListener('resize', measureIndicator)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', measureIndicator)
})
</script>

<template>
  <aside
    ref="panel"
    class="side-panel"
    :class="{ 'is-drawer-open': drawerOpen }"
    :aria-label="drawerOpen ? 'Panel de supervisión' : undefined"
  >
    <button
      v-if="drawerOpen"
      type="button"
      class="icon-btn side-panel__drawer-close"
      aria-label="Cerrar panel"
      @click="emit('close-drawer')"
    >
      ✕
    </button>
    <nav ref="nav" class="side-panel__tabs" aria-label="Secciones" role="tablist">
      <span class="side-panel__indicator" :style="indicator" aria-hidden="true" />
      <button
        v-for="(item, index) in tabs"
        :id="`tab-${item.id}`"
        :key="item.id"
        type="button"
        class="tab"
        :class="{ 'is-active': tab === item.id }"
        :data-tab="item.id"
        :aria-selected="tab === item.id"
        :aria-controls="`panel-${item.id}`"
        :tabindex="tab === item.id ? 0 : -1"
        role="tab"
        @click="tab = item.id"
        @keydown="onTabKeydown($event, index)"
      >
        {{ item.label }}
        <span v-if="item.id === 'approvals' && office.state.value?.approvals.length" class="tab__badge">
          {{ office.state.value.approvals.length }}
        </span>
      </button>
    </nav>

    <div class="side-panel__filters">
      <button
        type="button"
        class="filter-toggle"
        :class="{ 'is-active': office.showNativeAgents.value }"
        :aria-pressed="office.showNativeAgents.value"
        title="Mostrar u ocultar los agentes nativos de OpenCode (build y plan)"
        @click="office.toggleNativeAgents()"
      >
        <span class="filter-toggle__dot" aria-hidden="true" />
        Nativos
      </button>
      <span class="filter-hint">
        {{ office.showNativeAgents.value ? 'build y plan visibles' : 'solo equipo' }}
      </span>
    </div>

    <div class="side-panel__body">
      <Transition name="panel-fade" mode="out-in">
        <div
          :id="`panel-${tab}`"
          :key="tab"
          class="side-panel__content"
          role="tabpanel"
          :aria-labelledby="`tab-${tab}`"
          tabindex="0"
        >
          <template v-if="tab === 'agent'">
            <AgentDetailPanel
              v-if="office.selectedId.value"
              @new-task="emit('new-task', $event)"
            />
            <AgentCardList v-else />
          </template>

          <template v-else-if="tab === 'activity'">
            <div class="section-heading">
              <h2>Actividad en vivo</h2>
              <span class="live-tag" :class="{ 'is-off': !office.sseConnected.value }">
                <span class="live-tag__dot" />
                {{ office.sseConnected.value ? 'SSE' : 'reconectando' }}
              </span>
            </div>
            <EventFeed
              v-if="!office.loading.value && !office.loadError.value"
              :events="office.state.value?.events ?? []"
              empty="Sin actividad todavía."
            />
            <PanelState v-else-if="office.loading.value" state="loading" />
            <PanelState
              v-else
              state="error"
              title="No se pudo cargar la actividad"
              :message="office.loadError.value ?? undefined"
              action-label="Reintentar"
              :busy="office.refreshing.value"
              @action="office.retryState()"
            />
          </template>

          <template v-else-if="tab === 'approvals'">
            <div class="section-heading">
              <h2>Aprobaciones humanas</h2>
              <span class="section-heading__count">{{ office.state.value?.approvals.length ?? 0 }}</span>
            </div>
            <ApprovalsPanel :approvals="office.state.value?.approvals ?? []" />
          </template>

          <AuditPanel v-else :active="tab === 'audit'" />
        </div>
      </Transition>
    </div>
  </aside>
</template>
