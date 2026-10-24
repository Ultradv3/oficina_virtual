export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Aprobación inválida' })

  const body = await readBody<Record<string, unknown>>(event).catch(() => null)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Cuerpo inválido' })
  }
  const decision = body.decision === 'reject' ? 'reject' : body.decision === 'approve' ? 'approve' : null
  if (!decision) throw createError({ statusCode: 400, statusMessage: 'decision debe ser approve o reject' })
  if (!rateLimit(`approval:${clientKey(event)}`, 30, 60_000)) {
    throw createError({ statusCode: 429, statusMessage: 'Demasiadas respuestas de aprobación' })
  }

  const result = await respondToApproval(id, decision, body.remember === true, getActor(event))
  if (!result.ok) {
    return {
      confirmed: false,
      error: result.error,
      status: 'status' in result ? result.status : undefined,
    }
  }
  return { confirmed: true, error: null }
})
