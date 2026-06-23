'use client'
import { useEffect } from 'react'

export default function TaglineTracker({ taglineId }) {
  useEffect(() => {
    if (!taglineId) return
    try { localStorage.setItem('marker_tagline_id', String(taglineId)) } catch {}
    fetch('/api/tagline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taglineId, field: 'impression' }),
    }).catch(() => {})
  }, [taglineId])
  return null
}
