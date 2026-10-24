export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event).catch(() => null)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Cuerpo inválido' })
  }
  const agentId = typeof body.agentId === 'string' ? body.agentId : ''
  const title = typeof body.title === 'string' ? body.title : ''
  const prompt = typeof body.prompt === 'string' ? body.prompt : ''

  if (!agentId) throw createError({ statusCode: 400, statusMessage: 'agentId es obligatorio' })
  if (!rateLimit(`task:${clientKey(event)}`, 10, 60_000)) {
    throw createError({ statusCode: 429, statusMessage: 'Demasiadas tareas en un minuto' })
  }

  const result = await createTask(agentId, { agentId, title, prompt }, getActor(event))
  if (!result.ok) {
    if (result.status === 404 || result.status === 409 || result.status === 400) {
      throw createError({ statusCode: result.status, statusMessage: result.error })
    }
    setResponseStatus(event, result.status)
    return { error: result.error, task: result.task }
  }
  setResponseStatus(event, 201)
  return { task: result.task }
})
