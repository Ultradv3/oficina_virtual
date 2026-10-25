<script setup lang="ts">
import type { ActivityEvent } from '~/types/office'
import { formatAbsolute, timeAgo, toIso } from '~/utils/status'

defineProps<{
  events: ActivityEvent[]
  empty?: string
  dense?: boolean
}>()
</script>

<template>
  <ul v-if="events.length" class="event-feed" :class="{ 'event-feed--dense': dense }">
    <li v-for="event in events" :key="event.id" class="event-feed__item" :data-level="event.level">
      <span class="event-feed__line" aria-hidden="true" />
      <span class="event-feed__dot" aria-hidden="true" />
      <div class="event-feed__body">
        <div class="event-feed__meta">
          <span class="event-feed__agent">{{ event.agentName || 'sistema' }}</span>
          <span class="event-feed__type">{{ event.type }}</span>
          <time :datetime="toIso(event.createdAt)" :title="formatAbsolute(event.createdAt)">
            {{ timeAgo(event.createdAt) }}
          </time>
        </div>
        <p class="event-feed__message">{{ event.message }}</p>
      </div>
    </li>
  </ul>
  <p v-else class="empty-note">{{ empty || 'Sin actividad todavía.' }}</p>
</template>
