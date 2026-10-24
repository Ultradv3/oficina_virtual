const SENSITIVE_KEY = /pass(word)?|token|secret|api[-_]?key|authorization|cookie/i

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]'
  if (Array.isArray(value)) return value.slice(0, 40).map((item) => redact(item, depth + 1))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(item, depth + 1)
    }
    return out
  }
  if (typeof value === 'string' && value.length > 2000) return `${value.slice(0, 2000)}…`
  return value
}

export function clip(text: string, max = 4000): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}
