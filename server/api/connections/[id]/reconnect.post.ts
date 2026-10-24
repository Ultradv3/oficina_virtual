export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Conexión inválida' })
  if (!rateLimit(`reconnect:${clientKey(event)}`, 10, 60_000)) {
    throw createError({ statusCode: 429, statusMessage: 'Demasiados intentos de reconexión' })
  }
  const result = await reconnectConnection(id, getActor(event))
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Conexión no encontrada' })
  setResponseStatus(event, result.ok ? 200 : 502)
  return result
})
