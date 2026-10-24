<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useOffice } from '~/composables/useOffice'
import StatusBadge from './StatusBadge.vue'
import EventFeed from './EventFeed.vue'
import ApprovalsPanel from './ApprovalsPanel.vue'
import { agentColor, formatDateTime, taskStatusLabel, timeAgo } from '~/utils/status'

const emit = defineEmits<{ 'new-task': [agentId: string] }>()

const office = useOffice()
const confirmCancel = ref<string | null>(null)

watch(
  () => office.detail.value?.agent.id,
  () => {
    confirmCancel.value = null
  },
)

const detail = computed(() => office.detail.value)
const avatarColor = computed(() => (detail.value ? agentColor(detail.value.agent.name) : '#7aa2f7'))
const pendingApprovals = computed(
  () => detail.value?.approvals.filter((approval) => approval.status === 'pending') ?? [],
)
const activeTask = computed(() => {
  const tasks = detail.value?.tasks ?? []
  return tasks.find((task) => task.status === 'queued' || task.status === 'running') ?? null
})
const canCreate = computed(() => detail.value?.agent.capabilities.includes('tasks:create') ?? false)

async function cancel(taskId: string) {
  if (confirmCancel.value !== taskId) {
    confirmCancel.value = taskId
    return
  }
  confirmCancel.value = null
  await office.cancelTask(taskId)
}
</script>

<template>
  <div v-if="detail" class="agent-detail">
    <button type="button" class="link-back" @click="office.selectAgent(null)">
      ← Todos los agentes
    </button>

    <header class="agent-detail__head">
      <span class="agent-avatar agent-avatar--lg" :style="{ '--avatar': avatarColor }">
        {{ detail.agent.name.slice(0, 2).toUpperCase() }}
      </span>
      <div class="agent-detail__title">
        <div class="agent-detail__name-row">
          <h2>{{ detail.agent.name }}</h2>
          <StatusBadge :status="detail.agent.status" pulse />
        </div>
        <p class="agent-detail__sub">
          <span v-if="detail.agent.mode" class="chip">{{ detail.agent.mode }}</span>
          <span class="chip chip--muted">{{ detail.agent.externalId }}</span>
          <span
            v-if="detail.agent.statusReason"
            class="agent-detail__reason"
            :class="{ 'is-error': detail.agent.status === 'error' }"
            :title="detail.agent.statusReason"
          >
            {{ detail.agent.statusReason }}
          </span>
        </p>
      </div>
    </header>

    <p v-if="detail.agent.description" class="agent-detail__description">
      {{ detail.agent.description }}
    </p>

    <div class="agent-detail__connection">
      <span class="connection-dot" :data-status="detail.agent.connectionStatus" />
      <span>{{ detail.agent.connectionName }}</span>
      <span class="agent-detail__connection-state">{{ detail.agent.connectionStatus }}</span>
      <button
        v-if="detail.agent.connectionStatus !== 'connected'"
        type="button"
        class="btn btn--ghost btn--sm"
        :disabled="office.busy.value === `reconnect:${detail.agent.connectionId}`"
        @click="office.reconnect(detail.agent.connectionId)"
      >
        Reconectar
      </button>
    </div>

    <div class="agent-detail__actions">
      <button
        type="button"
        class="btn btn--primary"
        :disabled="!canCreate || detail.agent.connectionStatus !== 'connected' || !!activeTask"
        @click="emit('new-task', detail.agent.id)"
      >
        Asignar tarea
      </button>
      <button
        v-if="activeTask"
        type="button"
        class="btn btn--danger"
        :disabled="office.busy.value === `cancel:${activeTask.id}`"
        @click="cancel(activeTask.id)"
      >
        {{ confirmCancel === activeTask.id ? 'Confirmar cancelación' : 'Cancelar tarea' }}
      </button>
      <button
        v-if="activeTask"
        type="button"
        class="btn btn--ghost"
        @click="office.openTask(activeTask.id)"
      >
        Ver sesión
      </button>
    </div>

    <section v-if="activeTask" class="detail-section">
      <h3 class="detail-section__title">Tarea actual</h3>
      <article class="task-card task-card--active">
        <div class="task-card__top">
          <span class="task-card__title">{{ activeTask.title }}</span>
          <span class="task-status" :data-status="activeTask.status">
            {{ taskStatusLabel(activeTask.status) }}
          </span>
        </div>
        <p class="task-card__meta">
          Iniciada {{ timeAgo(activeTask.createdAt) }} · sesión
          <code>{{ activeTask.sessionId?.slice(0, 14) || 'pendiente' }}</code>
        </p>
      </article>
    </section>

    <section class="detail-section">
      <h3 class="detail-section__title">
        Aprobaciones
        <span v-if="pendingApprovals.length" class="count-badge">{{ pendingApprovals.length }}</span>
      </h3>
      <ApprovalsPanel :approvals="pendingApprovals" />
    </section>

    <section class="detail-section">
      <h3 class="detail-section__title">Sesiones y ejecuciones</h3>
      <ul v-if="detail.tasks.length" class="mini-list">
        <li v-for="task in detail.tasks" :key="task.id">
          <button type="button" class="mini-list__row" @click="office.openTask(task.id)">
            <span class="mini-list__body">
              <span class="mini-list__title">{{ task.title }}</span>
              <span class="mini-list__meta">
                {{ formatDateTime(task.createdAt) }}
                <template v-if="task.sessionId"> · {{ task.sessionId.slice(0, 12) }}…</template>
              </span>
            </span>
            <span class="task-status" :data-status="task.status">
              {{ taskStatusLabel(task.status) }}
            </span>
          </button>
        </li>
      </ul>
      <p v-else class="empty-note">Este agente no tiene sesiones registradas.</p>
    </section>

    <section class="detail-section">
      <h3 class="detail-section__title">Actividad reciente</h3>
      <EventFeed :events="detail.events.slice(0, 8)" dense empty="Sin eventos todavía." />
    </section>
  </div>
  <p v-else class="empty-note">Selecciona un agente para ver su estado.</p>
</template>
