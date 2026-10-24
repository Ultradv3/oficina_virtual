<script setup lang="ts">
import { ref, watch } from 'vue'
import { useOffice } from '~/composables/useOffice'
import AgentCardList from './AgentCardList.vue'
import AgentDetailPanel from './AgentDetailPanel.vue'
import EventFeed from './EventFeed.vue'
import ApprovalsPanel from './ApprovalsPanel.vue'
import AuditPanel from './AuditPanel.vue'

const emit = defineEmits<{ 'new-task': [agentId: string] }>()

const office = useOffice()
type Tab = 'agent' | 'activity' | 'approvals' | 'audit'
const tab = ref<Tab>('agent')

watch(
  () => office.selectedId.value,
  (id) => {
    if (id) tab.value = 'agent'
  },
)

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'agent', label: 'Agente' },
  { id: 'activity', label: 'Actividad' },
  { id: 'approvals', label: 'Aprobaciones' },
  { id: 'audit', label: 'Auditoría' },
]
</script>

<template>
  <aside class="side-panel">
    <nav class="side-panel__tabs" aria-label="Secciones">
      <button
        v-for="item in tabs"
        :key="item.id"
        type="button"
        class="tab"
        :class="{ 'is-active': tab === item.id }"
        @click="tab = item.id"
      >
        {{ item.label }}
        <span v-if="item.id === 'approvals' && office.state.value?.approvals.length" class="tab__badge">
          {{ office.state.value.approvals.length }}
        </span>
      </button>
    </nav>

    <div class="side-panel__body">
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
        <EventFeed :events="office.state.value?.events ?? []" empty="Sin actividad todavía." />
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
  </aside>
</template>
