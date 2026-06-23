'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { track } from '@vercel/analytics'

function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(urlError || '')

  const usePassword = password.length > 0

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    if (usePassword) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        router.replace('/app')
      }
      return
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      track('magic_link_sent')
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--color-cream)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Wordmark */}
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '28px',
          fontWeight: 700,
          color: 'var(--color-black)',
          letterSpacing: '-0.5px',
          marginBottom: '48px',
        }}>
          marker
          <span style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            backgroundColor: 'var(--color-lime)',
            borderRadius: '50%',
            marginLeft: '2px',
            verticalAlign: 'super',
          }} />
        </div>

        {sent ? (
          <div>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--color-black)',
              margin: '0 0 12px 0',
            }}>
              Check your inbox
            </h1>
            <p style={{
              color: 'var(--color-text-mid)',
              fontSize: '15px',
              lineHeight: '1.6',
              margin: 0,
            }}>
              We sent a sign-in link to <strong style={{ color: 'var(--color-text-body)' }}>{email}</strong>.
              Click it to continue. The link expires in 60 minutes.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--color-black)',
              margin: '0 0 8px 0',
            }}>
              Sign in
            </h1>
            <p style={{
              color: 'var(--color-text-mid)',
              fontSize: '15px',
              margin: '0 0 32px 0',
            }}>
              Enter your email and we will send you a sign-in link.
            </p>

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-body)', marginBottom: '8px' }}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                display: 'block', width: '100%', padding: '10px 14px', fontSize: '15px',
                border: '1px solid var(--color-border)', borderRadius: '8px',
                backgroundColor: '#fff', color: 'var(--color-text-body)',
                outline: 'none', marginBottom: '12px', boxSizing: 'border-box',
              }}
            />

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-body)', marginBottom: '8px' }}>
              Password <span style={{ fontWeight: 400, color: 'var(--color-text-mid)' }}>(leave blank to get a magic link instead)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                display: 'block', width: '100%', padding: '10px 14px', fontSize: '15px',
                border: '1px solid var(--color-border)', borderRadius: '8px',
                backgroundColor: '#fff', color: 'var(--color-text-body)',
                outline: 'none', marginBottom: '16px', boxSizing: 'border-box',
              }}
            />

            {error && (
              <p style={{ fontSize: '13px', color: '#c0392b', marginBottom: '16px' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              style={{
                display: 'block', width: '100%', padding: '11px 20px', fontSize: '15px', fontWeight: 600,
                backgroundColor: loading || !email ? 'var(--color-border)' : 'var(--color-lime)',
                color: 'var(--color-black)', border: 'none', borderRadius: '8px',
                cursor: loading || !email ? 'not-allowed' : 'pointer', transition: 'background-color 0.15s',
              }}
            >
              {loading ? '...' : usePassword ? 'Sign in' : 'Send sign-in link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  )
}
