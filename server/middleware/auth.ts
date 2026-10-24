import { timingSafeEqual } from 'node:crypto'

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export default defineEventHandler((event) => {
  const token = process.env.AGENT_OFFICE_TOKEN
  if (!token) return

  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api')) return
  if (path === '/api/health') return

  const header = getHeader(event, 'authorization') ?? ''
  const query = getQuery(event).token
  const provided = header.startsWith('Bearer ')
    ? header.slice(7)
    : typeof query === 'string'
      ? query
      : ''

  if (!provided || !safeEqual(provided, token)) {
    throw createError({ statusCode: 401, statusMessage: 'No autorizado' })
  }
})
