import type {
  AdapterContext,
  AgentAdapter,
  ConnectionConfig,
  CreateTaskInput,
  CreatedTask,
  NormalizedEvent,
  RemoteAgent,
  RemoteMessage,
} from './types'
import { clip, redact } from '../utils/redact'

interface OpenCodeSession {
  id: string
  title?: string
  agent?: string
  time?: { created?: number; updated?: number }
}

interface OpenCodePart {
  type?: string
  text?: string
  tool?: string
  synthetic?: boolean
  time?: { start?: number; end?: number }
  state?: { status?: string; title?: string; error?: string }
}

interface OpenCodeMessage {
  info?: { id?: string; role?: string; time?: { created?: number } }
  parts?: OpenCodePart[]
}

interface OpenCodeEvent {
  type?: string
  properties?: Record<string, unknown>
}

const CAPABILITIES = [
  'agents:list',
  'tasks:create',
  'tasks:cancel',
  'approvals:respond',
  'history:read',
] as const

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createOpenCodeAdapter(
  connection: ConnectionConfig,
  ctx: AdapterContext,
): AgentAdapter {
  const baseUrl = String(connection.config.baseUrl ?? '').replace(/\/+$/, '')
  const directory = typeof connection.config.directory === 'string' ? connection.config.directory : ''
  const username = typeof connection.config.username === 'string' ? connection.config.username : 'opencode'
  const password = typeof connection.config.password === 'string' ? connection.config.password : ''
  const modelOverride = typeof connection.config.model === 'string' ? connection.config.model.trim() : ''

  function modelPayload(): { providerID: string; modelID: string } | undefined {
    if (!modelOverride) return undefined
    const [providerID, ...rest] = modelOverride.split('/')
    const modelID = rest.join('/')
    if (!providerID || !modelID) return undefined
    return { providerID, modelID }
  }

  let connected = false
  let stopped = false
  let streamAbort: AbortController | null = null
  let loopStarted = false
  let retrying = false
  let attempt = 0

  if (!baseUrl) throw new Error(`Conexión ${connection.id} sin baseUrl`)

  function url(path: string): string {
    const target = new URL(`${baseUrl}${path}`)
    if (directory) target.searchParams.set('directory', directory)
    return target.toString()
  }

  function headers(): Record<string, string> {
    const value: Record<string, string> = { accept: 'application/json' }
    if (password) {
      value.authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
    }
    return value
  }

  async function request<T>(
    path: string,
    init: RequestInit = {},
    timeoutMs = 20000,
  ): Promise<T> {
    const response = await fetch(url(path), {
      ...init,
      headers: {
        ...headers(),
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      const body = clip(await response.text().catch(() => ''), 300)
      throw new Error(`OpenCode ${init.method ?? 'GET'} ${path} → ${response.status} ${body}`.trim())
    }
    if (response.status === 204) return undefined as T
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  function emit(event: NormalizedEvent) {
    try {
      ctx.emit(event)
    } catch (error) {
      console.error('[opencode-adapter] emit failed', errorMessage(error))
    }
  }

  function handleEvent(raw: OpenCodeEvent) {
    const type = raw.type
    const props = (raw.properties ?? {}) as Record<string, any>
    const sessionId: string | undefined = props.sessionID

    switch (type) {
      case 'server.connected':
        return
      case 'session.created': {
        const info = (props.info ?? {}) as Record<string, unknown>
        const parentID = typeof info.parentID === 'string' ? info.parentID : undefined
        if (!parentID) return
        const agent = typeof info.agent === 'string' ? info.agent : undefined
        emit({
          type: 'subtask.created',
          message: typeof info.title === 'string' ? info.title : 'Sesión delegada',
          agentExternalId: agent,
          sessionId,
          payload: {
            parentSessionId: parentID,
            agent,
            title: info.title ?? null,
          },
        })
        return
      }
      case 'session.status': {
        const status = props.status?.type ?? 'unknown'
        emit({
          type: 'task.status',
          message: status === 'busy' ? 'Sesión trabajando' : `Sesión en estado ${status}`,
          sessionId,
          payload: { status },
        })
        return
      }
      case 'session.idle':
        emit({
          type: 'task.status',
          message: 'Sesión inactiva',
          level: 'success',
          sessionId,
          payload: { idle: true },
        })
        return
      case 'session.error': {
        const error = props.error ?? {}
        const detail =
          error?.data?.message ?? error?.message ?? error?.name ?? 'Error desconocido de la sesión'
        emit({
          type: 'task.error',
          level: 'error',
          message: String(detail).slice(0, 500),
          sessionId,
          payload: redact({ error }) as Record<string, unknown>,
        })
        return
      }
      case 'permission.asked':
      case 'permission.v2.asked': {
        const permission = String(props.permission ?? props.action ?? 'acción')
        const patterns: string[] = Array.isArray(props.patterns)
          ? props.patterns.map(String)
          : Array.isArray(props.resources)
            ? props.resources.map(String)
            : []
        emit({
          type: 'approval.requested',
          level: 'warn',
          message: `Aprobación requerida: ${permission}`,
          sessionId,
          payload: redact({
            approvalId: props.id,
            permission,
            patterns,
            metadata: props.metadata ?? {},
          }) as Record<string, unknown>,
        })
        return
      }
      case 'permission.replied':
      case 'permission.v2.replied': {
        emit({
          type: 'approval.replied',
          message: `Aprobación respondida: ${String(props.reply ?? '')}`,
          sessionId,
          payload: { approvalId: props.requestID, reply: props.reply },
        })
        return
      }
      case 'message.part.updated': {
        const part: OpenCodePart = props.part ?? {}
        if (part.type === 'text' && part.time?.end && !part.synthetic && part.text?.trim()) {
          emit({
            type: 'assistant.text',
            message: clip(part.text.trim().replace(/\s+/g, ' '), 280),
            sessionId,
            payload: { partId: undefined },
          })
        }
        if (part.type === 'tool' && part.state?.status && part.state.status !== 'running') {
          const failed = part.state.status === 'error'
          emit({
            type: 'tool.activity',
            level: failed ? 'error' : 'info',
            message: `${part.tool ?? 'herramienta'} · ${part.state.title ?? part.state.status}`,
            sessionId,
            payload: redact({ tool: part.tool, status: part.state.status }) as Record<string, unknown>,
          })
        }
        return
      }
      case 'todo.updated': {
        const todos: Array<{ status?: string; content?: string }> = Array.isArray(props.todos)
          ? props.todos
          : []
        const done = todos.filter((todo) => todo.status === 'completed').length
        const current = todos.find((todo) => todo.status === 'in_progress')
        emit({
          type: 'plan.updated',
          message: current?.content
            ? `Plan ${done}/${todos.length}: ${current.content}`
            : `Plan actualizado ${done}/${todos.length}`,
          sessionId,
          payload: { done, total: todos.length },
        })
        return
      }
      default:
        return
    }
  }

  async function consumeStream(response: Response): Promise<void> {
    if (!response.body) throw new Error('El stream de eventos no devolvió cuerpo')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (!stopped) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary = buffer.indexOf('\n\n')
      while (boundary >= 0) {
        const chunk = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        boundary = buffer.indexOf('\n\n')
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data:')) continue
          const data = line.slice(5).trim()
          if (!data) continue
          try {
            handleEvent(JSON.parse(data) as OpenCodeEvent)
          } catch {
            // Ignore malformed keep-alive frames.
          }
        }
      }
    }
  }

  async function eventLoop(): Promise<void> {
    while (!stopped) {
      try {
        streamAbort = new AbortController()
        const response = await fetch(url('/event'), {
          headers: { ...headers(), accept: 'text/event-stream' },
          signal: streamAbort.signal,
        })
        if (!response.ok) throw new Error(`stream ${response.status}`)
        connected = true
        attempt = 0
        ctx.setConnectionState('connected')
        await consumeStream(response)
        if (!stopped) throw new Error('stream finalizado')
      } catch (error) {
        if (stopped) break
        connected = false
        const message = errorMessage(error)
        if (!(error instanceof Error && error.name === 'AbortError')) {
          ctx.setConnectionState('error', `Stream de eventos: ${message}`)
        }
        attempt += 1
        await delay(Math.min(30000, 1000 * 2 ** Math.min(attempt, 5)))
      }
    }
  }

  async function ping(): Promise<void> {
    const health = await request<{ healthy: boolean; version: string }>('/global/health', {}, 8000)
    if (!health?.healthy) throw new Error('El servidor de OpenCode no está saludable')
  }

  async function retryUntilHealthy(): Promise<void> {
    if (retrying) return
    retrying = true
    try {
      while (!stopped) {
        await delay(15_000)
        if (stopped) return
        try {
          await ping()
          connected = true
          attempt = 0
          ctx.setConnectionState('connected')
          if (!loopStarted) {
            loopStarted = true
            void eventLoop()
          }
          return
        } catch {
          // Keep waiting; the connection state already reports the error.
        }
      }
    } finally {
      retrying = false
    }
  }

  return {
    type: 'opencode',
    capabilities: [...CAPABILITIES],

    isConnected: () => connected,

    async connect() {
      stopped = false
      ctx.setConnectionState('connecting')
      try {
        await ping()
      } catch (error) {
        connected = false
        ctx.setConnectionState('error', errorMessage(error))
        void retryUntilHealthy()
        throw error
      }
      connected = true
      ctx.setConnectionState('connected')
      if (!loopStarted) {
        loopStarted = true
        void eventLoop()
      }
    },

    async disconnect() {
      stopped = true
      connected = false
      loopStarted = false
      streamAbort?.abort()
      streamAbort = null
      ctx.setConnectionState('disconnected')
    },

    async listAgents(): Promise<RemoteAgent[]> {
      const agents = await request<Array<Record<string, any>>>('/agent')
      return agents
        .filter((agent) => !agent.hidden && (agent.mode === 'primary' || agent.mode === 'all'))
        .map((agent) => ({
          externalId: String(agent.name),
          name: String(agent.name),
          description: typeof agent.description === 'string' ? agent.description : undefined,
          mode: typeof agent.mode === 'string' ? agent.mode : undefined,
          metadata: redact({
            native: agent.native,
            model: agent.model ?? null,
            temperature: agent.temperature ?? null,
            steps: agent.steps ?? null,
          }) as Record<string, unknown>,
        }))
    },

    async createTask(input: CreateTaskInput): Promise<CreatedTask> {
      const session = await request<OpenCodeSession>('/session', {
        method: 'POST',
        body: JSON.stringify({ title: input.title, agent: input.agentExternalId }),
      })
      if (!session?.id) throw new Error('OpenCode no devolvió el identificador de sesión')
      input.onSessionCreated?.(session.id)
      try {
        await request<unknown>(
          `/session/${encodeURIComponent(session.id)}/prompt_async`,
          {
            method: 'POST',
            body: JSON.stringify({
              agent: input.agentExternalId,
              ...(modelPayload() ? { model: modelPayload() } : {}),
              parts: [{ type: 'text', text: input.prompt }],
            }),
          },
          30000,
        )
      } catch (error) {
        await request(`/session/${encodeURIComponent(session.id)}`, { method: 'DELETE' }).catch(
          () => undefined,
        )
        throw error
      }
      return { sessionId: session.id }
    },

    async cancelTask(sessionId: string): Promise<boolean> {
      const result = await request<boolean>(
        `/session/${encodeURIComponent(sessionId)}/abort`,
        { method: 'POST' },
      )
      return result === true
    },

    async respondApproval(
      sessionId: string,
      approvalId: string,
      decision: 'approve' | 'reject',
      remember = false,
    ): Promise<boolean> {
      const response = decision === 'reject' ? 'reject' : remember ? 'always' : 'once'
      const result = await request<boolean>(
        `/session/${encodeURIComponent(sessionId)}/permissions/${encodeURIComponent(approvalId)}`,
        { method: 'POST', body: JSON.stringify({ response }) },
      )
      return result === true
    },

    async getMessages(sessionId: string, limit = 40): Promise<RemoteMessage[]> {
      const list = await request<OpenCodeMessage[]>(
        `/session/${encodeURIComponent(sessionId)}/message?limit=${limit}`,
      )
      return (list ?? []).slice(-limit).map((message, index) => ({
        id: message.info?.id ?? `message-${index}`,
        role: message.info?.role ?? 'assistant',
        createdAt: message.info?.time?.created ?? 0,
        parts: (message.parts ?? [])
          .filter((part) => part.type === 'text' || part.type === 'tool')
          .slice(0, 30)
          .map((part) =>
            part.type === 'tool'
              ? { type: 'tool', tool: part.tool, status: part.state?.status, text: part.state?.title }
              : { type: 'text', text: clip(part.text ?? '', 1500) },
          ),
      }))
    },
  }
}
