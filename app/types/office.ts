export type AgentStatus =
  | 'available'
  | 'working'
  | 'waiting_approval'
  | 'error'
  | 'disconnected'

export type ConnectionStatus = 'connecting' | 'connected' | 'error' | 'disconnected'

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface ConnectionInfo {
  id: string
  name: string
  adapter: string
  enabled: boolean
  status: ConnectionStatus
  error: string | null
  lastConnectedAt: number | null
  config: Record<string, unknown>
}

export interface TaskSummary {
  id: string
  agentId: string
  agentName?: string
  title: string
  status: TaskStatus | string
  sessionId: string | null
  error?: string | null
  createdAt: number
  updatedAt?: number
  finishedAt?: number | null
}

export interface OfficeAgent {
  id: string
  name: string
  externalId: string
  connectionId: string
  connectionName: string
  status: AgentStatus
  statusReason: string | null
  mode: string | null
  description: string | null
  capabilities: string[]
  metadata: Record<string, unknown>
  lastSeenAt: number | null
  currentTask: TaskSummary | null
  pendingApprovals: number
  updatedAt: number
}

export interface ApprovalItem {
  id: string
  agentId: string
  agentName: string
  taskId: string | null
  title: string
  detail: string | null
  status: string
  createdAt: number
  resolvedAt?: number | null
  resolvedBy?: string | null
  error?: string | null
  externalId?: string
}

export interface ActivityEvent {
  id: string
  type: string
  level: string
  message: string
  agentId: string | null
  agentName?: string | null
  taskId: string | null
  sessionId: string | null
  payload: Record<string, unknown> | null
  createdAt: number
}

export interface OfficeState {
  serverTime: number
  connections: ConnectionInfo[]
  agents: OfficeAgent[]
  counts: Record<AgentStatus, number>
  approvals: ApprovalItem[]
  tasks: TaskSummary[]
  events: ActivityEvent[]
}

export interface AgentDetail {
  agent: {
    id: string
    name: string
    externalId: string
    connectionId: string
    connectionName: string
    connectionStatus: ConnectionStatus
    connectionError: string | null
    status: AgentStatus
    statusReason: string | null
    mode: string | null
    description: string | null
    capabilities: string[]
    metadata: Record<string, unknown>
    lastSeenAt: number | null
    updatedAt: number
  }
  tasks: TaskSummary[]
  events: ActivityEvent[]
  approvals: ApprovalItem[]
}

export interface TaskMessage {
  id: string
  role: string
  createdAt: number
  parts: Array<{ type: string; text?: string; tool?: string; status?: string }>
}

export interface TaskDetail {
  task: TaskSummary & { prompt: string; cancelRequestedAt: number | null }
  agent: { id: string; name: string; externalId: string; status: AgentStatus } | null
  events: ActivityEvent[]
  approvals: ApprovalItem[]
  messages: TaskMessage[]
  historyError: string | null
}

export interface AuditEntry {
  id: string
  actor: string
  action: string
  entityType: string
  entityId: string | null
  detail: Record<string, unknown> | null
  createdAt: number
}
