<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useOffice } from '~/composables/useOffice'
import PanelState from './PanelState.vue'
import { formatAbsolute, timeAgo, toIso } from '~/utils/status'

const props = defineProps<{ active: boolean }>()

const office = useOffice()

onMounted(() => {
  if (props.active) void office.refreshAudit()
})

watch(
  () => props.active,
  (active) => {
    if (active) void office.refreshAudit()
  },
)
</script>

<template>
  <div class="audit">
    <div class="section-heading">
      <h2>Registro de auditoría</h2>
      <button type="button" class="btn btn--ghost btn--sm" @click="office.refreshAudit()">
        Actualizar
      </button>
    </div>
    <ul v-if="office.audit.value.length" class="audit__list">
      <li v-for="entry in office.audit.value" :key="entry.id" class="audit__item">
        <div class="audit__row">
          <span class="audit__action">{{ entry.action }}</span>
          <time :datetime="toIso(entry.createdAt)" :title="formatAbsolute(entry.createdAt)">
            {{ timeAgo(entry.createdAt) }}
          </time>
        </div>
        <p class="audit__meta">
          <span>{{ entry.actor }}</span>
          <span>·</span>
          <span>{{ entry.entityType }}</span>
          <span v-if="entry.entityId" class="audit__id">{{ entry.entityId.slice(0, 8) }}</span>
        </p>
        <pre v-if="entry.detail" class="audit__detail">{{ JSON.stringify(entry.detail, null, 1) }}</pre>
      </li>
    </ul>
    <PanelState
      v-else
      :state="office.auditError.value ? 'error' : office.auditLoading.value ? 'loading' : 'empty'"
      :title="office.auditError.value ? 'No se pudo cargar la auditoría' : 'Sin acciones registradas todavía.'"
      :message="office.auditError.value ?? undefined"
      action-label="Reintentar"
      :busy="office.auditLoading.value"
      @action="office.refreshAudit()"
    />
  </div>
</template>
