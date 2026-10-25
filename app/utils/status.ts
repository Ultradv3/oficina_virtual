import type { AgentStatus } from '~/types/office'

export type StatusIcon = 'check' | 'activity' | 'hand' | 'alert' | 'plug-off'

export const STATUS_META: Record<
  AgentStatus,
  {
    label: string
    color: string
    soft: string
    description: string
    icon: StatusIcon
    ariaLabel: string
  }
> = {
  available: {
    label: 'Disponible',
    color: '#4ade80',
    soft: 'rgba(74, 222, 128, 0.14)',
    description: 'Sin trabajo activo',
    icon: 'check',
    ariaLabel: 'Disponible, sin trabajo activo',
  },
  working: {
    label: 'Trabajando',
    color: '#60a5fa',
    soft: 'rgba(96, 165, 250, 0.14)',
    description: 'Ejecutando una tarea',
    icon: 'activity',
    ariaLabel: 'Trabajando en una tarea',
  },
  waiting_approval: {
    label: 'Espera aprobación',
    color: '#fbbf24',
    soft: 'rgba(251, 191, 36, 0.16)',
    description: 'Requiere intervención humana',
    icon: 'hand',
    ariaLabel: 'Esperando aprobación humana',
  },
  error: {
    label: 'Error',
    color: '#f87171',
    soft: 'rgba(248, 113, 113, 0.14)',
    description: 'La última tarea falló',
    icon: 'alert',
    ariaLabel: 'Error en la última tarea',
  },
  disconnected: {
    label: 'Desconectado',
    color: '#7d8a9c',
    soft: 'rgba(125, 138, 156, 0.16)',
    description: 'Sin conexión con el adaptador',
    icon: 'plug-off',
    ariaLabel: 'Sin conexión con el adaptador',
  },
}

export function statusMeta(status: AgentStatus) {
  return STATUS_META[status] ?? STATUS_META.disconnected
}

const BODY_COLORS = [
  '#e07a5f',
  '#81b29a',
  '#f2cc8f',
  '#9d8df1',
  '#5fb0b7',
  '#e9a6a6',
  '#f4a261',
  '#90be6d',
  '#b8a1d9',
  '#7aa2f7',
]

export function agentColor(name: string): string {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0
  }
  return BODY_COLORS[hash % BODY_COLORS.length] ?? '#7aa2f7'
}

export function formatTime(timestamp: number | null | undefined): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function toIso(timestamp: number | null | undefined): string | undefined {
  if (!timestamp) return undefined
  return new Date(timestamp).toISOString()
}

export function formatAbsolute(timestamp: number | null | undefined): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleString('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  })
}

export function formatDateTime(timestamp: number | null | undefined): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeAgo(timestamp: number | null | undefined): string {
  if (!timestamp) return '—'
  const diff = Date.now() - timestamp
  if (diff < 5_000) return 'ahora'
  if (diff < 60_000) return `hace ${Math.floor(diff / 1000)} s`
  if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`
  if (diff < 86_400_000) return `hace ${Math.floor(diff / 3_600_000)} h`
  return `hace ${Math.floor(diff / 86_400_000)} d`
}

export function taskStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    queued: 'En cola',
    running: 'En curso',
    completed: 'Completada',
    failed: 'Fallida',
    cancelled: 'Cancelada',
    pending: 'Pendiente',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    expired: 'Expirada',
  }
  return labels[status] ?? status
}
