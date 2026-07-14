/**
 * lib/safe-fetch.js — SSRF-safe fetch for arbitrary, user-supplied URLs
 * (company career pages from wishlists). Unlike resolve-url's Stage 13
 * hardening (a fixed adzuna.co.uk/adzuna.com allowlist — not applicable
 * here, since career pages are on the company's own arbitrary domain), this
 * validates protocol + resolves DNS + rejects private/reserved IP ranges,
 * including the cloud metadata endpoint (169.254.169.254) that a malicious
 * wishlist entry could otherwise target from inside a cron with no user in
 * the loop and elevated (service-role) credentials in its execution context.
 *
 * Known residual risk (documented, not silently ignored): this resolves DNS
 * once to check the IP, then calls the platform fetch() which re-resolves
 * DNS itself — a sophisticated DNS-rebinding attacker could theoretically
 * serve a safe IP on the first lookup and a private IP on the second. A
 * fully closed fix means fetching by the resolved IP directly (manual Host
 * header + TLS SNI), which is meaningfully more complex; out of scope for
 * this pass. This still blocks the overwhelmingly common case (a wishlist
 * entry pointing straight at a private/internal address) and is a real,
 * substantial improvement over the previous state, which was no validation
 * at all.
 */
import dns from 'node:dns/promises'
import net from 'node:net'

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return true // malformed — fail closed
  const [a, b] = parts
  if (a === 10) return true                          // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true     // 172.16.0.0/12
  if (a === 192 && b === 168) return true              // 192.168.0.0/16
  if (a === 127) return true                           // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true              // 169.254.0.0/16 link-local (cloud metadata: 169.254.169.254)
  if (a === 0) return true                             // 0.0.0.0/8
  if (a >= 224) return true                            // multicast/reserved
  return false
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase()
  if (lower === '::1') return true                     // loopback
  if (lower.startsWith('fe80:')) return true            // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true // unique local (fc00::/7)
  if (lower.startsWith('::ffff:')) {                    // IPv4-mapped
    const v4 = lower.split(':').pop()
    if (net.isIPv4(v4)) return isPrivateIPv4(v4)
  }
  return false
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip)
  if (net.isIPv6(ip)) return isPrivateIPv6(ip)
  return true // unrecognised format — fail closed
}

/**
 * @param {string} url
 * @param {object} [options] — passed through to fetch()
 * @returns {Promise<Response>}
 * @throws if the URL is blocked (non-http(s), localhost, or resolves to a
 *   private/reserved IP) or DNS resolution fails
 */
export async function safeFetch(url, options = {}) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Blocked: non-http(s) protocol')
  }
  if (parsed.hostname === 'localhost') {
    throw new Error('Blocked: localhost')
  }
  let addresses
  try {
    addresses = await dns.lookup(parsed.hostname, { all: true })
  } catch {
    throw new Error('Blocked: DNS resolution failed')
  }
  if (addresses.length === 0 || addresses.some(a => isPrivateIp(a.address))) {
    throw new Error('Blocked: resolves to a private/internal address')
  }
  return fetch(url, options)
}
