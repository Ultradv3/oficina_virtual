export default defineEventHandler((event) => {
  const query = getQuery(event)
  const limit = Number(query.limit ?? 100)
  return { entries: listAudit(Number.isFinite(limit) ? limit : 100) }
})
