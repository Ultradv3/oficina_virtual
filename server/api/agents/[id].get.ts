export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Agente inválido' })
  const detail = getAgentDetail(id)
  if (!detail) throw createError({ statusCode: 404, statusMessage: 'Agente no encontrado' })
  return detail
})
