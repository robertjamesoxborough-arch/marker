'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../lib/supabase/client'

// ── Helpers ───────────────────────────────────────────────────────

const CATEGORIES = ['marketing', 'legal', 'product', 'press', 'b2b_sales']
const CAT_LABELS = { marketing: 'Marketing', legal: 'Legal', product: 'Product', press: 'Press', b2b_sales: 'B2B Sales' }
const STATUS_CYCLE = { todo: 'in_progress', in_progress: 'done', done: 'todo' }
const STATUS_LABELS = { todo: 'To do', in_progress: 'In progress', done: 'Done' }
const STATUS_COLORS = {
  todo:        { bg: 'var(--marker-cream-2)', border: 'var(--marker-border)', text: 'var(--marker-mid)' },
  in_progress: { bg: '#FFF8DC',              border: '#E8C840',              text: '#7A6000' },
  done:        { bg: '#E8F5E0',              border: '#8AC857',              text: '#2D6A00' },
}

function Logo() {
  return (
    <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--marker-black)', display: 'inline-flex', alignItems: 'baseline', lineHeight: 1 }}>
      marker
      <span className="holo-dot" style={{ display: 'inline-block', width: '0.32em', height: '0.32em', borderRadius: '50%', marginLeft: '0.05em', position: 'relative', top: '-0.55em', flexShrink: 0 }} />
    </span>
  )
}

// ── Todo card ─────────────────────────────────────────────────────

