// Follows Adzuna redirect URLs to find the real employer careers page
// No Claude usage — pure HTTP redirect following

const ALLOWED_ORIGINS = ['adzuna.co.uk', 'adzuna.com']

export async function POST(req) {
  const { url } = await req.json()
  if (!url) return Response.json({ resolved: null })

  try {
    const parsed = new URL(url)
    if (!ALLOWED_ORIGINS.some(o => parsed.hostname.endsWith(o))) {
      return Response.json({ resolved: null })
    }
  } catch {
    return Response.json({ resolved: null })
  }

  try {
    // Follow redirects manually to capture the final URL
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })
    clearTimeout(timeout)

    const finalUrl = res.url

    // If the final URL is still Adzuna, the redirect didn't resolve
    if (!finalUrl || finalUrl.includes('adzuna.co.uk') || finalUrl.includes('adzuna.com')) {
      return Response.json({ resolved: null })
    }

    return Response.json({ resolved: finalUrl })
  } catch {
    return Response.json({ resolved: null })
  }
}
