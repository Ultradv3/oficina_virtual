<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useOffice } from '~/composables/useOffice'
import { useFocusTrap } from '~/composables/useFocusTrap'

const props = defineProps<{
  open: boolean
  agentId: string | null
}>()

const emit = defineEmits<{ close: [] }>()

const office = useOffice()
const card = ref<HTMLElement>()
const { activate, deactivate } = useFocusTrap({ onEscape: () => emit('close') })
const form = reactive({ agentId: '', title: '', prompt: '' })
const error = ref<string | null>(null)

const eligibleAgents = computed(
  () =>
    office.state.value?.agents.filter(
      (agent) =>
        agent.capabilities.includes('tasks:create') &&
        agent.status !== 'disconnected' &&
        agent.currentTask === null,
    ) ?? [],
)

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      deactivate()
      return
    }
    error.value = null
    form.title = ''
    form.prompt = ''
    const requested = props.agentId
      ? office.state.value?.agents.find((agent) => agent.id === props.agentId)
      : null
    const fallback =
      eligibleAgents.value.find(
        (agent) => agent.name === 'orchestrator' || agent.externalId === 'orchestrator',
      ) ??
      eligibleAgents.value.find((agent) => agent.status === 'available') ??
      eligibleAgents.value[0]
    form.agentId = requested?.id ?? fallback?.id ?? ''
    await nextTick()
    activate(card.value)
  },
  { immediate: true },
)

const selectedAgent = computed(
  () => office.state.value?.agents.find((agent) => agent.id === form.agentId) ?? null,
)

async function submit() {
  error.value = null
  if (!form.agentId) {
    error.value = 'Selecciona un agente compatible.'
    return
  }
  if (form.title.trim().length < 3) {
    error.value = 'El título necesita al menos 3 caracteres.'
    return
  }
  if (form.prompt.trim().length < 3) {
    error.value = 'El prompt necesita al menos 3 caracteres.'
    return
  }
  const result = await office.createTask({
    agentId: form.agentId,
    title: form.title.trim(),
    prompt: form.prompt.trim(),
  })
  if (result.ok) {
    await office.selectAgent(form.agentId)
    emit('close')
  } else {
    error.value = result.error ?? 'No se pudo crear la tarea.'
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal" role="presentation" @click.self="emit('close')">
      <section ref="card" class="modal__card" role="dialog" aria-modal="true" aria-labelledby="composer-title">
        <header class="modal__head">
          <div>
            <p class="eyebrow">Nueva ejecución</p>
            <h2 id="composer-title">Asignar tarea</h2>
          </div>
          <button type="button" class="icon-btn" aria-label="Cerrar" @click="emit('close')">✕</button>
        </header>

        <form class="form" @submit.prevent="submit">
          <label class="field">
            <span class="field__label">Agente</span>
            <select v-model="form.agentId" class="input">
              <option value="" disabled>Selecciona un agente</option>
              <option
                v-for="agent in office.state.value?.agents ?? []"
                :key="agent.id"
                :value="agent.id"
                :disabled="!eligibleAgents.some((item) => item.id === agent.id)"
              >
                {{ agent.name }} · {{ agent.status }}
              </option>
            </select>
          </label>

          <p v-if="selectedAgent" class="form__hint">
            {{ selectedAgent.connectionName }} · capacidades:
            {{ selectedAgent.capabilities.join(', ') }}
          </p>

          <label class="field">
            <span class="field__label">Título</span>
            <input
              v-model="form.title"
              class="input"
              maxlength="120"
              placeholder="Revisar el backlog del sprint"
            >
          </label>

          <label class="field">
            <span class="field__label">Prompt</span>
            <textarea
              v-model="form.prompt"
              class="input input--area"
              rows="6"
              maxlength="8000"
              placeholder="Describe el trabajo con el detalle suficiente para que el agente pueda ejecutarlo…"
            />
          </label>

          <p v-if="error" class="form__error">{{ error }}</p>

          <footer class="modal__foot">
            <button type="button" class="btn btn--ghost" @click="emit('close')">Cancelar</button>
            <button type="submit" class="btn btn--primary" :disabled="office.busy.value === 'create'">
              {{ office.busy.value === 'create' ? 'Enviando…' : 'Ejecutar tarea' }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>
