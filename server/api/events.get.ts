export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  })
  setResponseStatus(event, 200)

  const res = event.node.res
  res.write(`event: ready\ndata: ${JSON.stringify({ serverTime: Date.now() })}\n\n`)

  const unsubscribe = subscribe({
    write: (chunk) => res.write(chunk),
    close: () => res.end(),
  })

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n')
    } catch {
      // The close handler will unsubscribe.
    }
  }, 15_000)

  return new Promise<void>((resolve) => {
    const done = () => {
      clearInterval(heartbeat)
      unsubscribe()
      resolve()
    }
    event.node.req.on('close', done)
    event.node.req.on('error', done)
    res.on('close', done)
  })
})
