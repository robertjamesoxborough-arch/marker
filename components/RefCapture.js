'use client'
import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { track } from '@vercel/analytics'

export default function RefCapture() {
  const params = useSearchParams()
  useEffect(() => {
    const ref = params.get('ref')
    if (ref && ref.trim()) {
      try {
        localStorage.setItem('marker_ref', ref.trim())
        track('referral_link_used', { ref: ref.trim().slice(0, 8) })
      } catch {}
    }
  }, [params])
  return null
}
