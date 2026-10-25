import { ref, shallowRef } from 'vue'
import type {
  AgentDetail,
  AuditEntry,
  OfficeState,
  TaskDetail,
} from '~/types/office'

type ToastLevel = 'info' | 'success' | 'error' | 'warn'

interface ToastItem {
  id: number
  message: string
  level: ToastLevel
}

const state = shallowRef<OfficeState | null>(null)
const detail = shallowRef<AgentDetail | null>(null)
const taskDetail = shallowRef<TaskDetail | null>(null)
const audit = shallowRef<AuditEntry[]>([])
const auditLoading = ref(false)
const auditError = ref<string | null>(null)
const toasts = ref<ToastItem[]>([])
const selectedId = ref<string | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const detailError = ref<string | null>(null)
const refreshing = ref(false)
const sseConnected = ref(false)
const streaming = ref(false)
const taskLoading = ref(false)
const busy = ref<string | null>(null)
const showNativeAgents = ref(false)

const NATIVE_AGENTS_KEY = 'agent-office-show-native'

function readNativePreference(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(NATIVE_AGENTS_KEY) === '1'
  } catch {
    return false
  }
}

function persistNativePreference(value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(NATIVE_AGENTS_KEY, value ? '1' : '0')
  } catch {
    // localStorage puede no estar disponible; la preferencia sigue en memoria.
  }
}

function applyNativeFilter(data: OfficeState): OfficeState {
  if (showNativeAgents.value) return data
  const agents = data.agents.filter((agent) => agent.metadata?.native !== true)
  // Si no existe equipo propio, no ocultamos la única oficina disponible.
  if (agents.length === 0) return data
  const counts = {
    available: 0,
    working: 0,
    waiting_approval: 0,
    error: 0,
    disconnected: 0,
  } as OfficeState['counts']
  for (const agent of agents) counts[agent.status] += 1
  return { ...data, agents, counts }
}

let source: EventSource | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let detailTimer: ReturnType<typeof setTimeout> | null = null
let toastSeq = 0

function readToken(): string {
  if (typeof window === 'undefined') return ''
  const fromUrl = new URL(window.location.href).searchParams.get('token')
  if (fromUrl) {
    sessionStorage.setItem('agent-office-token', fromUrl)
    return fromUrl
  }
  return sessionStorage.getItem('agent-office-token') ?? ''
}

function withToken(path: string): string {
  const token = readToken()
  if (!token) return path
  return `${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readToken()
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) }
  if (init.body) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`
  const response = await fetch(path, { ...init, headers })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    const message = data?.statusMessage || data?.message || data?.error || `Error ${response.status}`
    throw new Error(message)
  }
  return data as T
}

function toast(message: string, level: ToastLevel = 'info') {
  const item = { id: ++toastSeq, message, level }
  toasts.value = [...toasts.value, item]
  setTimeout(() => {
    toasts.value = toasts.value.filter((entry) => entry.id !== item.id)
  }, 5000)
}

async function refreshState(): Promise<void> {
  try {
    const data = await api<OfficeState>('/api/state')
    state.value = applyNativeFilter(data)
    if (selectedId.value && !state.value.agents.some((agent) => agent.id === selectedId.value)) {
      selectedId.value = null
      detail.value = null
    }
    loadError.value = null
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
  }
}

function scheduleRefresh() {
  if (refreshTimer) return
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    void refreshState()
  }, 220)
}

async function refreshDetail(): Promise<void> {
  if (!selectedId.value) {
    detail.value = null
    detailError.value = null
    return
  }
  try {
    detail.value = await api<AgentDetail>(`/api/agents/${selectedId.value}`)
    detailError.value = null
  } catch (error) {
    detail.value = null
    detailError.value = error instanceof Error ? error.message : String(error)
  }
}

async function retryState(): Promise<void> {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await refreshState()
    await refreshDetail()
  } finally {
    refreshing.value = false
  }
}

function scheduleDetail() {
  if (!selectedId.value) return
  if (detailTimer) return
  detailTimer = setTimeout(() => {
    detailTimer = null
    void refreshDetail()
  }, 250)
}

function connect() {
  if (typeof window === 'undefined' || source) return
  streaming.value = true
  source = new EventSource(withToken('/api/events'))
  source.onopen = () => {
    sseConnected.value = true
  }
  source.onmessage = (message) => {
    try {
      const payload = JSON.parse(message.data)
      if (payload.kind === 'event') {
        scheduleRefresh()
        scheduleDetail()
        if (taskDetail.value && payload.event?.taskId === taskDetail.value.task.id) {
          void openTask(taskDetail.value.task.id, true)
        }
      } else if (payload.kind === 'refresh') {
        scheduleRefresh()
        scheduleDetail()
      }
    } catch {
      // ignore malformed frames
    }
  }
  source.onerror = () => {
    sseConnected.value = false
  }
}

async function selectAgent(id: string | null) {
  selectedId.value = id
  detail.value = null
  if (id) await refreshDetail()
}

