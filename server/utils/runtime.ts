import { randomUUID } from 'node:crypto'
import { getDb, now } from '../utils/db'
import { broadcast } from '../utils/hub'
import { clip, redact } from '../utils/redact'
import { createAdapter } from '../adapters/registry'
import type {
  AgentAdapter,
  AgentStatus,
  Capability,
  ConnectionConfig,
  ConnectionStatus,
  NormalizedEvent,
  RemoteAgent,
} from '../adapters/types'

interface AgentRow {
  id: string
  connection_id: string
  external_id: string
  name: string
  description: string | null
  mode: string | null
  status: AgentStatus
  status_reason: string | null
  capabilities_json: string
  metadata_json: string
  last_seen_at: number | null
  created_at: number
  updated_at: number
}

interface TaskRow {
  id: string
  agent_id: string
  connection_id: string
  title: string
  prompt: string
  status: string
  session_id: string | null
  error: string | null
  cancel_requested_at: number | null
  finished_at: number | null
  created_at: number
  updated_at: number
}

interface ApprovalRow {
  id: string
  agent_id: string
  task_id: string | null
  session_id: string
  external_id: string
  title: string
  detail: string | null
  status: string
  resolved_at: number | null
  resolved_by: string | null
  error: string | null
  created_at: number
}

interface SubtaskRow {
  id: string
  task_id: string
  agent_id: string
  session_id: string
  title: string
  status: string
  error: string | null
  created_at: number
  updated_at: number
  finished_at: number | null
}

interface ConnectionRow {
  id: string
  adapter_type: string
  name: string
  config_json: string
  enabled: number
  last_connected_at: number | null
  last_error: string | null
  created_at: number
}

interface Runtime {
  adapters: Map<string, AgentAdapter>
  configs: Map<string, ConnectionConfig>
  states: Map<string, { status: ConnectionStatus; error?: string }>
  init?: Promise<void>
  syncing: Set<string>
}

type RuntimeGlobal = typeof globalThis & { __agentOfficeRuntime?: Runtime }

function runtime(): Runtime {
  const g = globalThis as RuntimeGlobal
  if (!g.__agentOfficeRuntime) {
    g.__agentOfficeRuntime = {
      adapters: new Map(),
      configs: new Map(),
      states: new Map(),
      syncing: new Set(),
    }
  }
  return g.__agentOfficeRuntime
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function loadConnectionConfigs(): ConnectionConfig[] {
  const raw = process.env.AGENT_OFFICE_CONNECTIONS
  if (raw) {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error('AGENT_OFFICE_CONNECTIONS no es JSON válido')
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('AGENT_OFFICE_CONNECTIONS debe ser un array con al menos una conexión')
    }
    return parsed.map((item, index) => {
      const entry = item as Record<string, unknown>
      const adapter = String(entry.adapter ?? '')
      if (!adapter) throw new Error(`Conexión #${index} sin campo "adapter"`)
      return {
        id: String(entry.id ?? `${adapter}-${index + 1}`),
        adapter,
        name: String(entry.name ?? entry.id ?? adapter),
        enabled: entry.enabled !== false,
        config:
          entry.config && typeof entry.config === 'object'
            ? (entry.config as Record<string, unknown>)
            : {},
      }
    })
  }

  return [
    {
      id: 'opencode',
      adapter: 'opencode',
      name: process.env.OPENCODE_NAME || 'OpenCode',
      enabled: true,
      config: {
        baseUrl: process.env.OPENCODE_BASE_URL || 'http://127.0.0.1:4096',
        directory: process.env.OPENCODE_DIRECTORY || '',
        username: process.env.OPENCODE_SERVER_USERNAME || 'opencode',
        password: process.env.OPENCODE_SERVER_PASSWORD || '',
        model: process.env.OPENCODE_MODEL || '',
      },
    },
  ]
}

function publicConfig(config: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...config }
  delete cleaned.password
  return redact(cleaned) as Record<string, unknown>
}

