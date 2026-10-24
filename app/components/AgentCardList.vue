<script setup lang="ts">
import { useOffice } from '~/composables/useOffice'
import StatusBadge from './StatusBadge.vue'
import { agentColor, timeAgo } from '~/utils/status'

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
        <span class="agent-avatar" :style="{ '--avatar': agentColor(agent.name) }">
          {{ agent.name.slice(0, 2).toUpperCase() }}
        </span>
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
              · {{ timeAgo(agent.currentTask.createdAt) }}
            </template>
          </span>
        </span>
        <span v-if="agent.pendingApprovals" class="agent-row__badge">{{ agent.pendingApprovals }}</span>
      </button>
    </div>
    <p v-else class="empty-note">Todavía no hay agentes disponibles.</p>

    <div v-if="office.state.value?.connections.length" class="connection-list">
      <div
        v-for="connection in office.state.value.connections"
        :key="connection.id"
        class="connection-row"
      >
        <span class="connection-dot" :data-status="connection.status" />
        <span class="connection-row__body">
          <span class="connection-row__name">{{ connection.name }}</span>
          <span class="connection-row__meta">
            {{ connection.adapter }}
            <template v-if="connection.error"> · {{ connection.error }}</template>
          </span>
        </span>
        <button
          type="button"
          class="btn btn--ghost btn--sm"
          :disabled="office.busy.value === `reconnect:${connection.id}`"
          @click="office.reconnect(connection.id)"
        >
          Reconectar
        </button>
      </div>
    </div>
  </section>
</template>
