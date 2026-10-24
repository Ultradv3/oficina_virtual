import type { H3Event } from 'h3'

export function getActor(event: H3Event): string {
  const header = getHeader(event, 'x-operator')
  if (header) {
    const clean = header.replace(/[^\w .@-]/g, '').trim().slice(0, 60)
    if (clean) return clean
  }
  return 'operator'
}

export function clientKey(event: H3Event): string {
  const forwarded = getHeader(event, 'x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || event.node.req.socket.remoteAddress || 'local'
}
