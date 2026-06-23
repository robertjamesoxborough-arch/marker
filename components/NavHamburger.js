'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

export default function NavHamburger() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Lock scroll when menu open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const close = () => setOpen(false)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Burger button — only visible on mobile via CSS */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          alignItems: 'center', gap: 5, width: 36, height: 36, padding: 0,
          background: 'none', border: '1px solid var(--marker-border)',
          borderRadius: 8, cursor: 'pointer', flexShrink: 0,
        }}
      >
        <span style={{
          display: 'block', width: 16, height: 1.5,
          background: 'var(--marker-black)',
          transition: 'transform 0.2s, opacity 0.2s',
          transform: open ? 'translateY(6.5px) rotate(45deg)' : 'none',
        }} />
        <span style={{
          display: 'block', width: 16, height: 1.5,
          background: 'var(--marker-black)',
          opacity: open ? 0 : 1,
          transition: 'opacity 0.2s',
        }} />
        <span style={{
          display: 'block', width: 16, height: 1.5,
          background: 'var(--marker-black)',
          transition: 'transform 0.2s, opacity 0.2s',
          transform: open ? 'translateY(-6.5px) rotate(-45deg)' : 'none',
        }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 200, display: 'flex', flexDirection: 'column',
          pointerEvents: 'none',
        }}>
          {/* Backdrop */}
          <div
            onClick={close}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(10,10,10,0.25)',
              backdropFilter: 'blur(2px)',
              pointerEvents: 'all',
            }}
          />
          {/* Menu panel — drops from top */}
          <nav style={{
            position: 'relative', zIndex: 1,
            background: 'var(--marker-cream)',
            borderBottom: '1px solid var(--marker-border)',
            padding: '80px 24px 28px',
            display: 'flex', flexDirection: 'column', gap: 0,
            pointerEvents: 'all',
          }}>
            {[
              { label: 'How it works', href: '#how', external: false },
              { label: 'Tracks',       href: '#how', external: false },
              { label: 'Pricing',      href: '#pricing', external: false },
              { label: 'Notes',        href: '/notes', external: true },
              { label: 'Sign in',      href: '/auth', external: true },
            ].map(({ label, href, external }) => {
              const style = {
                fontFamily: 'var(--font-body)', fontSize: 18, fontWeight: 500,
                color: 'var(--marker-black)', padding: '14px 0',
                borderBottom: '1px solid var(--marker-border)',
                display: 'block', textDecoration: 'none',
              }
              return external
                ? <Link key={label} href={href} style={style} onClick={close}>{label}</Link>
                : <a key={label} href={href} style={style} onClick={close}>{label}</a>
            })}
            <div style={{ marginTop: 20 }}>
              <Link
                href="/auth"
                onClick={close}
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: 'var(--marker-lime)', color: 'var(--marker-black)',
                  fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600,
                  padding: '12px 22px', borderRadius: 8, textDecoration: 'none',
                }}
              >
                Start free — 7 days →
              </Link>
            </div>
          </nav>
        </div>
      )}
    </div>
  )
}
