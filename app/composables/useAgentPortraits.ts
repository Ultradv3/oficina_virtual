import { shallowRef } from 'vue'

export interface AgentPortrait {
  url: string
  alt: string
  identityKey: string
}

/**
 * Caché reactiva de retratos por agente. El render de retratos vive en la
 * escena (RenderTarget) y escribe aquí; los paneles solo leen.
 */
const portraits = shallowRef<Record<string, AgentPortrait>>({})

export function setAgentPortrait(agentId: string, portrait: AgentPortrait): void {
  portraits.value = { ...portraits.value, [agentId]: portrait }
}

export function clearAgentPortraits(): void {
  portraits.value = {}
}

export function useAgentPortraits() {
  return { portraits, setAgentPortrait, clearAgentPortraits }
}
