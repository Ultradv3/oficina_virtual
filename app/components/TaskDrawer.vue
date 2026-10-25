<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useOffice } from '~/composables/useOffice'
import { useFocusTrap } from '~/composables/useFocusTrap'
import EventFeed from './EventFeed.vue'
import ApprovalsPanel from './ApprovalsPanel.vue'
import PanelState from './PanelState.vue'
import { formatAbsolute, taskStatusLabel, timeAgo, toIso } from '~/utils/status'

const office = useOffice()
const confirmCancel = ref(false)
const card = ref<HTMLElement>()
const { activate, deactivate } = useFocusTrap({ onEscape: close })

const detail = computed(() => office.taskDetail.value)
const visible = computed(() => Boolean(office.taskLoading.value || detail.value))
const active = computed(
  () => detail.value && ['queued', 'running'].includes(detail.value.task.status),
)
const pendingApprovals = computed(
  () => detail.value?.approvals.filter((approval) => approval.status === 'pending') ?? [],
)

watch(
  visible,
  async (open) => {
    if (!open) {
      deactivate()
      return
    }
    await nextTick()
    activate(card.value)
  },
  { immediate: true },
)

async function cancel() {
  if (!detail.value) return
  if (!confirmCancel.value) {
    confirmCancel.value = true
    return
  }
  confirmCancel.value = false
  await office.cancelTask(detail.value.task.id)
}

function close() {
  confirmCancel.value = false
  office.closeTask()
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="office.taskLoading.value || detail"
      class="modal modal--drawer"
      role="presentation"
      @click.self="close"
    >
      <section ref="card" class="modal__card modal__card--wide" role="dialog" aria-modal="true">
        <header class="modal__head">
          <div>
            <p class="eyebrow">Sesión remota</p>
            <h2>{{ detail?.task.title || 'Cargando sesión…' }}</h2>
            <p v-if="detail" class="modal__sub">
              {{ detail.agent?.name }} ·
              <span class="task-status" :data-status="detail.task.status">
                {{ taskStatusLabel(detail.task.status) }}
              </span>
              ·
              <time
                :datetime="toIso(detail.task.createdAt)"
                :title="formatAbsolute(detail.task.createdAt)"
              >
                {{ timeAgo(detail.task.createdAt) }}
              </time>
            </p>
          </div>
          <button type="button" class="icon-btn" aria-label="Cerrar" @click="close">✕</button>
        </header>

        <PanelState v-if="office.taskLoading.value" state="loading" />

        <div v-else-if="detail" class="task-detail">
          <div v-if="active" class="task-detail__actions">
            <button
              type="button"
              class="btn btn--danger"
              :disabled="office.busy.value === `cancel:${detail.task.id}`"
              @click="cancel"
            >
              {{ confirmCancel ? 'Confirmar cancelación' : 'Cancelar ejecución' }}
            </button>
          </div>

          <p v-if="detail.task.error" class="alert alert--error">{{ detail.task.error }}</p>
          <p v-if="detail.historyError" class="alert alert--warn">
            No se pudo leer el historial remoto: {{ detail.historyError }}
          </p>

          <section class="task-detail__section">
            <h3>Prompt</h3>
            <pre class="prompt-box">{{ detail.task.prompt }}</pre>
          </section>

          <section class="task-detail__section">
            <h3>Conversación</h3>
            <p v-if="detail.messages.length" class="external-text__tag">Contenido del proveedor</p>
            <div v-if="detail.messages.length" class="messages">
              <article
                v-for="message in detail.messages"
                :key="message.id"
                class="message"
                :data-role="message.role"
              >
                <span class="message__role">{{ message.role }}</span>
                <div class="message__parts">
                  <template v-for="(part, index) in message.parts" :key="`${message.id}-${index}`">
                    <p v-if="part.type === 'text'" class="message__text">{{ part.text }}</p>
                    <span v-else class="tool-chip">
                      {{ part.tool || 'tool' }}
                      <span v-if="part.status" class="tool-chip__status">{{ part.status }}</span>
                    </span>
                  </template>
                </div>
              </article>
            </div>
            <p v-else class="empty-note">
              El historial remoto aún no tiene mensajes o no está disponible.
            </p>
          </section>

          <section v-if="detail.subtasks.length" class="task-detail__section">
            <h3>Delegaciones</h3>
            <ul class="delegation-list">
              <li v-for="subtask in detail.subtasks" :key="subtask.id" class="delegation-row">
                <span class="delegation-row__agent">{{ subtask.agentName || 'Agente' }}</span>
                <span class="delegation-row__title">{{ subtask.title }}</span>
                <span class="task-status" :data-status="subtask.status">
                  {{ taskStatusLabel(subtask.status) }}
                </span>
              </li>
            </ul>
          </section>

          <section v-if="pendingApprovals.length" class="task-detail__section">
            <h3>Aprobaciones pendientes</h3>
            <ApprovalsPanel :approvals="pendingApprovals" />
          </section>

          <section class="task-detail__section">
            <h3>Eventos de la tarea</h3>
            <EventFeed :events="detail.events" dense empty="Sin eventos registrados." />
          </section>
        </div>
      </section>
    </div>
  </Teleport>
</template>
