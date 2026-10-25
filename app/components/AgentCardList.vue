<script setup lang="ts">
import { useOffice } from '~/composables/useOffice'
import StatusBadge from './StatusBadge.vue'
import AgentAvatar from './AgentAvatar.vue'
import PanelState from './PanelState.vue'
import { formatAbsolute, timeAgo, toIso } from '~/utils/status'

const office = useOffice()
</script>

<template>
  <section class="agent-list">
    <div class="section-heading">
      <h2>Agentes</h2>
      <span class="section-heading__count">{{ office.state.value?.agents.length ?? 0 }}</span>
    </div>

    <div v-if="office.state.value?.agents.length" class="agent-list__items">
      <button
        v-for="agent in office.state.value.agents"
        :key="agent.id"
        type="button"
        class="agent-row"
        :class="{ 'is-active': office.selectedId.value === agent.id }"
        @click="office.selectAgent(agent.id)"
      >
        <AgentAvatar :agent-id="agent.id" :name="agent.name" :status="agent.status" />
        <span class="agent-row__body">
          <span class="agent-row__top">
            <span class="agent-row__name">{{ agent.name }}</span>
            <StatusBadge :status="agent.status" compact />
          </span>
          <span class="agent-row__task">
            {{ agent.currentTask?.title || agent.statusReason || 'Sin tarea activa' }}
          </span>
          <span class="agent-row__meta">
            {{ agent.connectionName }}
            <template v-if="agent.currentTask">
              ·
              <time
                :datetime="toIso(agent.currentTask.createdAt)"
                :title="formatAbsolute(agent.currentTask.createdAt)"
              >
                {{ timeAgo(agent.currentTask.createdAt) }}
              </time>
            </template>
          </span>
        </span>
        <span v-if="agent.pendingApprovals" class="agent-row__badge">{{ agent.pendingApprovals }}</span>
      </button>
    </div>
    <PanelState
      v-else
      :state="office.loadError.value ? 'error' : office.loading.value ? 'loading' : 'empty'"
      :title="office.loadError.value ? 'No se pudieron cargar los agentes' : 'Todavía no hay agentes disponibles.'"
      :message="office.loadError.value ?? 'Conecta un servidor de OpenCode para empezar.'"
      action-label="Reintentar"
      :busy="office.refreshing.value"
      @action="office.retryState()"
    />
  </section>
</template>