function upsertConnection(connection: ConnectionConfig): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO connections (id, adapter_type, name, config_json, enabled, created_at)
     VALUES (@id, @adapter, @name, @config, @enabled, @created)
     ON CONFLICT(id) DO UPDATE SET
       adapter_type = excluded.adapter_type,
       name = excluded.name,
       config_json = excluded.config_json,
       enabled = excluded.enabled`,
  ).run({
    id: connection.id,
    adapter: connection.adapter,
    name: connection.name,
    config: JSON.stringify(publicConfig(connection.config)),
    enabled: connection.enabled === false ? 0 : 1,
    created: now(),
  })
}

function recordEvent(input: {
  connectionId?: string | null
  agentId?: string | null
  taskId?: string | null
  sessionId?: string | null
  type: string
  level?: string
  message: string
  payload?: unknown
}): Record<string, unknown> {
  const db = getDb()
  const row = {
    id: randomUUID(),
    connection_id: input.connectionId ?? null,
    agent_id: input.agentId ?? null,
    task_id: input.taskId ?? null,
    session_id: input.sessionId ?? null,
    type: input.type,
    level: input.level ?? 'info',
    message: clip(input.message, 1000),
    payload_json: input.payload === undefined ? null : clip(JSON.stringify(redact(input.payload)), 6000),
    created_at: now(),
  }
  db.prepare(
    `INSERT INTO events (id, connection_id, agent_id, task_id, session_id, type, level, message, payload_json, created_at)
     VALUES (@id, @connection_id, @agent_id, @task_id, @session_id, @type, @level, @message, @payload_json, @created_at)`,
  ).run(row)

  const event = { ...row, payload: parseJson(row.payload_json, null) }
  delete (event as Record<string, unknown>).payload_json
  broadcast({ kind: 'event', event })

  if (Math.random() < 0.02) {
    try {
      const total = db.prepare('SELECT COUNT(*) AS count FROM events').get() as { count: number }
      if (total.count > 20_000) {
        db.prepare(
          'DELETE FROM events WHERE id IN (SELECT id FROM events ORDER BY created_at ASC LIMIT ?)',
        ).run(total.count - 15_000)
      }
    } catch {
      // Non-critical retention cleanup.
    }
  }

  return event
}

function expireApprovals(taskId: string, reason: string): void {
  getDb()
    .prepare(
      "UPDATE approvals SET status = 'expired', error = ?, resolved_at = ? WHERE task_id = ? AND status = 'pending'",
    )
    .run(reason, now(), taskId)
}

function audit(
  actor: string,
  action: string,
  entityType: string,
  entityId: string | null,
  detail?: unknown,
): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO audit_log (id, actor, action, entity_type, entity_id, detail_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    actor,
    action,
    entityType,
    entityId,
    detail === undefined ? null : clip(JSON.stringify(redact(detail)), 6000),
    now(),
  )
}

function markConnectionAgentsDisconnected(connectionId: string, reason: string): void {
  const db = getDb()
  db.prepare(
    `UPDATE agents SET status = 'disconnected', status_reason = ?, updated_at = ?
     WHERE connection_id = ? AND status != 'disconnected'`,
  ).run(reason, now(), connectionId)
}

function setConnectionState(
  connectionId: string,
  status: ConnectionStatus,
  error?: string,
): void {
  const rt = runtime()
  const previous = rt.states.get(connectionId)
  if (previous && previous.status === status && previous.error === error) return
  rt.states.set(connectionId, { status, error })

  const db = getDb()
  db.prepare(
    `UPDATE connections
     SET last_error = ?, last_connected_at = CASE WHEN ? = 'connected' THEN ? ELSE last_connected_at END
     WHERE id = ?`,
  ).run(status === 'connected' ? null : (error ?? null), status, now(), connectionId)

  const connection = db.prepare('SELECT name FROM connections WHERE id = ?').get(connectionId) as
    | { name: string }
    | undefined
  const label = connection?.name ?? connectionId
  const messages: Record<ConnectionStatus, string> = {
    connecting: `Conectando con ${label}…`,
    connected: `${label} conectado`,
    error: `${label}: ${error ?? 'error de conexión'}`,
    disconnected: `${label} desconectado`,
  }
  const level: Record<ConnectionStatus, string> = {
    connecting: 'info',
    connected: 'success',
    error: 'error',
    disconnected: 'warn',
  }

  if (status !== 'connecting') {
    recordEvent({
      connectionId,
      type: 'adapter.status',
      level: level[status],
      message: messages[status],
      payload: { status, error },
    })
  }

  if (status === 'connected') {
    void syncAgents(connectionId)
  } else if (status === 'error' || status === 'disconnected') {
    markConnectionAgentsDisconnected(connectionId, messages[status])
    recomputeConnectionAgents(connectionId)
    broadcast({ kind: 'refresh', reason: 'connection' })
  }
}

function recomputeAgentStatus(agentId: string): AgentRow | undefined {
  const db = getDb()
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as AgentRow | undefined
  if (!agent) return undefined

  const state = runtime().states.get(agent.connection_id)
  const adapter = runtime().adapters.get(agent.connection_id)
  const connected = state?.status === 'connected' && adapter?.isConnected()

  let status: AgentStatus
  let reason: string | null

  if (!connected) {
    status = 'disconnected'
    reason = state?.error ?? 'Adaptador desconectado'
  } else {
    const pending = db
      .prepare("SELECT COUNT(*) AS count FROM approvals WHERE agent_id = ? AND status = 'pending'")
      .get(agentId) as { count: number }
    const running = db
      .prepare(
        `SELECT (
           (SELECT COUNT(*) FROM tasks WHERE agent_id = ? AND status IN ('queued','running'))
           +
           (SELECT COUNT(*) FROM subtasks WHERE agent_id = ? AND status IN ('queued','running'))
         ) AS count`,
      )
      .get(agentId, agentId) as { count: number }

    if (pending.count > 0) {
      status = 'waiting_approval'
      reason = 'Esperando aprobación humana'
    } else if (running.count > 0) {
      status = 'working'
      reason = 'Tarea en ejecución'
    } else {
      const lastTask = db
        .prepare('SELECT * FROM tasks WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1')
        .get(agentId) as TaskRow | undefined
      const lastSubtask = db
        .prepare('SELECT * FROM subtasks WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1')
        .get(agentId) as SubtaskRow | undefined
      const failed =
        lastTask?.status === 'failed' && (!lastSubtask || lastTask.updated_at >= lastSubtask.updated_at)
          ? lastTask
          : lastSubtask?.status === 'failed'
            ? lastSubtask
            : undefined
      if (failed && now() - failed.updated_at < 15 * 60 * 1000) {
        status = 'error'
        reason = clip(failed.error ?? 'La última ejecución falló', 280)
      } else {
        status = 'available'
        reason = null
      }
    }
  }

  if (agent.status !== status || agent.status_reason !== reason) {
    db.prepare('UPDATE agents SET status = ?, status_reason = ?, updated_at = ? WHERE id = ?').run(
      status,
      reason,
      now(),
      agentId,
    )
    broadcast({ kind: 'agent.status', agentId, status, reason })
  }
  return { ...agent, status, status_reason: reason }
}

function recomputeConnectionAgents(connectionId: string): void {
  const db = getDb()
  const rows = db.prepare('SELECT id FROM agents WHERE connection_id = ?').all(connectionId) as Array<{
    id: string
  }>
  for (const row of rows) recomputeAgentStatus(row.id)
}

async function syncAgents(connectionId: string): Promise<void> {
  const rt = runtime()
  const adapter = rt.adapters.get(connectionId)
  if (!adapter || !adapter.isConnected() || rt.syncing.has(connectionId)) return
  rt.syncing.add(connectionId)

  try {
    const remote = await adapter.listAgents()
    const db = getDb()
    const connection = db
      .prepare('SELECT * FROM connections WHERE id = ?')
      .get(connectionId) as ConnectionRow | undefined
    if (!connection) return

    const timestamp = now()
    const upsert = db.prepare(
      `INSERT INTO agents (
         id, connection_id, external_id, name, description, mode, status, status_reason,
         capabilities_json, metadata_json, last_seen_at, created_at, updated_at
       ) VALUES (
         @id, @connection_id, @external_id, @name, @description, @mode, 'available', NULL,
         @capabilities, @metadata, @last_seen, @created, @updated
       )
       ON CONFLICT(connection_id, external_id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         mode = excluded.mode,
         capabilities_json = excluded.capabilities_json,
         metadata_json = excluded.metadata_json,
         last_seen_at = excluded.last_seen_at,
         updated_at = excluded.updated_at`,
    )

    const seen = new Set<string>()
    const transaction = db.transaction((agents: RemoteAgent[]) => {
      for (const agent of agents) {
        seen.add(agent.externalId)
        upsert.run({
          id: randomUUID(),
          connection_id: connectionId,
          external_id: agent.externalId,
          name: agent.name,
          description: agent.description ?? null,
          mode: agent.mode ?? null,
          capabilities: JSON.stringify(adapter.capabilities),
          metadata: JSON.stringify(agent.metadata ?? {}),
          last_seen: timestamp,
          created: timestamp,
          updated: timestamp,
        })
      }
      const stale = db
        .prepare('SELECT id, external_id FROM agents WHERE connection_id = ?')
        .all(connectionId) as Array<{ id: string; external_id: string }>
      for (const row of stale) {
        if (!seen.has(row.external_id) && connection.enabled) {
          db.prepare(
            "UPDATE agents SET status = 'disconnected', status_reason = ?, updated_at = ? WHERE id = ?",
          ).run('El adaptador ya no ofrece este agente', timestamp, row.id)
        }
      }
    })
    transaction(remote)
    recomputeConnectionAgents(connectionId)
    broadcast({ kind: 'refresh', reason: 'agents' })
  } catch (error) {
    recordEvent({
      connectionId,
      type: 'adapter.error',
      level: 'error',
      message: `No se pudieron sincronizar agentes: ${errorMessage(error)}`,
    })
  } finally {
    rt.syncing.delete(connectionId)
  }
}

function findTaskBySession(sessionId: string): TaskRow | undefined {
  return getDb().prepare('SELECT * FROM tasks WHERE session_id = ?').get(sessionId) as
    | TaskRow
    | undefined
}

function findTaskById(taskId: string): TaskRow | undefined {
  return getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined
}

function findSubtaskBySession(sessionId: string): SubtaskRow | undefined {
  return getDb().prepare('SELECT * FROM subtasks WHERE session_id = ?').get(sessionId) as
    | SubtaskRow
    | undefined
}

function findAgentById(agentId: string): AgentRow | undefined {
  return getDb().prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as AgentRow | undefined
}

function findAgentByExternal(connectionId: string, externalId: string): AgentRow | undefined {
  return getDb()
    .prepare('SELECT * FROM agents WHERE connection_id = ? AND external_id = ?')
    .get(connectionId, externalId) as AgentRow | undefined
}

function expireSessionApprovals(sessionId: string, reason: string): void {
  getDb()
    .prepare(
      "UPDATE approvals SET status = 'expired', error = ?, resolved_at = ? WHERE session_id = ? AND status = 'pending'",
    )
    .run(reason, now(), sessionId)
}

function finishSubtasks(taskId: string, status: 'completed' | 'failed' | 'cancelled', reason?: string): void {
  const timestamp = now()
  getDb()
    .prepare(
      `UPDATE subtasks SET status = ?, error = ?, finished_at = COALESCE(finished_at, ?), updated_at = ?
       WHERE task_id = ? AND status IN ('queued','running')`,
    )
    .run(status, reason ?? null, timestamp, timestamp, taskId)
}

function agentForTask(task: TaskRow): AgentRow | undefined {
  return getDb().prepare('SELECT * FROM agents WHERE id = ?').get(task.agent_id) as AgentRow | undefined
}

function handleApprovalRequested(
  evt: NormalizedEvent,
  task: TaskRow,
  sessionId: string,
  agentId: string,
): boolean {
  if (['completed', 'failed', 'cancelled'].includes(task.status)) return false
  const db = getDb()
  const payload = (evt.payload ?? {}) as Record<string, unknown>
  const externalId = String(payload.approvalId ?? '')
  if (!externalId) return false
  const permission = String(payload.permission ?? 'acción')
  const patterns = Array.isArray(payload.patterns) ? payload.patterns.map(String) : []
  const detail = patterns.length ? patterns.join(', ') : null

  const existing = db
    .prepare('SELECT * FROM approvals WHERE session_id = ? AND external_id = ?')
    .get(sessionId, externalId) as ApprovalRow | undefined
  if (existing) return false

  const approval: ApprovalRow = {
    id: randomUUID(),
    agent_id: agentId,
    task_id: task.id,
    session_id: sessionId,
    external_id: externalId,
    title: permission,
    detail,
    status: 'pending',
    resolved_at: null,
    resolved_by: null,
    error: null,
    created_at: now(),
  }
  db.prepare(
    `INSERT INTO approvals (id, agent_id, task_id, session_id, external_id, title, detail, status, resolved_at, resolved_by, error, created_at)
     VALUES (@id, @agent_id, @task_id, @session_id, @external_id, @title, @detail, @status, @resolved_at, @resolved_by, @error, @created_at)`,
  ).run(approval)

  recordEvent({
    connectionId: task.connection_id,
    agentId,
    taskId: task.id,
    sessionId,
    type: 'approval.requested',
    level: 'warn',
    message: `Aprobación pendiente: ${permission}${detail ? ` · ${detail}` : ''}`,
    payload: { approvalId: approval.id, permission, patterns },
  })
  return true
}

function handleSubtaskCreated(connectionId: string, evt: NormalizedEvent): void {
  const db = getDb()
  const sessionId = evt.sessionId
  if (!sessionId) return
  const payload = (evt.payload ?? {}) as Record<string, unknown>
  const parentSessionId = String(payload.parentSessionId ?? '')
  if (!parentSessionId) return
  const parentTask = findTaskBySession(parentSessionId)
  if (!parentTask || ['completed', 'failed', 'cancelled'].includes(parentTask.status)) return

  const externalAgent =
    evt.agentExternalId ?? (typeof payload.agent === 'string' ? payload.agent : undefined)
  const worker =
    (externalAgent ? findAgentByExternal(connectionId, externalAgent) : undefined) ??
    findAgentById(parentTask.agent_id)
  if (!worker) return

  const existing = findSubtaskBySession(sessionId)
  if (existing) return

  const title = clip(evt.message || 'Sesión delegada', 180)
  const timestamp = now()
  const subtask: SubtaskRow = {
    id: randomUUID(),
    task_id: parentTask.id,
    agent_id: worker.id,
    session_id: sessionId,
    title,
    status: 'running',
    error: null,
    created_at: timestamp,
    updated_at: timestamp,
    finished_at: null,
  }
  db.prepare(
    `INSERT INTO subtasks (id, task_id, agent_id, session_id, title, status, error, created_at, updated_at, finished_at)
     VALUES (@id, @task_id, @agent_id, @session_id, @title, @status, @error, @created_at, @updated_at, @finished_at)`,
  ).run(subtask)

  recordEvent({
    connectionId,
    agentId: worker.id,
    taskId: parentTask.id,
    sessionId,
    type: 'subtask.created',
    level: 'info',
    message: `Delegado a ${worker.name}: ${title}`,
    payload: { agent: worker.external_id, parentSessionId },
  })
  recomputeAgentStatus(worker.id)
  broadcast({ kind: 'refresh', reason: 'subtask-created', agentId: worker.id, taskId: parentTask.id })
}

function handleAdapterEvent(connectionId: string, evt: NormalizedEvent): void {
  const db = getDb()
  if (evt.type === 'subtask.created') {
    handleSubtaskCreated(connectionId, evt)
    return
  }
  const mainTask = evt.sessionId ? findTaskBySession(evt.sessionId) : undefined
  const subtask =
    !mainTask && evt.sessionId ? findSubtaskBySession(evt.sessionId) : undefined
  const task = mainTask ?? (subtask ? findTaskById(subtask.task_id) : undefined)
  if (evt.sessionId && !task) return
  if (!task) {
    recordEvent({
      connectionId,
      type: evt.type,
      level: evt.level,
      message: evt.message,
      payload: evt.payload,
    })
    return
  }

  const isChild = Boolean(subtask)
  const agentId = subtask?.agent_id ?? task.agent_id
  const agent = findAgentById(agentId) ?? agentForTask(task)
  const sessionId = evt.sessionId ?? task.session_id ?? null
  const timestamp = now()
  let cancelledAbort = false

  switch (evt.type) {
    case 'task.status': {
      const payload = (evt.payload ?? {}) as Record<string, unknown>
      if (isChild && subtask) {
        if (!['completed', 'failed', 'cancelled'].includes(subtask.status)) {
          if (payload.idle === true) {
            db.prepare(
              "UPDATE subtasks SET status = 'completed', finished_at = ?, updated_at = ? WHERE id = ?",
            ).run(timestamp, timestamp, subtask.id)
            expireSessionApprovals(subtask.session_id, 'La sesión delegada terminó')
          } else {
            db.prepare(
              "UPDATE subtasks SET status = 'running', updated_at = ? WHERE id = ?",
            ).run(timestamp, subtask.id)
          }
        }
      } else if (
        !task.cancel_requested_at &&
        task.status !== 'completed' &&
        task.status !== 'failed'
      ) {
        if (payload.idle === true) {
          db.prepare(
            "UPDATE tasks SET status = 'completed', finished_at = ?, updated_at = ? WHERE id = ?",
          ).run(timestamp, timestamp, task.id)
          expireApprovals(task.id, 'La sesión terminó sin resolver la aprobación')
          finishSubtasks(task.id, 'completed')
        } else if (task.status === 'queued') {
          db.prepare("UPDATE tasks SET status = 'running', updated_at = ? WHERE id = ?").run(
            timestamp,
            task.id,
          )
        }
      }
      break
    }
    case 'task.error': {
      cancelledAbort = task.cancel_requested_at !== null && /abort/i.test(evt.message)
      if (isChild && subtask) {
        db.prepare(
          "UPDATE subtasks SET status = ?, error = ?, finished_at = ?, updated_at = ? WHERE id = ?",
        ).run(
          cancelledAbort ? 'cancelled' : 'failed',
          cancelledAbort ? null : evt.message,
          timestamp,
          timestamp,
          subtask.id,
        )
        expireSessionApprovals(subtask.session_id, cancelledAbort ? 'La ejecución fue cancelada' : 'La ejecución falló')
        if (agent) {
          audit('opencode', 'subtask.failed', 'subtask', subtask.id, {
            agentId: agent.id,
            taskId: task.id,
            message: evt.message,
          })
        }
      } else if (cancelledAbort) {
        db.prepare(
          "UPDATE tasks SET status = 'cancelled', error = NULL, finished_at = COALESCE(finished_at, ?), updated_at = ? WHERE id = ?",
        ).run(timestamp, timestamp, task.id)
        expireApprovals(task.id, 'La ejecución fue cancelada')
        finishSubtasks(task.id, 'cancelled', 'La tarea padre fue cancelada')
      } else {
        db.prepare(
          "UPDATE tasks SET status = 'failed', error = ?, finished_at = ?, updated_at = ? WHERE id = ?",
        ).run(evt.message, timestamp, timestamp, task.id)
        expireApprovals(task.id, 'La ejecución falló')
        finishSubtasks(task.id, 'failed', 'La tarea padre falló')
        if (agent) recordAuditTaskError(agent.id, task.id, evt.message)
      }
      break
    }
    case 'approval.requested': {
      if (sessionId) handleApprovalRequested(evt, task, sessionId, agentId)
      break
    }
    case 'approval.replied': {
      const payload = (evt.payload ?? {}) as Record<string, unknown>
      const externalId = String(payload.approvalId ?? '')
      const reply = String(payload.reply ?? '')
      const approval = db
        .prepare('SELECT * FROM approvals WHERE session_id = ? AND external_id = ?')
        .get(sessionId, externalId) as ApprovalRow | undefined
      if (approval && approval.status === 'pending') {
        db.prepare(
          'UPDATE approvals SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?',
        ).run(reply === 'reject' ? 'rejected' : 'approved', timestamp, 'opencode', approval.id)
        recordEvent({
          connectionId,
          agentId: approval.agent_id,
          taskId: task.id,
          sessionId,
          type: 'approval.resolved',
          level: reply === 'reject' ? 'warn' : 'success',
          message: `Aprobación ${reply === 'reject' ? 'rechazada' : 'aprobada'} desde OpenCode`,
          payload: { approvalId: approval.id, reply, source: 'opencode' },
        })
      }
      break
    }
    case 'task.cancelled': {
      if (isChild && subtask) {
        db.prepare(
          "UPDATE subtasks SET status = 'cancelled', finished_at = ?, updated_at = ? WHERE id = ?",
        ).run(timestamp, timestamp, subtask.id)
      } else {
        db.prepare(
          "UPDATE tasks SET status = 'cancelled', finished_at = ?, updated_at = ? WHERE id = ?",
        ).run(timestamp, timestamp, task.id)
        finishSubtasks(task.id, 'cancelled', 'La tarea padre fue cancelada')
      }
      break
    }
    default:
      break
  }

  if (evt.type !== 'approval.requested' && evt.type !== 'approval.replied') {
    recordEvent({
      connectionId,
      agentId,
      taskId: task.id,
      sessionId,
      type: cancelledAbort ? 'task.cancelled' : evt.type,
      level: cancelledAbort ? 'warn' : evt.level,
      message: cancelledAbort ? 'Ejecución abortada por cancelación' : evt.message,
      payload: evt.payload,
    })
  }

  recomputeAgentStatus(agentId)
  if (agentId !== task.agent_id) recomputeAgentStatus(task.agent_id)
  broadcast({ kind: 'refresh', reason: 'task-event', agentId, taskId: task.id })
}

function recordAuditTaskError(agentId: string, taskId: string, message: string): void {
  audit('opencode', 'task.failed', 'task', taskId, { agentId, message })
}

function ensureAdapter(connection: ConnectionConfig): AgentAdapter {
  const rt = runtime()
  const existing = rt.adapters.get(connection.id)
  if (existing) return existing

  const adapter = createAdapter(connection, {
    connectionId: connection.id,
    emit: (event) => handleAdapterEvent(connection.id, event),
    setConnectionState: (status, error) => setConnectionState(connection.id, status, error),
  })
  rt.adapters.set(connection.id, adapter)
  return adapter
}

export async function initializeRuntime(): Promise<void> {
  const rt = runtime()
  if (rt.init) return rt.init

  rt.init = (async () => {
    const configs = loadConnectionConfigs()
    for (const connection of configs) {
      rt.configs.set(connection.id, connection)
      upsertConnection(connection)
      if (connection.enabled === false) continue
      const adapter = ensureAdapter(connection)
      try {
        await adapter.connect()
        await syncAgents(connection.id)
      } catch (error) {
        setConnectionState(connection.id, 'error', errorMessage(error))
      }
    }
  })()

  return rt.init
}

export function connectionStatus(connectionId: string): {
  status: ConnectionStatus
  error?: string
} {
  return runtime().states.get(connectionId) ?? { status: 'disconnected' }
}

export function getState() {
  const db = getDb()
  const connections = db.prepare('SELECT * FROM connections ORDER BY created_at').all() as ConnectionRow[]
  const agents = db.prepare('SELECT * FROM agents ORDER BY name').all() as AgentRow[]
  const approvals = db
    .prepare("SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at DESC")
    .all() as ApprovalRow[]
  const tasks = db
    .prepare(
      `SELECT t.*, a.name AS agent_name FROM tasks t
       JOIN agents a ON a.id = t.agent_id
       ORDER BY t.created_at DESC LIMIT 20`,
    )
    .all() as Array<TaskRow & { agent_name: string }>

  const recentEvents = db
    .prepare(
      `SELECT e.*, a.name AS agent_name FROM events e
       LEFT JOIN agents a ON a.id = e.agent_id
       ORDER BY e.created_at DESC LIMIT 40`,
    )
    .all() as Array<Record<string, unknown> & { agent_name: string | null }>

  const counts: Record<AgentStatus, number> = {
    available: 0,
    working: 0,
    waiting_approval: 0,
    error: 0,
    disconnected: 0,
  }

  const publicAgents = agents.map((agent) => {
    counts[agent.status] += 1
    const connection = connections.find((item) => item.id === agent.connection_id)
    const active = db
      .prepare(
        "SELECT * FROM tasks WHERE agent_id = ? AND status IN ('queued','running') ORDER BY created_at DESC LIMIT 1",
      )
      .get(agent.id) as TaskRow | undefined
    const activeSubtask = active
      ? undefined
      : (db
          .prepare(
            `SELECT s.*, t.title AS parent_title, t.session_id AS parent_session_id
             FROM subtasks s JOIN tasks t ON t.id = s.task_id
             WHERE s.agent_id = ? AND s.status IN ('queued','running')
             ORDER BY s.created_at DESC LIMIT 1`,
          )
          .get(agent.id) as
          | (SubtaskRow & { parent_title: string; parent_session_id: string | null })
          | undefined)
    const latest = active ?? (db
      .prepare('SELECT * FROM tasks WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(agent.id) as TaskRow | undefined)
    const lastSubtask =
      active || latest
        ? undefined
        : (db
            .prepare(
              `SELECT s.*, t.title AS parent_title, t.session_id AS parent_session_id
               FROM subtasks s JOIN tasks t ON t.id = s.task_id
               WHERE s.agent_id = ? ORDER BY s.created_at DESC LIMIT 1`,
            )
            .get(agent.id) as
            | (SubtaskRow & { parent_title: string; parent_session_id: string | null })
            | undefined)
    const pending = db
      .prepare("SELECT COUNT(*) AS count FROM approvals WHERE agent_id = ? AND status = 'pending'")
      .get(agent.id) as { count: number }

    const currentTask = active
      ? {
          id: active.id,
          title: active.title,
          status: active.status,
          createdAt: active.created_at,
          sessionId: active.session_id,
        }
      : activeSubtask
        ? {
            id: activeSubtask.task_id,
            title: `↳ ${activeSubtask.parent_title}`,
            status: 'running',
            createdAt: activeSubtask.created_at,
            sessionId: activeSubtask.parent_session_id,
            delegated: true,
          }
        : latest
          ? {
              id: latest.id,
              title: latest.title,
              status: latest.status,
              createdAt: latest.created_at,
              sessionId: latest.session_id,
            }
          : lastSubtask
            ? {
                id: lastSubtask.task_id,
                title: `↳ ${lastSubtask.parent_title}`,
                status: lastSubtask.status,
                createdAt: lastSubtask.created_at,
                sessionId: lastSubtask.parent_session_id,
                delegated: true,
              }
            : null

    return {
      id: agent.id,
      name: agent.name,
      externalId: agent.external_id,
      connectionId: agent.connection_id,
      connectionName: connection?.name ?? agent.connection_id,
      status: agent.status,
      statusReason: agent.status_reason,
      mode: agent.mode,
      description: agent.description,
      capabilities: parseJson<Capability[]>(agent.capabilities_json, []),
      metadata: parseJson<Record<string, unknown>>(agent.metadata_json, {}),
      lastSeenAt: agent.last_seen_at,
      currentTask,
      pendingApprovals: pending.count,
      updatedAt: agent.updated_at,
    }
  })

  return {
    serverTime: now(),
    connections: connections.map((connection) => {
      const state = connectionStatus(connection.id)
      return {
        id: connection.id,
        name: connection.name,
        adapter: connection.adapter_type,
        enabled: Boolean(connection.enabled),
        status: state.status,
        error: state.error ?? connection.last_error,
        lastConnectedAt: connection.last_connected_at,
        config: parseJson<Record<string, unknown>>(connection.config_json, {}),
      }
    }),
    agents: publicAgents,
    counts,
    approvals: approvals.map((approval) => {
      const agent = agents.find((item) => item.id === approval.agent_id)
      return {
        id: approval.id,
        agentId: approval.agent_id,
        agentName: agent?.name ?? 'Agente',
        taskId: approval.task_id,
        title: approval.title,
        detail: approval.detail,
        status: approval.status,
        createdAt: approval.created_at,
      }
    }),
    tasks: tasks.map((task) => ({
      id: task.id,
      agentId: task.agent_id,
      agentName: task.agent_name,
      title: task.title,
      status: task.status,
      sessionId: task.session_id,
      error: task.error,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      finishedAt: task.finished_at,
    })),
    events: recentEvents.map((event) => ({
      ...publicStoredEvent(event),
      agentName: event.agent_name,
    })),
  }
}

export function getAgentDetail(agentId: string) {
  const db = getDb()
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as AgentRow | undefined
  if (!agent) return null

  const connection = db
    .prepare('SELECT * FROM connections WHERE id = ?')
    .get(agent.connection_id) as ConnectionRow | undefined
  const state = connectionStatus(agent.connection_id)
  const tasks = db
    .prepare('SELECT * FROM tasks WHERE agent_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(agentId) as TaskRow[]
  const events = db
    .prepare('SELECT * FROM events WHERE agent_id = ? ORDER BY created_at DESC LIMIT 80')
    .all(agentId) as Array<Record<string, unknown>>
  const approvals = db
    .prepare('SELECT * FROM approvals WHERE agent_id = ? ORDER BY created_at DESC LIMIT 30')
    .all(agentId) as ApprovalRow[]
  const delegations = db
    .prepare(
      `SELECT s.*, t.title AS parent_title, a.name AS agent_name
       FROM subtasks s
       JOIN tasks t ON t.id = s.task_id
       LEFT JOIN agents a ON a.id = s.agent_id
       WHERE s.agent_id = ? ORDER BY s.created_at DESC LIMIT 20`,
    )
    .all(agentId) as Array<SubtaskRow & { parent_title: string; agent_name: string | null }>

  return {
    agent: {
      id: agent.id,
      name: agent.name,
      externalId: agent.external_id,
      connectionId: agent.connection_id,
      connectionName: connection?.name ?? agent.connection_id,
      connectionStatus: state.status,
      connectionError: state.error ?? connection?.last_error ?? null,
      status: agent.status,
      statusReason: agent.status_reason,
      mode: agent.mode,
      description: agent.description,
      capabilities: parseJson<Capability[]>(agent.capabilities_json, []),
      metadata: parseJson<Record<string, unknown>>(agent.metadata_json, {}),
      lastSeenAt: agent.last_seen_at,
      updatedAt: agent.updated_at,
    },
    tasks: tasks.map(publicTask),
    events: events.map((event) => ({
      ...publicStoredEvent(event),
      agentName: agent.name,
    })),
    approvals: approvals.map((approval) => ({
      id: approval.id,
      title: approval.title,
      detail: approval.detail,
      status: approval.status,
      taskId: approval.task_id,
      createdAt: approval.created_at,
      resolvedAt: approval.resolved_at,
      resolvedBy: approval.resolved_by,
      error: approval.error,
    })),
    delegations: delegations.map((subtask) => ({
      ...publicSubtask(subtask),
      parentTitle: subtask.parent_title,
    })),
  }
}

function publicTask(task: TaskRow) {
  return {
    id: task.id,
    agentId: task.agent_id,
    title: task.title,
    prompt: task.prompt,
    status: task.status,
    sessionId: task.session_id,
    error: task.error,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    finishedAt: task.finished_at,
    cancelRequestedAt: task.cancel_requested_at,
  }
}

function publicSubtask(subtask: SubtaskRow & { agent_name?: string | null }) {
  return {
    id: subtask.id,
    taskId: subtask.task_id,
    agentId: subtask.agent_id,
    agentName: subtask.agent_name ?? null,
    sessionId: subtask.session_id,
    title: subtask.title,
    status: subtask.status,
    error: subtask.error,
    createdAt: subtask.created_at,
    updatedAt: subtask.updated_at,
    finishedAt: subtask.finished_at,
  }
}

function publicStoredEvent(row: Record<string, unknown>) {
  return {
    id: row.id,
    type: row.type,
    level: row.level,
    message: row.message,
    agentId: row.agent_id,
    taskId: row.task_id,
    sessionId: row.session_id,
    payload: parseJson(row.payload_json as string, null),
    createdAt: row.created_at,
  }
}

export async function getTaskDetail(taskId: string) {
  const db = getDb()
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined
  if (!task) return null
  const agent = agentForTask(task)
  const events = db
    .prepare(
      `SELECT e.*, a.name AS agent_name FROM events e
       LEFT JOIN agents a ON a.id = e.agent_id
       WHERE e.task_id = ? ORDER BY e.created_at DESC LIMIT 120`,
    )
    .all(taskId) as Array<Record<string, unknown> & { agent_name: string | null }>
  const approvals = db
    .prepare('SELECT * FROM approvals WHERE task_id = ? ORDER BY created_at DESC')
    .all(taskId) as ApprovalRow[]
  const subtasks = db
    .prepare(
      `SELECT s.*, a.name AS agent_name FROM subtasks s
       LEFT JOIN agents a ON a.id = s.agent_id
       WHERE s.task_id = ? ORDER BY s.created_at ASC`,
    )
    .all(taskId) as Array<SubtaskRow & { agent_name: string | null }>

  let messages: unknown[] = []
  let historyError: string | null = null
  const adapter = runtime().adapters.get(task.connection_id)
  if (task.session_id && adapter?.isConnected() && adapter.capabilities.includes('history:read')) {
    try {
      messages = await adapter.getMessages?.(task.session_id, 40) ?? []
    } catch (error) {
      historyError = errorMessage(error)
    }
  }

  return {
    task: publicTask(task),
    agent: agent
      ? { id: agent.id, name: agent.name, externalId: agent.external_id, status: agent.status }
      : null,
    events: events.map((event) => ({
      ...publicStoredEvent(event),
      agentName: event.agent_name,
    })),
    approvals: approvals.map((approval) => ({
      id: approval.id,
      externalId: approval.external_id,
      title: approval.title,
      detail: approval.detail,
      status: approval.status,
      createdAt: approval.created_at,
      resolvedAt: approval.resolved_at,
      resolvedBy: approval.resolved_by,
      error: approval.error,
    })),
    subtasks: subtasks.map(publicSubtask),
    messages,
    historyError,
  }
}

export function listAudit(limit = 100) {
  const rows = getDb()
    .prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?')
    .all(Math.min(Math.max(limit, 1), 500)) as Array<Record<string, unknown>>
  return rows.map((row) => ({
    id: row.id,
    actor: row.actor,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    detail: parseJson(row.detail_json as string, null),
    createdAt: row.created_at,
  }))
}

export async function reconnectConnection(connectionId: string, actor: string) {
  const rt = runtime()
  let config = rt.configs.get(connectionId)
  if (!config) {
    config = loadConnectionConfigs().find((item) => item.id === connectionId)
  }
  if (!config) {
    const row = getDb()
      .prepare('SELECT * FROM connections WHERE id = ?')
      .get(connectionId) as ConnectionRow | undefined
    if (!row) return null
    config = {
      id: row.id,
      adapter: row.adapter_type,
      name: row.name,
      config: parseJson<Record<string, unknown>>(row.config_json, {}),
    }
  }
  rt.configs.set(connectionId, config)

  const existing = rt.adapters.get(connectionId)
  if (existing) {
    await existing.disconnect().catch(() => undefined)
    rt.adapters.delete(connectionId)
  }

  const adapter = ensureAdapter(config)
  audit(actor, 'connection.reconnect', 'connection', connectionId)
  try {
    await adapter.connect()
    await syncAgents(connectionId)
    return { ok: true, status: connectionStatus(connectionId) }
  } catch (error) {
    setConnectionState(connectionId, 'error', errorMessage(error))
    return { ok: false, status: connectionStatus(connectionId), error: errorMessage(error) }
  }
}

export interface CreateTaskPayload {
  agentId: string
  title: string
  prompt: string
}

export async function createTask(agentId: string, payload: CreateTaskPayload, actor: string) {
  const db = getDb()
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as AgentRow | undefined
  if (!agent) {
    return { ok: false as const, status: 404, error: 'Agente no encontrado' }
  }
  const capabilities = parseJson<Capability[]>(agent.capabilities_json, [])
  if (!capabilities.includes('tasks:create')) {
    return { ok: false as const, status: 409, error: 'El agente no declara la capacidad tasks:create' }
  }
  const state = runtime().states.get(agent.connection_id)
  const adapter = runtime().adapters.get(agent.connection_id)
  if (state?.status !== 'connected' || !adapter?.isConnected()) {
    return { ok: false as const, status: 409, error: 'La conexión del agente no está disponible' }
  }

  const title = payload.title.trim()
  const prompt = payload.prompt.trim()
  if (title.length < 3 || title.length > 120) {
    return { ok: false as const, status: 400, error: 'El título debe tener entre 3 y 120 caracteres' }
  }
  if (prompt.length < 3 || prompt.length > 8000) {
    return { ok: false as const, status: 400, error: 'El prompt debe tener entre 3 y 8000 caracteres' }
  }

  const taskId = randomUUID()
  const timestamp = now()

  const active = db
    .prepare(
      "SELECT COUNT(*) AS count FROM tasks WHERE agent_id = ? AND status IN ('queued','running')",
    )
    .get(agentId) as { count: number }
  if (active.count > 0) {
    return {
      ok: false as const,
      status: 409,
      error: 'El agente ya tiene una tarea activa. Cancélala antes de asignar otra.',
    }
  }

  db.prepare(
    `INSERT INTO tasks (id, agent_id, connection_id, title, prompt, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)`,
  ).run(taskId, agentId, agent.connection_id, title, prompt, timestamp, timestamp)

  audit(actor, 'task.create', 'task', taskId, { agentId, title })

  try {
    const created = await adapter.createTask({
      agentExternalId: agent.external_id,
      title,
      prompt,
      onSessionCreated: (sessionId) => {
        db.prepare(
          "UPDATE tasks SET session_id = ?, status = 'running', updated_at = ? WHERE id = ?",
        ).run(sessionId, now(), taskId)
        recordEvent({
          connectionId: agent.connection_id,
          agentId,
          taskId,
          sessionId,
          type: 'task.created',
          level: 'info',
          message: `Tarea asignada: ${title}`,
          payload: { title },
        })
      },
    })

    db.prepare(
      "UPDATE tasks SET session_id = COALESCE(session_id, ?), status = CASE WHEN status = 'queued' THEN 'running' ELSE status END, updated_at = ? WHERE id = ?",
    ).run(created.sessionId, now(), taskId)

    recomputeAgentStatus(agentId)
    broadcast({ kind: 'refresh', reason: 'task-created', agentId, taskId })
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow
    return { ok: true as const, task: publicTask(task) }
  } catch (error) {
    const message = errorMessage(error)
    db.prepare(
      "UPDATE tasks SET status = 'failed', error = ?, finished_at = ?, updated_at = ? WHERE id = ?",
    ).run(message, now(), now(), taskId)
    audit(actor, 'task.create.failed', 'task', taskId, { agentId, error: message })
    recordEvent({
      connectionId: agent.connection_id,
      agentId,
      taskId,
      sessionId: null,
      type: 'task.error',
      level: 'error',
      message: `No se pudo crear la tarea: ${message}`,
    })
    recomputeAgentStatus(agentId)
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow
    return { ok: false as const, status: 502, error: message, task: publicTask(task) }
  }
}

export async function cancelTask(taskId: string, actor: string) {
  const db = getDb()
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined
  if (!task) return { ok: false as const, status: 404, error: 'Tarea no encontrada' }
  if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
    return { ok: false as const, status: 409, error: `La tarea ya está ${task.status}` }
  }
  const agent = agentForTask(task)
  if (!agent) return { ok: false as const, status: 404, error: 'Agente no encontrado' }
  const adapter = runtime().adapters.get(task.connection_id)
  if (!task.session_id) {
    db.prepare(
      "UPDATE tasks SET status = 'cancelled', finished_at = ?, updated_at = ? WHERE id = ?",
    ).run(now(), now(), taskId)
    expireApprovals(taskId, 'La tarea fue cancelada')
    audit(actor, 'task.cancel', 'task', taskId, { confirmed: true, reason: 'sin sesión remota' })
    recordEvent({
      agentId: task.agent_id,
      connectionId: task.connection_id,
      taskId,
      type: 'task.cancelled',
      level: 'success',
      message: 'Tarea cancelada antes de crear la sesión remota',
    })
    recomputeAgentStatus(task.agent_id)
    return { ok: true as const, confirmed: true }
  }
  if (!adapter?.isConnected()) {
    audit(actor, 'task.cancel.failed', 'task', taskId, { error: 'conexión no disponible' })
    return { ok: false as const, confirmed: false, status: 409, error: 'La conexión no está disponible' }
  }

  db.prepare('UPDATE tasks SET cancel_requested_at = ?, updated_at = ? WHERE id = ?').run(
    now(),
    now(),
    taskId,
  )

  try {
    const confirmed = await adapter.cancelTask(task.session_id)
    if (!confirmed) {
      audit(actor, 'task.cancel.failed', 'task', taskId, { error: 'el adaptador no confirmó' })
      recordEvent({
        agentId: task.agent_id,
        connectionId: task.connection_id,
        taskId,
        sessionId: task.session_id,
        type: 'task.cancel.failed',
        level: 'error',
        message: 'La cancelación no fue confirmada por OpenCode',
      })
      return { ok: false as const, confirmed: false, error: 'La cancelación no fue confirmada' }
    }
    db.prepare(
      "UPDATE tasks SET status = 'cancelled', finished_at = ?, updated_at = ? WHERE id = ?",
    ).run(now(), now(), taskId)
    expireApprovals(taskId, 'La tarea fue cancelada')
    finishSubtasks(taskId, 'cancelled', 'La tarea padre fue cancelada')
    audit(actor, 'task.cancel', 'task', taskId, { confirmed: true })
    recordEvent({
      agentId: task.agent_id,
      connectionId: task.connection_id,
      taskId,
      sessionId: task.session_id,
      type: 'task.cancelled',
      level: 'success',
      message: 'Cancelación confirmada por OpenCode',
    })
    recomputeAgentStatus(task.agent_id)
    return { ok: true as const, confirmed: true }
  } catch (error) {
    const message = errorMessage(error)
    audit(actor, 'task.cancel.failed', 'task', taskId, { error: message })
    recordEvent({
      agentId: task.agent_id,
      connectionId: task.connection_id,
      taskId,
      sessionId: task.session_id,
      type: 'task.cancel.failed',
      level: 'error',
      message: `Cancelación fallida: ${message}`,
    })
    return { ok: false as const, confirmed: false, error: message }
  }
}

export async function respondToApproval(
  approvalId: string,
  decision: 'approve' | 'reject',
  remember: boolean,
  actor: string,
) {
  const db = getDb()
  const approval = db.prepare('SELECT * FROM approvals WHERE id = ?').get(approvalId) as
    | ApprovalRow
    | undefined
  if (!approval) return { ok: false as const, status: 404, error: 'Aprobación no encontrada' }
  if (approval.status !== 'pending') {
    return { ok: false as const, status: 409, error: `La aprobación ya está ${approval.status}` }
  }
  const task = approval.task_id
    ? (db.prepare('SELECT * FROM tasks WHERE id = ?').get(approval.task_id) as TaskRow | undefined)
    : undefined
  const adapter = runtime().adapters.get(task?.connection_id ?? '')
  if (!task || !adapter?.isConnected()) {
    return { ok: false as const, status: 409, error: 'La conexión del agente no está disponible' }
  }

  try {
    const confirmed = await adapter.respondApproval(
      approval.session_id,
      approval.external_id,
      decision,
      remember,
    )
    if (!confirmed) {
      audit(actor, 'approval.respond.failed', 'approval', approvalId, { decision })
      return { ok: false as const, confirmed: false, error: 'OpenCode no confirmó la respuesta' }
    }
    db.prepare(
      'UPDATE approvals SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?',
    ).run(decision === 'approve' ? 'approved' : 'rejected', now(), actor, approvalId)
    audit(actor, `approval.${decision}`, 'approval', approvalId, {
      taskId: task.id,
      remember,
    })
    recordEvent({
      agentId: approval.agent_id,
      connectionId: task.connection_id,
      taskId: task.id,
      sessionId: approval.session_id,
      type: 'approval.resolved',
      level: decision === 'approve' ? 'success' : 'warn',
      message: decision === 'approve' ? 'Aprobación concedida por el operador' : 'Aprobación rechazada por el operador',
      payload: { approvalId, decision, remember },
    })
    recomputeAgentStatus(approval.agent_id)
    return { ok: true as const, confirmed: true }
  } catch (error) {
    const message = errorMessage(error)
    audit(actor, 'approval.respond.failed', 'approval', approvalId, { decision, error: message })
    recordEvent({
      agentId: approval.agent_id,
      connectionId: task.connection_id,
      taskId: task.id,
      sessionId: approval.session_id,
      type: 'approval.failed',
      level: 'error',
      message: `No se pudo responder la aprobación: ${message}`,
    })
    return { ok: false as const, confirmed: false, error: message }
  }
}

export function auditAction(
  actor: string,
  action: string,
  entityType: string,
  entityId: string | null,
  detail?: unknown,
): void {
  audit(actor, action, entityType, entityId, detail)
}
