<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useOffice } from '~/composables/useOffice'
import { formatDateTime } from '~/utils/status'

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
          <time>{{ formatDateTime(entry.createdAt) }}</time>
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
    <p v-else class="empty-note">Sin acciones registradas todavía.</p>
  </div>
</template>
