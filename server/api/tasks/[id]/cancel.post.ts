export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Tarea inválida' })
  if (!rateLimit(`cancel:${clientKey(event)}`, 20, 60_000)) {
    throw createError({ statusCode: 429, statusMessage: 'Demasiadas solicitudes de cancelación' })
  }
  const result = await cancelTask(id, getActor(event))
  if (!result.ok) {
    return {
      confirmed: false,
      error: result.error,
      status: 'status' in result ? result.status : undefined,
    }
  }
  return { confirmed: result.confirmed, error: null }
})
