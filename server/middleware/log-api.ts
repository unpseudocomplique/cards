function shouldLogApiRequest(path: string): boolean {
  return path.startsWith('/api/')
}

export default defineEventHandler((event) => {
  const path = event.path
  if (!shouldLogApiRequest(path)) {
    return
  }

  const startedAt = performance.now()
  const method = event.method

  event.node.res.on('finish', () => {
    const durationMs = Math.round(performance.now() - startedAt)
    const status = event.node.res.statusCode
    console.log(`[api] ${method} ${path} ${status} ${durationMs}ms`)
  })
})
