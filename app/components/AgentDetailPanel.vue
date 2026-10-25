<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useOffice } from '~/composables/useOffice'
import StatusBadge from './StatusBadge.vue'
import AgentAvatar from './AgentAvatar.vue'
import EventFeed from './EventFeed.vue'
import ApprovalsPanel from './ApprovalsPanel.vue'
import PanelState from './PanelState.vue'
import { formatAbsolute, taskStatusLabel, timeAgo, toIso } from '~/utils/status'

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
      <AgentAvatar
        :agent-id="detail.agent.id"
        :name="detail.agent.name"
        :status="detail.agent.status"
        :size="53"
      />
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

    <p v-if="detail.agent.description" class="agent-detail__description external-text">
      <span class="external-text__tag">Proveedor</span>{{ detail.agent.description }}
    </p>

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
          Iniciada
          <time
            :datetime="toIso(activeTask.createdAt)"
            :title="formatAbsolute(activeTask.createdAt)"
          >
            {{ timeAgo(activeTask.createdAt) }}
          </time>
          · sesión
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
                <time
                  :datetime="toIso(task.createdAt)"
                  :title="formatAbsolute(task.createdAt)"
                >
                  {{ timeAgo(task.createdAt) }}
                </time>
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

    <section v-if="detail.delegations.length" class="detail-section">
      <h3 class="detail-section__title">Delegaciones</h3>
      <ul class="delegation-list">
        <li v-for="subtask in detail.delegations" :key="subtask.id" class="delegation-row">
          <span class="delegation-row__title">{{ subtask.parentTitle || subtask.title }}</span>
          <span class="task-status" :data-status="subtask.status">
            {{ taskStatusLabel(subtask.status) }}
          </span>
        </li>
      </ul>
    </section>

    <section class="detail-section">
      <h3 class="detail-section__title">Actividad reciente</h3>
      <EventFeed :events="detail.events.slice(0, 8)" dense empty="Sin eventos todavía." />
    </section>
  </div>
  <PanelState
    v-else-if="office.detailError.value"
    state="error"
    title="No se pudo cargar el agente"
    :message="office.detailError.value"
    action-label="Reintentar"
    :busy="office.refreshing.value"
    @action="office.retryState()"
  />
  <PanelState v-else-if="office.loading.value" state="loading" />
  <PanelState v-else state="empty" title="Selecciona un agente para ver su estado." />
</template>