function TodoCard({ todo, onStatusChange, onDelete }) {
  const sc = STATUS_COLORS[todo.status]
  return (
    <div style={{ background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', lineHeight: 1.4 }}>{todo.title}</div>
      {todo.description && (
        <div style={{ fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1.5 }}>{todo.description}</div>
      )}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
        <button
          onClick={() => onStatusChange(todo.id, STATUS_CYCLE[todo.status])}
          style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text, fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}
        >
          {STATUS_LABELS[todo.status]}
        </button>
        <button
          onClick={() => onDelete(todo.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--marker-mid)', fontSize: 14, padding: '0 4px', lineHeight: 1, marginLeft: 'auto' }}
          title="Delete"
        >×</button>
      </div>
    </div>
  )
}

// ── Add todo form ─────────────────────────────────────────────────

function AddTodo({ category, onAdd }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')

  async function submit() {
    if (!title.trim()) return
    await onAdd(category, title.trim(), desc.trim())
    setTitle(''); setDesc(''); setOpen(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ width: '100%', padding: '8px', background: 'none', border: '1px dashed var(--marker-border)', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: 'var(--marker-mid)', fontFamily: 'var(--font-body)' }}>
        + Add
      </button>
    )
  }

  return (
    <div style={{ background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
        autoFocus onKeyDown={e => e.key === 'Enter' && submit()}
        style={{ fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 6, padding: '7px 10px', outline: 'none', fontFamily: 'var(--font-body)', color: 'var(--marker-text)', background: '#fff' }}
      />
      <input
        value={desc} onChange={e => setDesc(e.target.value)} placeholder="Notes (optional)"
        style={{ fontSize: 12, border: '1px solid var(--marker-border)', borderRadius: 6, padding: '7px 10px', outline: 'none', fontFamily: 'var(--font-body)', color: 'var(--marker-text)', background: '#fff' }}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={submit} className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px' }}>Add</button>
        <button onClick={() => setOpen(false)} className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>Cancel</button>
      </div>
    </div>
  )
}

// ── Taglines panel ────────────────────────────────────────────────

function TaglinesPanel({ taglines, onActivate }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
      {taglines.map(t => (
        <div
          key={t.id}
          onClick={() => !t.active && onActivate(t.id)}
          style={{
            background: t.active ? 'var(--marker-lime)' : 'var(--marker-cream-2)',
            border: `1px solid ${t.active ? 'var(--marker-lime)' : 'var(--marker-border)'}`,
            borderRadius: 10, padding: 16, cursor: t.active ? 'default' : 'pointer',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}
        >
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--marker-black)' }}>
            "{t.tagline_text}"
          </div>
          <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 10, color: t.active ? '#3D3D00' : 'var(--marker-mid)' }}>
            <span>{t.impressions} impressions</span>
            <span>{t.conversions} conversions</span>
            {t.impressions > 0 && <span>{((t.conversions / t.impressions) * 100).toFixed(1)}% CVR</span>}
          </div>
          {t.active && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', color: 'var(--marker-black)' }}>ACTIVE</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────

function timeAgo(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  return `${days}d ago`
}

function cronHealth(lastRun) {
  if (!lastRun) return 'never'
  const hours = (Date.now() - new Date(lastRun).getTime()) / 3600000
  if (hours < 26)  return 'ok'
  if (hours < 50)  return 'warn'
  return 'stale'
}

// ── Roadmap data ─────────────────────────────────────────────────

const ROADMAP = [
  {
    phase: 'Week 1: Foundation',
    targetDate: '2026-05-07',
    items: [
      { label: 'Scaffold + Vercel link',              done: true  },
      { label: 'Brand spec (lime/black/cream, fonts)', done: true  },
      { label: 'Supabase project + env vars',          done: true  },
      { label: 'Auth (magic link)',                    done: true  },
      { label: 'Postgres schema + accounts hierarchy', done: true  },
      { label: 'Migrate IndexedDB → Supabase',         done: true  },
      { label: 'Strip hardcoded data → profiles',      done: true  },
      { label: 'Region context',                       done: true  },
      { label: 'First user can sign up and use app',   done: true  },
    ],
    blockers: [],
  },
  {
    phase: 'Week 2: Onboarding + Tracks + Admin',
    targetDate: '2026-05-21',
    items: [
      { label: '8-step onboarding with CV upload',     done: true  },
      { label: '5 job-seeker tracks',                  done: true  },
      { label: 'Track-based feature gating',           done: true  },
      { label: 'Track-based wishlist seeds',           done: true  },
      { label: 'Track-based CV/cover letter tones',    done: true  },
      { label: 'Track-based Adzuna query templates',   done: true  },
      { label: 'Track-based scoring modifiers',        done: true  },
      { label: 'Admin CMS at /admin',                  done: true  },
      { label: 'Tagline A/B test infrastructure',      done: true  },
      { label: 'Affiliate ?ref= attribution',          done: true  },
      { label: 'Account roles (owner/admin/member)',   done: false },
      { label: 'White-label theming infrastructure',   done: false },
      { label: 'Headless mode flag',                   done: false },
    ],
    blockers: [],
  },
  {
    phase: 'Week 3: API economy + cost protection',
    targetDate: '2026-05-28',
    items: [
      { label: 'Greenhouse nightly cron',              done: true  },
      { label: 'Adzuna nightly cron',                  done: true  },
      { label: 'Gov / civil service cron',             done: true  },
      { label: 'Haiku-first scoring cascade',          done: true  },
      { label: 'Prompt caching on Sonnet calls',       done: true  },
      { label: 'ai_usage tracking on all AI routes',   done: true  },
      { label: '7-day trial mode + banner',            done: true  },
      { label: '30-day inactivity archival cron',      done: true  },
      { label: 'Admin metrics + accounts panels',      done: true  },
      { label: 'Vercel Analytics + Speed Insights',    done: true  },
      { label: 'Full funnel event tracking',           done: true  },
      { label: 'Resend email: welcome + trial lifecycle', done: true },
      { label: 'tier_allowances table seeded',         done: true  },
      { label: 'Hard rate limits per tier',            done: false },
      { label: 'BYO-key flow with Supabase Vault',     done: false },
      { label: 'Weekly cron for Standby users',        done: false },
      { label: 'Admin daily spend alert (>£2)',        done: false },
    ],
    blockers: [],
  },
  {
    phase: 'Week 4: Billing + Polish + Legal',
    targetDate: '2026-06-07',
    items: [
      { label: 'Mobile responsive pass',               done: true  },
      { label: 'Legal pages (Privacy, ToS, Cookies)',  done: true  },
      { label: 'AI / parental leave disclaimers',      done: true  },
      { label: 'Data export + right to be forgotten',  done: true  },
      { label: 'Tagline A/B test wired end-to-end',    done: true  },
      { label: 'Adzuna + CRON_SECRET env vars set',    done: true  },
      { label: 'Resend SMTP configured in Supabase',   done: true  },
      { label: 'Cookie consent banner',                done: true  },
      { label: 'App footer (Privacy, Terms, Pricing)', done: true  },
      { label: 'Pricing page (/pricing)',              done: true  },
      { label: 'Subscription plan gate architecture',  done: true  },
      { label: 'Free tier gates: architecture only',  done: true  },
      { label: 'Stripe Standby £4/mo',                 done: false },
      { label: 'Stripe Lite £12/mo',                   done: false },
      { label: 'Stripe Pro £24/mo',                    done: false },
      { label: 'Wire pricing page CTAs to checkout',   done: false },
      { label: 'Hard rate limit enforcement (post-Stripe)', done: false },
    ],
    blockers: [
      { label: 'Stripe KYC: complete identity verification (2-5 days)', youDo: true },
      { label: 'Add Stripe keys to Vercel env vars', youDo: true },
      { label: 'Supabase Pro upgrade ($25/mo) before real users', youDo: true },
      { label: 'Vercel Pro upgrade ($20/mo): Hobby ToS excludes commercial use', youDo: true },
      { label: 'ICO registration (ico.org.uk, ~£40/year, required in UK)', youDo: true },
    ],
  },
  {
    phase: 'Phase 4: UX, Tracks + Lead Magnets',
    targetDate: '2026-06-02',
    items: [
      { label: 'Generalised onboarding (perm/contractor/both)', done: true },
      { label: 'Contractor Routes tab (Companies, Roles, Recruiters)', done: true },
      { label: 'WLB tab as first-class nav item',          done: true },
      { label: 'Brand tagline on Today tab',               done: true },
      { label: 'Feed UX: piped jobs hide instantly, Skip label', done: true },
      { label: 'Discover: Company Scan + Live Roles merged', done: true },
      { label: 'Settings: searchMode selector (Perm/Contractor/Both)', done: true },
      { label: 'Plan-aware tab gating (passive; ready to flip on)', done: true },
      { label: 'Focus mode (Score/Track/Find)',             done: true },
      { label: 'Day 1 first-run guide',                    done: true },
      { label: 'WLB guide page with print/PDF support',    done: true },
      { label: '30-Minute Role Assessment guide',          done: true },
      { label: 'Senior Job Hunt Playbook guide',           done: true },
      { label: 'LinkedIn Search Bible guide',              done: true },
      { label: "Parent's Guide to Finding a Better Job",   done: true },
      { label: 'Guides index page (/guides)',              done: true },
      { label: 'Guides added to admin panel',              done: true },
    ],
    blockers: [],
  },
  {
    phase: 'Week 5: Private beta',
    targetDate: '2026-06-14',
    items: [
      { label: 'Recruit 50 beta users from LinkedIn',  done: false },
      { label: '£7.50/month-for-life promo code',     done: false },
      { label: 'Closed feedback channel',              done: false },
      { label: 'Top 10 issues fixed',                  done: false },
    ],
    blockers: [
      { label: 'Stripe must be live (Week 4 first)', youDo: false },
    ],
  },
  {
    phase: 'Week 6: Public launch 🚀',
    targetDate: '2026-06-28',
    items: [
      { label: 'Product Hunt launch (Tue–Thu)',        done: false },
      { label: 'BetaList submission',                  done: false },
      { label: 'Hacker News Show HN',                  done: false },
      { label: 'Indie Hackers post',                   done: false },
      { label: 'LinkedIn launch post',                 done: false },
      { label: 'First 3 SEO cornerstone articles',    done: false },
      { label: 'Blog at requite.io/notes',              done: false },
    ],
    blockers: [],
  },
]

// ── Action items (auto-generated from build state) ────────────────

function ActionItems({ status }) {
  // Collect all youDo blockers from phases that aren't 100% done
  const actionItems = []
  ROADMAP.forEach(phase => {
    const pct = Math.round(phase.items.filter(i => i.done).length / phase.items.length * 100)
    if (pct === 100) return // phase done, skip its blockers
    phase.blockers.filter(b => b.youDo).forEach(b => {
      const envDone = b.envKey && status?.envCheck ? !!status.envCheck[b.envKey] : false
      actionItems.push({ label: b.label, phase: phase.phase.split(': ')[0], envKey: b.envKey, done: envDone })
    })
  })

  // Also flag any env issues not yet covered
  if (status?.envCheck) {
    if (!status.envCheck.adzunaConfigured && !actionItems.find(a => a.envKey === 'adzunaConfigured')) {
      actionItems.push({ label: 'Add ADZUNA_APP_ID + ADZUNA_API_KEY to Vercel', phase: 'Week 4', envKey: 'adzunaConfigured', done: false })
    }
    if (!status.envCheck.cronSecretSet && !actionItems.find(a => a.envKey === 'cronSecretSet')) {
      actionItems.push({ label: 'Add CRON_SECRET to Vercel env vars', phase: 'Week 4', envKey: 'cronSecretSet', done: false })
    }
  }

  const pending = actionItems.filter(a => !a.done)
  const resolved = actionItems.filter(a => a.done)

  // Current active phase
  const activePhase = ROADMAP.find(p => {
    const pct = Math.round(p.items.filter(i => i.done).length / p.items.length * 100)
    return pct > 0 && pct < 100
  }) || ROADMAP.find(p => p.items.filter(i => i.done).length === 0)

  const overallPct = Math.round(ROADMAP.flatMap(p => p.items).filter(i => i.done).length / ROADMAP.flatMap(p => p.items).length * 100)

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Build pulse */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, padding: '12px 16px', background: 'var(--marker-black)', borderRadius: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', marginBottom: 4, textTransform: 'uppercase' }}>Build progress</div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${overallPct}%`, background: 'var(--marker-lime)', borderRadius: 2 }} />
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-lime)', flexShrink: 0 }}>{overallPct}%</div>
        {activePhase && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.6)', flexShrink: 0, maxWidth: 140 }}>
            {activePhase.phase.split(': ')[0]}<br />
            <span style={{ color: 'rgba(255,255,255,0.35)' }}>{activePhase.phase.split(': ')[1]}</span>
          </div>
        )}
      </div>

      {/* Pending action items */}
      {pending.length > 0 && (
        <div style={{ background: '#FDECEA', border: '1px solid #e74c3c40', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#c0392b', letterSpacing: '0.06em', marginBottom: 10, textTransform: 'uppercase' }}>
            {pending.length} action{pending.length !== 1 ? 's' : ''} need{pending.length === 1 ? 's' : ''} you
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#c0392b', marginTop: 1, flexShrink: 0 }}>!</span>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--marker-black)', fontWeight: 500 }}>{a.label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginTop: 2 }}>{a.phase}{a.envKey ? ' · Vercel env var' : ' · Manual step'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved items */}
      {resolved.length > 0 && (
        <div style={{ background: '#E8F5E0', border: '1px solid #8AC85740', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#2D6A00', letterSpacing: '0.06em', marginBottom: 8, textTransform: 'uppercase' }}>Done</div>
          {resolved.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#2D6A00' }}>✓</span>
              <span style={{ fontSize: 12, color: '#2D6A00', textDecoration: 'line-through', opacity: 0.7 }}>{a.label}</span>
            </div>
          ))}
        </div>
      )}

      {pending.length === 0 && resolved.length === 0 && (
        <div style={{ padding: '10px 16px', background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)' }}>
          No build blockers on you right now. Claude has the next sprint.
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--marker-border)', marginTop: 20, paddingTop: 16 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 12 }}>Your to-do board</div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────

export default function AdminPage() {
  const [section, setSection]       = useState('todos')
  const [todos, setTodos]           = useState([])
  const [taglines, setTaglines]     = useState([])
  const [metrics, setMetrics]       = useState(null)
  const [accounts, setAccounts]     = useState(null)
  const [status, setStatus]         = useState(null)
  const [acctSearch, setAcctSearch] = useState('')
  const [access, setAccess]         = useState('loading')
  const [signedInAs, setSignedInAs] = useState('')

  useEffect(() => {
    const ADMIN = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'robertjamesoxborough@gmail.com'
    createClient().auth.getUser().then(({ data }) => {
      if (!data?.user) { window.location.href = '/auth'; return }
      const email = data.user.email || ''
      setSignedInAs(email)
      if (email !== ADMIN) { setAccess('denied'); return }
      setAccess('granted')

      fetch('/api/admin/todos')
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setTodos(d))
        .catch(() => {})

      // Always fetch status on login so action items are live
      fetch('/api/admin/status')
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setStatus(d))
        .catch(() => {})
    })

    fetch('/api/admin/taglines')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setTaglines(d))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (section === 'metrics' && !metrics) {
      fetch('/api/admin/metrics').then(r => r.ok ? r.json() : null).then(d => d && setMetrics(d)).catch(() => {})
    }
    if (section === 'accounts' && !accounts) {
      fetch('/api/admin/accounts').then(r => r.ok ? r.json() : null).then(d => d && setAccounts(d?.accounts || [])).catch(() => {})
    }
    if (section === 'status') {
      // Always refresh status on every visit
      fetch('/api/admin/status').then(r => r.ok ? r.json() : null).then(d => d && setStatus(d)).catch(() => {})
    }
  }, [section])

  const handleStatusChange = useCallback(async (id, newStatus) => {
    const r = await fetch('/api/admin/todos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: newStatus }) })
    if (r.ok) {
      const updated = await r.json()
      setTodos(prev => prev.map(t => t.id === id ? updated : t))
    }
  }, [])

  const handleDelete = useCallback(async (id) => {
    if (!confirm('Delete this todo?')) return
    await fetch('/api/admin/todos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setTodos(prev => prev.filter(t => t.id !== id))
  }, [])

  const handleAdd = useCallback(async (category, title, description) => {
    const r = await fetch('/api/admin/todos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, title, description }) })
    if (r.ok) {
      const created = await r.json()
      setTodos(prev => [...prev, created])
    }
  }, [])

  const handleActivateTagline = useCallback(async (id) => {
    const r = await fetch('/api/admin/taglines', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (r.ok) {
      const updated = await r.json()
      setTaglines(prev => prev.map(t => ({ ...t, active: t.id === updated.id })))
    }
  }, [])

  if (access === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--marker-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>LOADING</div>
      </div>
    )
  }

  if (access === 'denied') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--marker-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>ACCESS DENIED</div>
        {signedInAs && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#c0392b' }}>Signed in as: {signedInAs}</div>}
        <div style={{ fontSize: 13, color: 'var(--marker-mid)' }}>Admin access requires robertjamesoxborough@gmail.com</div>
        <a href="/app" style={{ fontSize: 13, color: 'var(--marker-text)', marginTop: 8 }}>← Back to app</a>
      </div>
    )
  }

  const todoCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = todos.filter(t => t.category === cat && t.status !== 'done').length
    return acc
  }, {})

  const total = todos.length
  const done = todos.filter(t => t.status === 'done').length
  const inProgress = todos.filter(t => t.status === 'in_progress').length

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'var(--marker-cream)', fontFamily: 'var(--font-body)', color: 'var(--marker-text)' }}>

      {/* ── Top bar ── */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--marker-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--marker-cream)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', color: 'var(--marker-mid)', background: 'var(--marker-border)', padding: '3px 8px', borderRadius: 4 }}>ADMIN</span>
        </div>
        <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>
          <span style={{ color: '#3D3D00' }}>{inProgress} active</span>
          <span style={{ color: '#2D6A00' }}>{done}/{total} done</span>
          <a href="/app" style={{ color: 'var(--marker-mid)', textDecoration: 'none' }}>← App</a>
        </div>
      </div>

      {/* ── Section nav ── */}
      <div style={{ padding: '0 24px', borderBottom: '1px solid var(--marker-border)', display: 'flex', gap: 0, background: 'var(--marker-cream-2)' }}>
        {[
          { id: 'todos',    label: 'To-dos'        },
          { id: 'guides',   label: 'Guides'         },
          { id: 'taglines', label: 'Taglines'       },
          { id: 'flags',    label: 'Feature flags'  },
          { id: 'metrics',  label: 'Metrics'        },
          { id: 'accounts', label: 'Accounts'       },
          { id: 'status',   label: 'Status'         },
          { id: 'roadmap',  label: 'Roadmap'        },
        ].map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{
            background: 'none', border: 'none', padding: '12px 16px', cursor: 'pointer', fontSize: 13,
            fontFamily: 'var(--font-body)', color: section === s.id ? 'var(--marker-black)' : 'var(--marker-mid)',
            fontWeight: section === s.id ? 500 : 400,
            borderBottom: section === s.id ? '2px solid var(--marker-black)' : '2px solid transparent',
          }}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '24px' }}>

        {/* ── TODOS ── */}
        {section === 'todos' && (
          <div>
            <ActionItems status={status} />
            <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(260px, 1fr))', gap: 16, minWidth: 1100 }}>
              {CATEGORIES.map(cat => {
                const catTodos = todos.filter(t => t.category === cat)
                const catDone = catTodos.filter(t => t.status === 'done').length
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)' }}>{CAT_LABELS[cat]}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>{catDone}/{catTodos.length}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {catTodos.filter(t => t.status !== 'done').map(todo => (
                        <TodoCard key={todo.id} todo={todo} onStatusChange={handleStatusChange} onDelete={handleDelete} />
                      ))}
                      {catTodos.filter(t => t.status === 'done').length > 0 && (
                        <details style={{ marginTop: 4 }}>
                          <summary style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', cursor: 'pointer', letterSpacing: '0.04em', padding: '4px 0' }}>
                            {catTodos.filter(t => t.status === 'done').length} DONE
                          </summary>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, opacity: 0.6 }}>
                            {catTodos.filter(t => t.status === 'done').map(todo => (
                              <TodoCard key={todo.id} todo={todo} onStatusChange={handleStatusChange} onDelete={handleDelete} />
                            ))}
                          </div>
                        </details>
                      )}
                      <AddTodo category={cat} onAdd={handleAdd} />
                    </div>
                  </div>
                )
              })}
            </div>
            </div>
          </div>
        )}

        {/* ── TAGLINES ── */}
        {section === 'taglines' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 6 }}>Tagline A/B test</div>
              <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6 }}>
                Click a tagline to make it active. The active tagline shows on the marketing homepage. Track impressions and conversions to pick a winner.
              </div>
            </div>
            <TaglinesPanel taglines={taglines} onActivate={handleActivateTagline} />
            <div style={{ marginTop: 24, padding: 16, background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginBottom: 6, letterSpacing: '0.04em' }}>HOW IT WORKS</div>
              <div style={{ fontSize: 13, color: 'var(--marker-text)', lineHeight: 1.6 }}>
                The homepage fetches the active tagline from the DB on each visit. To track conversions, call <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>POST /api/admin/taglines</code> with <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{"{ id, field: 'conversion' }"}</code> when a user signs up from the marketing page. Impressions should increment on each marketing page load.
              </div>
            </div>
          </div>
        )}

        {/* ── METRICS ── */}
        {section === 'metrics' && (
          <div>
            {!metrics ? (
              <div style={{ padding: '60px 0', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>LOADING...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

                {/* Top stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                  {[
                    { label: 'Total users',      value: metrics.totals.users },
                    { label: 'Trials active',    value: metrics.totals.trialsActive },
                    { label: 'Trials expired',   value: metrics.totals.trialsExpired },
                    { label: 'AI calls (30d)',   value: metrics.totals.aiCallsTotal.toLocaleString() },
                    { label: 'AI spend (30d)',   value: `£${metrics.totals.aiSpendGbp.toFixed(2)}` },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>{s.label}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, color: 'var(--marker-black)' }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                  {/* Spend by action */}
                  <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', marginBottom: 14, textTransform: 'uppercase' }}>Spend by action (30d)</div>
                    {metrics.spendByAction.length === 0
                      ? <div style={{ fontSize: 12, color: 'var(--marker-mid)' }}>No data yet</div>
                      : (() => {
                          const max = Math.max(...metrics.spendByAction.map(a => a.spend), 0.001)
                          return metrics.spendByAction.map(a => (
                            <div key={a.action} style={{ marginBottom: 10 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{a.action}</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>£{a.spend.toFixed(3)} · {a.calls} calls</span>
                              </div>
                              <div style={{ height: 6, background: 'var(--marker-border)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${(a.spend / max) * 100}%`, background: 'var(--marker-black)', borderRadius: 3 }} />
                              </div>
                            </div>
                          ))
                        })()
                    }
                  </div>

                  {/* Track breakdown */}
                  <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', marginBottom: 14, textTransform: 'uppercase' }}>Users by track</div>
                    {metrics.trackBreakdown.length === 0
                      ? <div style={{ fontSize: 12, color: 'var(--marker-mid)' }}>No data yet</div>
                      : (() => {
                          const max = Math.max(...metrics.trackBreakdown.map(t => t.count), 1)
                          const TRACK_LABELS = { balanced: 'Balanced', standard: 'Standard', parent: 'Parent', returner: 'Returner', career_changer: 'Career changer', none: 'No track' }
                          return metrics.trackBreakdown.map(t => (
                            <div key={t.track} style={{ marginBottom: 10 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-text)', letterSpacing: '0.04em' }}>{TRACK_LABELS[t.track] || t.track}</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>{t.count}</span>
                              </div>
                              <div style={{ height: 6, background: 'var(--marker-border)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${(t.count / max) * 100}%`, background: 'var(--marker-lime)', borderRadius: 3 }} />
                              </div>
                            </div>
                          ))
                        })()
                    }
                  </div>
                </div>

                {/* Signups by day */}
                {metrics.signupsByDay.length > 0 && (
                  <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', marginBottom: 14, textTransform: 'uppercase' }}>Signups (last 30 days)</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
                      {(() => {
                        const max = Math.max(...metrics.signupsByDay.map(d => d.count), 1)
                        return metrics.signupsByDay.map(d => (
                          <div key={d.date} title={`${d.date}: ${d.count}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                            <div style={{ width: '100%', background: 'var(--marker-black)', borderRadius: '2px 2px 0 0', height: `${Math.max((d.count / max) * 100, 8)}%` }} />
                          </div>
                        ))
                      })()}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)' }}>
                      <span>{metrics.signupsByDay[0]?.date?.slice(5)}</span>
                      <span>{metrics.signupsByDay[metrics.signupsByDay.length - 1]?.date?.slice(5)}</span>
                    </div>
                  </div>
                )}

                {/* Spend by day */}
                {metrics.spendByDay.length > 0 && (
                  <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', marginBottom: 14, textTransform: 'uppercase' }}>AI spend / day (30d)</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
                      {(() => {
                        const max = Math.max(...metrics.spendByDay.map(d => d.spend), 0.001)
                        return metrics.spendByDay.map(d => (
                          <div key={d.date} title={`${d.date}: £${d.spend.toFixed(3)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                            <div style={{ width: '100%', background: 'var(--marker-lime)', borderRadius: '2px 2px 0 0', height: `${Math.max((d.spend / max) * 100, 8)}%` }} />
                          </div>
                        ))
                      })()}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)' }}>
                      <span>{metrics.spendByDay[0]?.date?.slice(5)}</span>
                      <span>{metrics.spendByDay[metrics.spendByDay.length - 1]?.date?.slice(5)}</span>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        )}

        {/* ── ACCOUNTS ── */}
        {section === 'accounts' && (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={acctSearch} onChange={e => setAcctSearch(e.target.value)}
                placeholder="Search by email or name…"
                style={{ flex: 1, maxWidth: 360, padding: '8px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', fontFamily: 'var(--font-body)' }}
              />
              {accounts && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>{accounts.length} users</span>}
              <button
                onClick={async () => {
                  if (!confirm('Reset onboarding for ALL accounts? They will all be redirected to /onboard on next login.')) return
                  const r = await fetch('/api/admin/reset-onboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
                  const json = await r.json().catch(() => ({}))
                  if (r.ok) {
                    alert('Done: all accounts will see onboarding on next login.')
                    fetch('/api/admin/accounts').then(r => r.ok ? r.json() : null).then(d => d && setAccounts(d?.accounts || []))
                  } else {
                    alert(`Failed: ${json.error || r.status}`)
                  }
                }}
                style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', padding: '7px 14px', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}
              >
                RESET ALL ONBOARDING
              </button>
              <button
                onClick={async () => {
                  if (!confirm('Reset 7-day trial for ALL accounts?')) return
                  const r = await fetch('/api/admin/reset-trial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
                  const json = await r.json().catch(() => ({}))
                  if (r.ok) {
                    alert(`Done: all trials reset to 7 days (ends ${new Date(json.trialEndsAt).toLocaleDateString('en-GB')}).`)
                    fetch('/api/admin/accounts').then(r => r.ok ? r.json() : null).then(d => d && setAccounts(d?.accounts || []))
                  } else {
                    alert(`Failed: ${json.error || r.status}`)
                  }
                }}
                style={{ background: '#EFF6FF', border: '1px solid #93C5FD', color: '#1D4ED8', padding: '7px 14px', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}
              >
                RESET ALL TRIALS
              </button>
            </div>
            {!accounts ? (
              <div style={{ padding: '60px 0', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>LOADING...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-body)', minWidth: 900 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--marker-border)' }}>
                      {['Email', 'Track', 'Trial', 'Signed up', 'Last sign-in', 'AI spend', 'Ref', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {accounts
                      .filter(a => {
                        if (!acctSearch.trim()) return true
                        const q = acctSearch.toLowerCase()
                        return (a.email || '').toLowerCase().includes(q) || (a.name || '').toLowerCase().includes(q)
                      })
                      .map(a => {
                        const trialColor = a.trialStatus === 'active' ? '#2D6A00' : a.trialStatus === 'expired' ? '#c0392b' : 'var(--marker-mid)'
                        const TRACK_LABELS = { balanced: 'Balanced', standard: 'Standard', parent: 'Parent', returner: 'Returner', career_changer: 'Changer' }
                        return (
                          <tr key={a.id} style={{ borderBottom: '1px solid var(--marker-border)', background: a.archived ? 'rgba(0,0,0,0.02)' : 'transparent' }}>
                            <td style={{ padding: '9px 10px', color: a.archived ? 'var(--marker-mid)' : 'var(--marker-black)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {a.email}
                              {a.archived && <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', opacity: 0.6 }}>archived</span>}
                            </td>
                            <td style={{ padding: '9px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>
                              {a.track ? TRACK_LABELS[a.track] || a.track : 'n/a'}
                            </td>
                            <td style={{ padding: '9px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: trialColor }}>
                              {a.trialStatus === 'active'
                                ? `Active · ${Math.ceil((new Date(a.trialEndsAt) - new Date()) / 86400000)}d left`
                                : a.trialStatus === 'expired' ? 'Expired'
                                : 'n/a'}
                            </td>
                            <td style={{ padding: '9px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', whiteSpace: 'nowrap' }}>
                              {a.signedUpAt ? new Date(a.signedUpAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'n/a'}
                            </td>
                            <td style={{ padding: '9px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', whiteSpace: 'nowrap' }}>
                              {a.lastSignIn ? new Date(a.lastSignIn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'n/a'}
                            </td>
                            <td style={{ padding: '9px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: a.aiSpendGbp > 0.5 ? '#c0392b' : 'var(--marker-mid)', whiteSpace: 'nowrap' }}>
                              {a.aiSpendGbp > 0 ? `£${a.aiSpendGbp.toFixed(3)}` : 'n/a'}
                            </td>
                            <td style={{ padding: '9px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>
                              {a.refCode || 'n/a'}
                            </td>
                            <td style={{ padding: '9px 10px', whiteSpace: 'nowrap', display: 'flex', gap: 6, alignItems: 'center' }}>
                              <button
                                onClick={async () => {
                                  const r = await fetch('/api/admin/reset-onboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: a.id }) })
                                  if (r.ok) {
                                    setAccounts(prev => prev.map(u => u.id === a.id ? { ...u, track: null } : u))
                                  }
                                }}
                                style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', padding: '3px 8px', borderRadius: 5, fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em' }}
                              >
                                ONBOARD
                              </button>
                              <button
                                onClick={async () => {
                                  const r = await fetch('/api/admin/reset-trial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: a.id }) })
                                  const json = await r.json().catch(() => ({}))
                                  if (r.ok) {
                                    const newEndsAt = json.trialEndsAt
                                    setAccounts(prev => prev.map(u => u.id === a.id ? { ...u, trialEndsAt: newEndsAt, trialStatus: 'active' } : u))
                                  }
                                }}
                                style={{ background: '#EFF6FF', border: '1px solid #93C5FD', color: '#1D4ED8', padding: '3px 8px', borderRadius: 5, fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em' }}
                              >
                                TRIAL
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── FEATURE FLAGS STUB ── */}
        {section === 'flags' && (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em', marginBottom: 12 }}>COMING SOON</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8 }}>Feature flags</div>
            <div style={{ fontSize: 14, color: 'var(--marker-mid)' }}>Needs a feature_flags table; building in a future sprint.</div>
          </div>
        )}

        {/* ── STATUS ── */}
        {section === 'status' && (
          <div>
            {!status ? (
              <div style={{ padding: '60px 0', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>LOADING...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* Env var health */}
                <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', marginBottom: 12, textTransform: 'uppercase' }}>Env vars</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'ADZUNA_APP_ID + ADZUNA_API_KEY', ok: status.envCheck.adzunaConfigured, fix: 'Add to Vercel → Settings → Environment Variables' },
                      { label: 'CRON_SECRET',                    ok: status.envCheck.cronSecretSet,    fix: 'Add to Vercel env vars to protect cron endpoints' },
                      { label: 'SUPABASE_SERVICE_ROLE_KEY',      ok: status.envCheck.serviceRoleSet,   fix: 'Required for admin APIs and crons' },
                    ].map(e => (
                      <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: e.ok ? '#2D6A00' : '#c0392b', minWidth: 12 }}>{e.ok ? '✓' : '✗'}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-text)' }}>{e.label}</span>
                        {!e.ok && <span style={{ fontSize: 11, color: 'var(--marker-mid)' }}>{e.fix}</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cron status cards */}
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', marginBottom: 12, textTransform: 'uppercase' }}>Background jobs</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                    {status.cronStatus.map(cron => {
                      const health = cronHealth(cron.lastRun)
                      const healthColor = { ok: '#2D6A00', warn: '#7A6000', stale: '#c0392b', never: 'var(--marker-mid)' }[health]
                      const healthBg   = { ok: '#E8F5E0', warn: '#FFF8DC', stale: '#FDECEA', never: 'var(--marker-cream-2)' }[health]
                      const healthLabel= { ok: 'OK', warn: 'WARN', stale: 'STALE', never: 'NEVER RAN' }[health]
                      return (
                        <div key={cron.id} style={{ background: healthBg, border: `1px solid ${healthColor}40`, borderRadius: 10, padding: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)' }}>{cron.label}</div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: healthColor, letterSpacing: '0.06em', background: `${healthColor}20`, padding: '2px 6px', borderRadius: 4 }}>{healthLabel}</span>
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginBottom: 4 }}>{cron.schedule}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: healthColor }}>
                            {cron.lastRun ? `Last run ${timeAgo(cron.lastRun)}` : 'Has not run yet'}
                          </div>
                          {cron.jobCount !== null && (
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginTop: 4 }}>
                              {cron.jobCount.toLocaleString()} jobs in cache
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* AI calls */}
                <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: 16, display: 'flex', gap: 32 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>AI calls (24h)</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, color: 'var(--marker-black)' }}>{status.aiCalls24h}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>AI calls (all time)</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, color: 'var(--marker-black)' }}>{status.aiCallsTotal.toLocaleString()}</div>
                  </div>
                </div>

                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', textAlign: 'right' }}>Refreshes each time you open this tab</div>

              </div>
            )}
          </div>
        )}

        {/* ── GUIDES ── */}
        {section === 'guides' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 6 }}>Lead magnet guides</div>
              <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6 }}>
                Five free downloadable guides hosted at /guides. Each ends with a CTA to /auth. Use these in LinkedIn posts, email campaigns, and organic SEO.
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {[
                {
                  title: 'The Work-Life Balance Employer Guide 2026',
                  tag: 'Flagship',
                  slug: 'wlb-employer-guide',
                  time: '15 min read',
                  status: 'live',
                  content: '10 UK employers with WLB scores, parental leave weeks, office days, and notes. 5 interview questions that expose what job ads hide. 10 red flags. 5-step "how to verify WLB claims" process.',
                  useFor: 'LinkedIn carousels, email nurture, WLB search organic traffic',
                },
                {
                  title: 'The 30-Minute Role Assessment',
                  tag: 'Productivity',
                  slug: '30-minute-role-check',
                  time: '10 min read',
                  status: 'live',
                  content: '8 checks to run before applying for any senior role: salary sanity, WLB reality, office days, hiring manager signals, headcount growth, real benefits, role age, culture alignment. Each check includes how to do it, what to look for, and how Requite automates it.',
                  useFor: 'Job seeker productivity content, LinkedIn tips, newsletter leads',
                },
                {
                  title: 'The Senior Job Hunt Playbook',
                  tag: 'Strategy',
                  slug: 'senior-job-hunt-playbook',
                  time: '12 min read',
                  status: 'live',
                  content: '7 rules that change above Head of level: job boards are last resort, CV is for recruiters not hiring managers, negotiation starts at first contact, search firms are not your friends, hidden jobs = your network, senior interviews test judgment, first 90 days matter more than the offer.',
                  useFor: 'LinkedIn authority content, Director/VP audience, organic search',
                },
                {
                  title: 'The LinkedIn Job Search Bible',
                  tag: 'Tactics',
                  slug: 'linkedin-search-bible',
                  time: '8 min read',
                  status: 'live',
                  content: '6 Boolean search strings for senior roles by function. 6 key filters explained with why they matter. 3 InMail templates with guidance notes: recruiter cold outreach, warm intro request, direct speculative outreach to hiring managers.',
                  useFor: 'LinkedIn niche, high shareability, tactical job seeker audience',
                },
                {
                  title: "The Parent's Guide to Finding a Better Job",
                  tag: 'Parent track',
                  slug: 'parent-job-hunt-guide',
                  time: '10 min read',
                  status: 'live',
                  content: '7 things to check before applying: actual parental leave policy numbers, whether leave is taken in practice, office days counted, senior parents who stayed, CEO culture signals, emergency flexibility, interview scheduling as a preview. 5 interview questions to ask verbatim.',
                  useFor: 'Parent audience, returner audience, parental leave search traffic',
                },
                {
                  title: 'Stop Applying for Everything. Start Winning the Right Ones.',
                  tag: 'Strategy',
                  slug: 'score-tier-guide',
                  time: '8 min read',
                  status: 'live',
                  content: 'The score-tier system: 80+ = write it yourself (Tier 1), 60-79 = AI drafts, you personalise (Tier 2), 40-59 = AI handles it (Tier 3), below 40 = skip. Explains what to do at each tier, why effort allocation matters more than application volume, and what a good week looks like when you follow the system.',
                  useFor: 'Core Requite value prop; directly ties job score to time-saving, perfect for acquisition content and LinkedIn authority posts',
                },
              ].map(g => (
                <div key={g.slug} style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.01em', lineHeight: 1.3 }}>{g.title}</div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, background: g.status === 'live' ? '#E8F5E0' : 'var(--marker-cream)', border: `1px solid ${g.status === 'live' ? '#8AC857' : 'var(--marker-border)'}`, color: g.status === 'live' ? '#2D6A00' : 'var(--marker-mid)', padding: '3px 8px', borderRadius: 4, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>{g.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)' }}>
                    <span>{g.tag}</span>
                    <span>·</span>
                    <span>{g.time}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.6 }}>{g.content}</div>
                  <div style={{ background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', borderLeft: '3px solid var(--marker-lime)', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-lime)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>Use for</div>
                    <div style={{ fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1.5 }}>{g.useFor}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href={`/guides/${g.slug}`} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-black)', background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '5px 10px', borderRadius: 6, textDecoration: 'none', letterSpacing: '0.04em', textTransform: 'uppercase' }}>View guide →</a>
                    <button
                      onClick={() => { navigator.clipboard.writeText(`https://marker-silk.vercel.app/guides/${g.slug}`) }}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', background: 'none', border: '1px solid var(--marker-border)', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}
                    >Copy URL</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: 16, background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Distribution playbook</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  'LinkedIn post: share 3 key stats from the WLB guide as a list post; link to the full guide in the first comment',
                  'LinkedIn carousel: turn the 8-point role assessment into a 9-slide carousel (one point per slide + CTA slide)',
                  'Email nurture: send the parent guide to anyone who ticks the "parent" filter during signup',
                  'SEO: each guide is a static page; submit to Google Search Console after launch',
                  'Product Hunt: mention guides as a free resource in the launch post to appeal to job seeker voters',
                ].map((tip, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-lime)', flexShrink: 0, marginTop: 1 }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.6 }}>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ROADMAP ── */}
        {section === 'roadmap' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Overall progress */}
            {(() => {
              const allItems = ROADMAP.flatMap(p => p.items)
              const doneCount = allItems.filter(i => i.done).length
              const pct = Math.round((doneCount / allItems.length) * 100)
              return (
                <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--marker-black)' }}>Overall build progress</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--marker-black)', fontWeight: 500 }}>{pct}%</div>
                  </div>
                  <div style={{ height: 8, background: 'var(--marker-border)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--marker-lime)', borderRadius: 4, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginTop: 8 }}>{doneCount} of {allItems.length} tasks done across all phases</div>
                </div>
              )
            })()}

            {/* Phase cards */}
            {ROADMAP.map(phase => {
              const doneCount = phase.items.filter(i => i.done).length
              const pct = Math.round((doneCount / phase.items.length) * 100)
              const isComplete = pct === 100
              const isActive = !isComplete && phase.items.some(i => i.done)
              const isFuture = doneCount === 0
              const targetDate = new Date(phase.targetDate)
              const isPast = targetDate < new Date()
              const dateStr = targetDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

              return (
                <div key={phase.phase} style={{
                  background: isComplete ? '#E8F5E0' : 'var(--marker-cream-2)',
                  border: `1px solid ${isComplete ? '#8AC857' : isActive ? 'var(--marker-lime)' : 'var(--marker-border)'}`,
                  borderRadius: 10, padding: 16,
                  opacity: isFuture ? 0.75 : 1,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 3 }}>{phase.phase}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: isPast && !isComplete ? '#c0392b' : 'var(--marker-mid)' }}>
                        Target: {dateStr}{isPast && !isComplete ? ' (overdue)' : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: isComplete ? '#2D6A00' : 'var(--marker-black)' }}>{pct}%</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>{doneCount}/{phase.items.length} done</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 4, background: 'var(--marker-border)', borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: isComplete ? '#8AC857' : 'var(--marker-lime)', borderRadius: 2 }} />
                  </div>

                  {/* Task list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {phase.items.map(item => (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: item.done ? '#2D6A00' : 'var(--marker-border)', flexShrink: 0 }}>{item.done ? '✓' : '○'}</span>
                        <span style={{ fontSize: 12, color: item.done ? 'var(--marker-mid)' : 'var(--marker-text)', textDecoration: item.done ? 'line-through' : 'none' }}>{item.label}</span>
                      </div>
                    ))}

                    {/* Blockers */}
                    {phase.blockers.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--marker-border)' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>
                          {phase.blockers.some(b => b.youDo) ? 'Needs you' : 'Blocked on'}
                        </div>
                        {phase.blockers.map(b => (
                          <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: b.youDo ? '#c0392b' : '#7A6000', flexShrink: 0 }}>{b.youDo ? '!' : '⧖'}</span>
                            <span style={{ fontSize: 12, color: b.youDo ? '#c0392b' : '#7A6000', fontWeight: b.youDo ? 500 : 400 }}>{b.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

          </div>
        )}

      </div>
    </div>
  )
}
