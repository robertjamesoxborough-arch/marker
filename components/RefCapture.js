'use client'
import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export default function RefCapture() {
  const params = useSearchParams()
  useEffect(() => {
    const ref = params.get('ref')
    if (ref && ref.trim()) {
      try { localStorage.setItem('marker_ref', ref.trim()) } catch {}
    }
  }, [params])
  return null
}
