import type { AdapterContext, AdapterFactory, AgentAdapter, ConnectionConfig } from './types'
import { createOpenCodeAdapter } from './opencode'

const factories = new Map<string, AdapterFactory>()

export function registerAdapterFactory(type: string, factory: AdapterFactory): void {
  factories.set(type, factory)
}

registerAdapterFactory('opencode', createOpenCodeAdapter)

export function adapterTypes(): string[] {
  return [...factories.keys()]
}

export function createAdapter(
  connection: ConnectionConfig,
  context: AdapterContext,
): AgentAdapter {
  const factory = factories.get(connection.adapter)
  if (!factory) {
    throw new Error(`Adaptador desconocido: ${connection.adapter}`)
  }
  return factory(connection, context)
}
