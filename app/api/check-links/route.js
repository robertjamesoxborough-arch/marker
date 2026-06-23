export async function POST(req) {
  const { links } = await req.json()
  if (!links || !links.length) return Response.json({ results: [] })

  const results = await Promise.allSettled(
    links.map(async ({ id, url }) => {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        const res = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0' },
          redirect: 'follow',
        })
        clearTimeout(timeout)
        return { id, url, status: res.ok ? 'alive' : 'dead', code: res.status }
      } catch {
        return { id, url, status: 'error' }
      }
    })
  )

  return Response.json({ results: results.map(r => r.status === 'fulfilled' ? r.value : { id: 'unknown', status: 'error' }) })
}
