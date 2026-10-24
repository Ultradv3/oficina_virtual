type Client = {
  write: (chunk: string) => void
  close: () => void
}

type HubGlobal = typeof globalThis & {
  __agentOfficeHub?: {
    clients: Set<Client>
  }
}

function getHub() {
  const g = globalThis as HubGlobal
  if (!g.__agentOfficeHub) {
    g.__agentOfficeHub = { clients: new Set() }
  }
  return g.__agentOfficeHub
}

export function subscribe(client: Client): () => void {
  const hub = getHub()
  hub.clients.add(client)
  return () => {
    hub.clients.delete(client)
  }
}

export function broadcast(payload: Record<string, unknown>): void {
  const data = `data: ${JSON.stringify(payload)}\n\n`
  for (const client of getHub().clients) {
    try {
      client.write(data)
    } catch {
      getHub().clients.delete(client)
    }
  }
}
