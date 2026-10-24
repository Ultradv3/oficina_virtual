export type Capability =
  | 'agents:list'
  | 'tasks:create'
  | 'tasks:cancel'
  | 'approvals:respond'
  | 'history:read'

export type AgentStatus =
  | 'available'
  | 'working'
  | 'waiting_approval'
  | 'error'
  | 'disconnected'

export type ConnectionStatus = 'connecting' | 'connected' | 'error' | 'disconnected'

export interface ConnectionConfig {
  id: string
  adapter: string
  name: string
  config: Record<string, unknown>
  enabled?: boolean
}

export interface RemoteAgent {
  externalId: string
  name: string
  description?: string
  mode?: string
  metadata?: Record<string, unknown>
}

export interface CreateTaskInput {
  agentExternalId: string
  title: string
  prompt: string
  onSessionCreated?: (sessionId: string) => void
}

export interface CreatedTask {
  sessionId: string
  remoteUrl?: string
}

export interface RemoteMessage {
  id: string
  role: string
  createdAt: number
  parts: Array<{ type: string; text?: string; tool?: string; status?: string }>
}

export type NormalizedEventType =
  | 'adapter.status'
  | 'task.status'
  | 'approval.requested'
  | 'approval.replied'
  | 'assistant.text'
  | 'tool.activity'
  | 'plan.updated'
  | 'task.error'
  | 'task.cancelled'

export interface NormalizedEvent {
  type: NormalizedEventType
  message: string
  level?: 'info' | 'warn' | 'error' | 'success'
  agentExternalId?: string
  sessionId?: string
  payload?: Record<string, unknown>
}

export interface AdapterContext {
  connectionId: string
  emit: (event: NormalizedEvent) => void
  setConnectionState: (status: ConnectionStatus, error?: string) => void
}

export interface AgentAdapter {
  readonly type: string
  readonly capabilities: Capability[]
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  listAgents: () => Promise<RemoteAgent[]>
  createTask: (input: CreateTaskInput) => Promise<CreatedTask>
  cancelTask: (sessionId: string) => Promise<boolean>
  respondApproval: (
    sessionId: string,
    approvalId: string,
    decision: 'approve' | 'reject',
    remember?: boolean,
  ) => Promise<boolean>
  getMessages?: (sessionId: string, limit?: number) => Promise<RemoteMessage[]>
  isConnected: () => boolean
}

export type AdapterFactory = (
  connection: ConnectionConfig,
  context: AdapterContext,
) => AgentAdapter
