type Bucket = { count: number; resetAt: number }

type LimitGlobal = typeof globalThis & { __agentOfficeLimits?: Map<string, Bucket> }

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const g = globalThis as LimitGlobal
  if (!g.__agentOfficeLimits) g.__agentOfficeLimits = new Map()
  const buckets = g.__agentOfficeLimits
  const current = buckets.get(key)
  const timestamp = Date.now()
  if (!current || current.resetAt <= timestamp) {
    buckets.set(key, { count: 1, resetAt: timestamp + windowMs })
    return true
  }
  if (current.count >= limit) return false
  current.count += 1
  return true
}