async function createTask(payload: { agentId: string; title: string; prompt: string }) {
  busy.value = 'create'
  try {
    const result = await api<{ task: { id: string } }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    toast('Tarea asignada', 'success')
    await refreshState()
    await refreshDetail()
    return { ok: true as const, taskId: result.task?.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    toast(`No se pudo crear la tarea: ${message}`, 'error')
    return { ok: false as const, error: message }
  } finally {
    busy.value = null
  }
}

async function cancelTask(taskId: string) {
  busy.value = `cancel:${taskId}`
  try {
    const result = await api<{ confirmed: boolean; error: string | null }>(
      `/api/tasks/${taskId}/cancel`,
      { method: 'POST' },
    )
    if (result.confirmed) {
      toast('Cancelación confirmada', 'success')
    } else {
      toast(`Cancelación no confirmada: ${result.error ?? 'sin detalle'}`, 'error')
    }
    await refreshState()
    await refreshDetail()
    if (taskDetail.value?.task.id === taskId) await openTask(taskId, true)
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    toast(`Cancelación fallida: ${message}`, 'error')
    return { confirmed: false, error: message }
  } finally {
    busy.value = null
  }
}

async function respondApproval(id: string, decision: 'approve' | 'reject', remember = false) {
  busy.value = `approval:${id}`
  try {
    const result = await api<{ confirmed: boolean; error: string | null }>(
      `/api/approvals/${id}/respond`,
      { method: 'POST', body: JSON.stringify({ decision, remember }) },
    )
    if (result.confirmed) {
      toast(decision === 'approve' ? 'Aprobación concedida' : 'Aprobación rechazada', 'success')
    } else {
      toast(`No se pudo responder: ${result.error ?? 'sin detalle'}`, 'error')
    }
    await refreshState()
    await refreshDetail()
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    toast(`No se pudo responder la aprobación: ${message}`, 'error')
    return { confirmed: false, error: message }
  } finally {
    busy.value = null
  }
}

async function reconnect(connectionId: string) {
  busy.value = `reconnect:${connectionId}`
  try {
    const result = await api<{ ok: boolean; error?: string }>(
      `/api/connections/${connectionId}/reconnect`,
      { method: 'POST' },
    )
    toast(result.ok ? 'Conexión restablecida' : `Reconexión fallida: ${result.error ?? ''}`, result.ok ? 'success' : 'error')
    await refreshState()
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    toast(`Reconexión fallida: ${message}`, 'error')
    return { ok: false, error: message }
  } finally {
    busy.value = null
  }
}

async function openTask(taskId: string, silent = false) {
  if (!silent) taskLoading.value = true
  try {
    taskDetail.value = await api<TaskDetail>(`/api/tasks/${taskId}`)
  } catch (error) {
    if (!silent) toast(error instanceof Error ? error.message : String(error), 'error')
  } finally {
    taskLoading.value = false
  }
}

function closeTask() {
  taskDetail.value = null
}

async function refreshAudit() {
  auditLoading.value = true
  auditError.value = null
  try {
    const result = await api<{ entries: AuditEntry[] }>('/api/audit?limit=120')
    audit.value = result.entries
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    auditError.value = message
    toast(message, 'error')
  } finally {
    auditLoading.value = false
  }
}

async function bootstrap() {
  showNativeAgents.value = readNativePreference()
  connect()
  await refreshState()
  if (state.value?.agents.length && !selectedId.value) {
    const agents = state.value.agents
    const preferred =
      agents.find((agent) => agent.name === 'orchestrator' || agent.externalId === 'orchestrator') ??
      agents.find((agent) => agent.status === 'working') ??
      agents[0]
    if (preferred) await selectAgent(preferred.id)
  }
}

async function toggleNativeAgents(): Promise<void> {
  showNativeAgents.value = !showNativeAgents.value
  persistNativePreference(showNativeAgents.value)
  await refreshState()
  if (selectedId.value && !state.value?.agents.some((agent) => agent.id === selectedId.value)) {
    const agents = state.value?.agents ?? []
    const preferred =
      agents.find((agent) => agent.name === 'orchestrator' || agent.externalId === 'orchestrator') ??
      agents[0]
    await selectAgent(preferred?.id ?? null)
  }
}

function dispose() {
  source?.close()
  source = null
  streaming.value = false
  sseConnected.value = false
  if (refreshTimer) clearTimeout(refreshTimer)
  if (detailTimer) clearTimeout(detailTimer)
  refreshTimer = null
  detailTimer = null
}

export function useOffice() {
  return {
    state,
    detail,
    taskDetail,
    audit,
    auditLoading,
    auditError,
    toasts,
    selectedId,
    loading,
    loadError,
    detailError,
    refreshing,
    sseConnected,
    streaming,
    taskLoading,
    busy,
    showNativeAgents,
    bootstrap,
    dispose,
    refreshState,
    refreshDetail,
    toggleNativeAgents,
    retryState,
    refreshAudit,
    selectAgent,
    createTask,
    cancelTask,
    respondApproval,
    reconnect,
    openTask,
    closeTask,
    toast,
    withToken,
  }
}

