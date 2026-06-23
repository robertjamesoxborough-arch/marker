'use client'
import Link from 'next/link'
import { track } from '@vercel/analytics'

// Thin wrapper around Link that fires a named analytics event on click
export default function TrackCTA({ href, event, props = {}, children, className, style }) {
  return (
    <Link href={href} className={className} style={style} onClick={() => track(event, props)}>
      {children}
    </Link>
  )
}
