<script setup lang="ts">
import { useOffice } from '~/composables/useOffice'

const office = useOffice()
</script>

<template>
  <Teleport to="body">
    <div class="toast-stack" aria-live="polite">
      <div
        v-for="toast in office.toasts.value"
        :key="toast.id"
        class="toast"
        :data-level="toast.level"
      >
        {{ toast.message }}
      </div>
    </div>
  </Teleport>
</template>
