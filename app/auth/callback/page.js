'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    async function handle() {
      const supabase = createClient()
      const code       = searchParams.get('code')
      const token_hash = searchParams.get('token_hash')
      const type       = searchParams.get('type')
      const next       = searchParams.get('next') ?? '/app'

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) { router.replace(next); return }
      }

      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type })
        if (!error) { router.replace(next); return }
      }

      // Implicit flow: access_token arrives as a URL hash fragment (#access_token=...).
      // Browsers strip the hash before the HTTP request, so server handlers never see it.
      // getSession() on the browser client reads window.location.hash automatically.
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { router.replace(next); return }

      router.replace('/auth?error=Sign-in+link+failed.+Please+request+a+new+one.')
    }

    handle()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--marker-cream)',
    }}>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--marker-mid)' }}>
        Signing you in…
      </p>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  )
}
