export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Tarea inválida' })
  const detail = await getTaskDetail(id)
  if (!detail) throw createError({ statusCode: 404, statusMessage: 'Tarea no encontrada' })
  return detail
})
