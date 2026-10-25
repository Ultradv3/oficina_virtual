<script setup lang="ts">
import { ref } from 'vue'
import { useOffice } from '~/composables/useOffice'
import type { ApprovalItem } from '~/types/office'
import PanelState from './PanelState.vue'
import { formatAbsolute, timeAgo, toIso } from '~/utils/status'

defineProps<{ approvals: ApprovalItem[] }>()

const office = useOffice()
const remember = ref<Record<string, boolean>>({})

async function respond(approval: ApprovalItem, decision: 'approve' | 'reject') {
  await office.respondApproval(approval.id, decision, remember.value[approval.id] === true)
}
</script>

<template>
  <div v-if="approvals.length" class="approval-list">
    <article v-for="approval in approvals" :key="approval.id" class="approval-card">
      <header class="approval-card__head">
        <div>
          <span class="approval-card__agent">{{ approval.agentName }}</span>
          <h3 class="approval-card__title">{{ approval.title }}</h3>
        </div>
        <time
          class="approval-card__time"
          :datetime="toIso(approval.createdAt)"
          :title="formatAbsolute(approval.createdAt)"
        >
          {{ timeAgo(approval.createdAt) }}
        </time>
      </header>
      <p v-if="approval.detail" class="approval-card__detail">{{ approval.detail }}</p>
      <label class="checkbox">
        <input v-model="remember[approval.id]" type="checkbox">
        <span>Permitir siempre esta acción</span>
      </label>
      <div class="approval-card__actions">
        <button
          type="button"
          class="btn btn--ghost"
          :disabled="office.busy.value === `approval:${approval.id}`"
          @click="respond(approval, 'reject')"
        >
          Rechazar
        </button>
        <button
          type="button"
          class="btn btn--primary"
          :disabled="office.busy.value === `approval:${approval.id}`"
          @click="respond(approval, 'approve')"
        >
          Aprobar
        </button>
      </div>
    </article>
  </div>
  <PanelState
    v-else
    :state="office.loadError.value ? 'error' : office.loading.value ? 'loading' : 'empty'"
    :title="office.loadError.value ? 'No se pudieron cargar las aprobaciones' : 'No hay solicitudes de aprobación pendientes.'"
    :message="office.loadError.value ?? 'Las aprobaciones aparecen cuando el agente las solicita.'"
    action-label="Reintentar"
    :busy="office.refreshing.value"
    @action="office.retryState()"
  />
</template>
