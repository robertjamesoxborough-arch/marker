'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { track } from '@vercel/analytics'
import { BRAND_NAME } from '../../lib/brand'
import LiveNetworkMeter from '../../components/LiveNetworkMeter'

const SIZES = ['1–10', '11–50', '51–200', '201–500', '501–2000', '2000+']

const HOW_STEPS = [
  {
    n: '01',
    title: 'Register your interest.',
    body: 'Tell us who you\'re hoping to hire. Two minutes, no commitment.',
  },
  {
    n: '02',
    title: 'We build the candidate pool honestly.',
    body: 'We\'re early: the candidate marketplace isn\'t live yet. Registering now means we can tell you, honestly, when there\'s a genuine match in your sector.',
  },
  {
    n: '03',
    title: 'Nothing to pay, nothing live yet.',
    body: 'No subscription, no fee for registering. If this becomes a real, working introduction service, you\'ll know the terms upfront before anything is charged.',
  },
]

export default function HirePage() {
  const router = useRouter()
  const [user, setUser] = useState(undefined) // undefined = loading
  const [step, setStep] = useState(1)         // 1 = company, 2 = role
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [createdRoleId, setCreatedRoleId] = useState(null)

  // Company fields
  const [companyName, setCompanyName] = useState('')
  const [companySize, setCompanySize] = useState('')
  const [sector, setSector] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')

  // Role fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user || null))
  }, [])

  async function submit() {
    if (!user) {
      const returnUrl = encodeURIComponent('/hire')
      router.push(`/auth?next=${returnUrl}`)
      return
    }
    setSaving(true)
    setError('')
    try {
      // Step 1: create/update employer profile
      const pRes = await fetch('/api/employer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: companyName, company_size: companySize, sector, website_url: websiteUrl }),
      })
      const pData = await pRes.json()
      if (!pRes.ok) throw new Error(pData.error || 'Failed to save company details')

      // Step 2: create role
      const rRes = await fetch('/api/employer/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, location, salary_min: salaryMin, salary_max: salaryMax }),
      })
      const rData = await rRes.json()
      if (!rRes.ok) throw new Error(rData.error || 'Failed to create role')

      setCreatedRoleId(rData.role?.id)
      track('employer_role_posted', { sector: sector || 'unknown' })
      setDone(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const canProceedStep1 = companyName.trim().length > 1
  const canSubmit = title.trim().length > 2

  if (done) {
    return (
      <div style={PAGE_STYLE}>
        <Nav />
        <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
          <div className="holo-dot" style={{ width: 48, height: 48, borderRadius: '50%', margin: '0 auto 24px' }} />
          <h1 style={H1} className="display-lg">Thanks. You&apos;re registered.</h1>
          <p style={{ fontSize: 16, color: 'var(--marker-mid)', marginBottom: 32, lineHeight: 1.6 }}>
            {BRAND_NAME}&apos;s candidate marketplace isn&apos;t live yet, so there&apos;s no shortlist to show you today. We&apos;ll email you the moment we have genuine, matched candidates for this role, not before.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => { setDone(false); setTitle(''); setDescription(''); setLocation(''); setSalaryMin(''); setSalaryMax('') }}
              className="btn btn-lime" style={{ fontWeight: 600, fontSize: 15 }}>Register another role</button>
          </div>
          <div style={{ marginTop: 48, padding: '24px 0', borderTop: '1px solid var(--marker-border)' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em', marginBottom: 12 }}>
              KNOW ANOTHER HIRING TEAM?
            </p>
            <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.6, marginBottom: 16 }}>
              We&apos;re early, and every genuine team who registers helps us build real demand signal faster. No referral reward exists yet; if that changes, we&apos;ll tell you plainly.
            </p>
            <a href="mailto:support@upstreaminsights.co.uk?subject=Refer%20a%20team" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>
              Tell a team about us →
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={PAGE_STYLE}>
      <Nav />

      {/* Hero */}
      <section style={{ padding: '72px 64px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <div className="kicker holo-text" style={{ marginBottom: 16 }}>Early access for teams who want to hire well, without an agency retainer.</div>
        <h1 className="display-xl" style={{ fontSize: 'clamp(40px, 6vw, 80px)', marginBottom: 20, maxWidth: 760 }}>
          <span className="chrome-text">We&apos;re building this. Register your interest.</span>
        </h1>
        <p style={{ fontSize: 18, color: 'var(--marker-mid)', maxWidth: 600, lineHeight: 1.65, marginBottom: 28 }}>
          {BRAND_NAME}&apos;s candidate marketplace, matched shortlists, anonymised intros, isn&apos;t live yet: we have no employers and no completed hires to point to. What we do have is a growing pool of real candidates on the platform. Registering interest now costs nothing and helps us tell you honestly when there&apos;s a genuine match for your role.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          {['Early access, not a live marketplace yet', 'No fee to register', 'We only reach out with a genuine match'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 8, padding: '7px 12px' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--marker-lime)', flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500 }}>{f}</span>
            </div>
          ))}
        </div>
        <LiveNetworkMeter />
      </section>

      <div className="holo-hairline" />

      {/* How it works */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 64px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {HOW_STEPS.map(s => (
            <div key={s.n} style={{ padding: '28px 24px', background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 12 }}>
              <div className="kicker holo-text" style={{ marginBottom: 12 }}>{s.n}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 10 }}>{s.title}</div>
              <div style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.6 }}>{s.body}</div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 24, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.04em', lineHeight: 1.6 }}>
          If we don&apos;t have the right people in your field yet, we&apos;ll tell you plainly and let you know when we do. We&apos;d rather be honest than waste your time.
        </p>
      </section>

      <div className="holo-hairline" />

      {/* Credibility band */}
      <section style={{ padding: '32px 64px', background: 'var(--marker-cream-2)', display: 'flex', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--marker-mid)', textAlign: 'center', maxWidth: 640, lineHeight: 1.65, margin: 0 }}>
          <strong style={{ color: 'var(--marker-text)' }}>Built for lean teams, honestly early.</strong>{' '}
          No long contract, no platform fee, no pressure. We&apos;d rather register your interest now and earn a real shortlist later than oversell one today.
        </p>
      </section>

      <div className="holo-hairline" />

      {/* Form */}
      <section style={{ maxWidth: 640, margin: '0 auto', padding: '56px 24px 80px' }}>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 40, alignItems: 'center' }}>
          {[{ n: 1, label: 'Your company' }, { n: 2, label: 'The role' }].map(s => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: step >= s.n ? 'var(--marker-black)' : 'var(--marker-border)',
                color: step >= s.n ? 'var(--marker-cream)' : 'var(--marker-mid)',
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
              }}>{s.n}</div>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: step === s.n ? 'var(--marker-text)' : 'var(--marker-mid)', fontWeight: step === s.n ? 500 : 400 }}>{s.label}</span>
              {s.n < 2 && <div style={{ width: 32, height: 1, background: 'var(--marker-border)', margin: '0 4px' }} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="display-md" style={{ fontSize: 26, marginBottom: 8 }}>About your company</div>

            <Field label="Company name *">
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Acme Ltd" style={INPUT} />
            </Field>

            <Field label="Company size">
              <select value={companySize} onChange={e => setCompanySize(e.target.value)} style={INPUT}>
                <option value="">Select size</option>
                {SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
              </select>
            </Field>

            <Field label="Sector / industry">
              <input value={sector} onChange={e => setSector(e.target.value)} placeholder="e.g. Fintech, SaaS, Media" style={INPUT} />
            </Field>

            <Field label="Website (optional)">
              <input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://yourcompany.com" style={INPUT} type="url" />
            </Field>

            <button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="btn btn-primary"
              style={{ marginTop: 8, padding: '13px 24px', fontSize: 15, opacity: canProceedStep1 ? 1 : 0.4 }}>
              Next: describe the role →
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'var(--marker-mid)', fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer', letterSpacing: '0.04em' }}>← Back</button>
              <div className="display-md" style={{ fontSize: 26 }}>The role</div>
            </div>

            <Field label="Job title *">
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Head of Product" style={INPUT} />
            </Field>

            <Field label="Role brief">
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Describe the role, what you're looking for, the team context. Paste a JD if you have one; we'll use it for matching."
                rows={6} style={{ ...INPUT, resize: 'vertical', lineHeight: 1.6 }} />
            </Field>

            <Field label="Location">
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. London (hybrid, 2 days)" style={INPUT} />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Salary min (£k)">
                <input value={salaryMin} onChange={e => setSalaryMin(e.target.value)} placeholder="e.g. 70" type="number" style={INPUT} />
              </Field>
              <Field label="Salary max (£k)">
                <input value={salaryMax} onChange={e => setSalaryMax(e.target.value)} placeholder="e.g. 90" type="number" style={INPUT} />
              </Field>
            </div>

            {error && <div style={{ background: '#fff0f0', border: '1px solid #fca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c00' }}>{error}</div>}

            {user === null && (
              <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--marker-text-soft)' }}>
                You&apos;ll be asked to sign in before your role is posted.
              </div>
            )}

            <button
              onClick={submit}
              disabled={saving || !canSubmit}
              className="btn btn-lime btn-iris-sheen"
              style={{ marginTop: 8, padding: '14px 24px', fontSize: 15, fontWeight: 600, opacity: canSubmit ? 1 : 0.4 }}>
              {saving ? 'Registering…' : 'Register interest →'}
            </button>

            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em', lineHeight: 1.6 }}>
              By registering, you agree to our terms. This is an expression of interest, not a live shortlist: {BRAND_NAME}&apos;s employer marketplace has not launched yet, so no fee applies today and no candidate introductions happen automatically.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

function Nav() {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 64px', borderBottom: '1px solid var(--marker-border)', background: 'var(--marker-cream)' }}>
      <Link href="/" style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--marker-black)', textDecoration: 'none' }}>
        {BRAND_NAME.toLowerCase()}<span className="holo-dot" style={{ display: 'inline-block', width: '0.3em', height: '0.3em', borderRadius: '50%', marginLeft: '0.05em', verticalAlign: 'super' }} />
      </Link>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <Link href="/trust" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>Why trust us</Link>
        <Link href="/employer" style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--marker-mid)' }}>Dashboard</Link>
        <Link href="/auth" className="btn btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>Sign in</Link>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>
      {children}
    </div>
  )
}

const PAGE_STYLE = { width: '100%', minHeight: '100vh', background: 'var(--marker-cream)', fontFamily: 'var(--font-body)', color: 'var(--marker-text)' }
const H1 = { fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--marker-black)', marginBottom: 12 }
const INPUT = { width: '100%', padding: '11px 14px', borderRadius: 8, border: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box' }
