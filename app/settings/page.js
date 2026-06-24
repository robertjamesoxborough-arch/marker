'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getProfile, saveProfile } from '../../lib/db'
import { createClient } from '../../lib/supabase/client'

const ROLE_FAMILIES = [
  'Partnerships', 'Product Marketing', 'Programme Lead', 'Digital Strategy',
  'Growth', 'BD', 'Engineering', 'Design', 'Data', 'Product Management',
  'Ops', 'Finance', 'HR', 'Sales', 'Customer Success', 'Marketing Generalist',
]

const SENIORITIES = [
  { id: 'ic',             label: 'Individual Contributor' },
  { id: 'manager',        label: 'Manager' },
  { id: 'senior_manager', label: 'Senior Manager' },
  { id: 'head',           label: 'Head of' },
  { id: 'director',       label: 'Director' },
  { id: 'vp_plus',        label: 'VP+' },
]

const INDUSTRIES = [
  'Fintech', 'SaaS', 'Gaming', 'Martech', 'Retail Tech', 'Media',
  'EdTech', 'HealthTech', 'Public Sector', 'Charity / Non-profit',
  'Consumer Goods', 'Professional Services', 'Other',
]

const TRACK_LABELS = {
  balanced: 'Balanced', standard: 'Standard', parent: 'Parent',
  returner: 'Returner', career_changer: 'Career changer',
}

function Chip({ label, selected, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 13px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
      background: selected ? 'var(--marker-black)' : 'transparent',
      color: selected ? 'var(--marker-cream)' : 'var(--marker-text)',
      border: `1px solid ${selected ? 'var(--marker-black)' : 'var(--marker-border)'}`,
      fontFamily: 'var(--font-body)', fontWeight: selected ? 500 : 400,
    }}>
      {label}
    </button>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ borderBottom: '1px solid var(--marker-border)', paddingBottom: 24, marginBottom: 24 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  )
}

function Label({ children, sub }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--marker-text)' }}>{children}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--marker-mid)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

const PLAN_LABELS = { free: 'Free', standby: 'Standby', lite: 'Lite', pro: 'Pro', trial: 'Trial' }
const PLANS_UI = [
  { id: 'standby', name: 'Standby', price: '£4/mo', desc: 'Passive scanning for employed professionals' },
  { id: 'lite',    name: 'Lite',    price: '£12/mo', desc: 'Full access for active job seekers' },
  { id: 'pro',     name: 'Pro',     price: '£24/mo', desc: 'Everything in Lite, higher limits' },
]

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [tier, setTier]         = useState('free')
  const [upgrading, setUpgrading] = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)

  const [targetRoles, setTargetRoles]       = useState([])
  const [seniorities, setSeniorities]       = useState([])
  const [industries, setIndustries]         = useState([])
  const [maxOfficeDays, setMaxOfficeDays]   = useState(2)
  const [salaryFloor, setSalaryFloor]       = useState('')
  const [postcode, setPostcode]             = useState('')
  const [cvText, setCvText]                 = useState('')
  const [excludeSalesQuotas, setExcludeSalesQuotas] = useState(false)
  const [deleteConfirm, setDeleteConfirm]   = useState('')
  const [deleting, setDeleting]             = useState(false)
  const [deleteError, setDeleteError]       = useState('')

  // Profile enrichment
  const [field, setField]                     = useState('')
  const [yearsExperience, setYearsExperience] = useState('')
  const [careerSummary, setCareerSummary]     = useState('')
  const [wlbPriority, setWlbPriority]         = useState('medium')

  // Feature flags (Section C)
  const [searchMode, setSearchMode]           = useState('perm') // 'perm' | 'contractor' | 'both'
  const [wantsGov, setWantsGov]               = useState(false)
  const [wantsEasyLife, setWantsEasyLife]     = useState(false)
  const [wantsCvGen, setWantsCvGen]           = useState(true)
  const [wantsInterviewPrep, setWantsInterviewPrep] = useState(true)

  // Contract details (Section D)
  const [contractTypes, setContractTypes]     = useState([])
  const [ir35Willing, setIr35Willing]         = useState(null)
  const [contractGoal, setContractGoal]       = useState([])
  const [contractorField, setContractorField] = useState('')

  async function startCheckout(plan) {
    setUpgrading(plan)
    setError('')
    try {
      const r = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await r.json()
      if (data.url) window.location.href = data.url
      else throw new Error(data.error || 'No checkout URL returned')
    } catch {
      setUpgrading(null)
      setError('Checkout failed — try again or contact support@requite.io.')
    }
  }

  async function openPortal() {
    setPortalLoading(true)
    setError('')
    try {
      const r = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await r.json()
      if (data.url) window.location.href = data.url
      else throw new Error(data.error || 'No portal URL returned')
    } catch {
      setPortalLoading(false)
      setError('Could not open billing portal — try again or contact support@requite.io.')
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('upgraded')) { window.history.replaceState({}, '', '/settings') }
    createClient().auth.getUser().then(async ({ data }) => {
      setUserEmail(data.user?.email || '')
      // Fetch tier from users table
      if (data.user) {
        const { createClient: sc } = await import('@supabase/supabase-js')
        // Use public endpoint to get tier
        const r = await fetch('/api/profile/tier').catch(() => null)
        if (r?.ok) { const d = await r.json(); setTier(d.tier || 'free') }
      }
    })
    getProfile().then(p => {
      if (!p) { router.replace('/onboard'); return }
      const hfj = p.hard_filters_json || {}
      setTargetRoles(p.target_roles || [])
      setSeniorities(hfj.seniorities || (p.seniority ? [p.seniority] : []))
      setIndustries(p.industries || [])
      setMaxOfficeDays(p.max_office_days ?? 2)
      setSalaryFloor(p.salary_floor ? String(Math.round(p.salary_floor / 1000)) : '')
      setPostcode(p.postcode || '')
      setCvText(hfj.cvRaw || '')
      setExcludeSalesQuotas(hfj.excludeSalesQuotas || false)
      // Profile enrichment
      setField(hfj.field || '')
      setYearsExperience(hfj.yearsExperience || '')
      setCareerSummary(hfj.careerSummary || '')
      setWlbPriority(hfj.wlbPriority || 'medium')
      // Feature flags
      setSearchMode(hfj.searchMode || (hfj.openToContract === true ? 'both' : 'perm'))
      setWantsGov(hfj.wantsGov ?? false)
      setWantsEasyLife(hfj.wantsEasyLife ?? false)
      setWantsCvGen(hfj.wantsCvGen ?? true)
      setWantsInterviewPrep(hfj.wantsInterviewPrep ?? true)
      // Contract details
      setContractTypes(hfj.contractTypes || [])
      setIr35Willing(hfj.ir35Willing ?? null)
      setContractGoal(Array.isArray(hfj.contractGoal) ? hfj.contractGoal : hfj.contractGoal ? [hfj.contractGoal] : [])
      setContractorField(hfj.contractorField || '')
      setLoading(false)
    }).catch(() => { router.replace('/auth') })
  }, [])

  function toggle(arr, setArr, id) {
    setArr(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await saveProfile({
        targetRoles,
        seniorities,
        industries,
        maxOfficeDays,
        salaryFloor,
        postcode,
        excludeSalesQuotas,
        cvRaw: cvText.trim() || null,
        // Profile enrichment
        field: field || null,
        yearsExperience: yearsExperience || null,
        careerSummary: careerSummary.trim() || null,
        wlbPriority,
        // Feature flags
        searchMode,
        openToContract: searchMode !== 'perm',
        wantsGov,
        wantsEasyLife,
        wantsCvGen,
        wantsInterviewPrep,
        // Contract details
        contractTypes,
        ir35Willing,
        contractGoal: contractGoal.length > 0 ? contractGoal : null,
        contractorField: contractorField.trim() || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e?.message || 'Save failed — try again.')
    } finally {
      setSaving(false)
    }
  }

  async function signOut() {
    await createClient().auth.signOut()
    window.location.href = '/'
  }

  async function deleteAccount() {
    if (deleteConfirm !== 'delete my account') return
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      if (!res.ok) throw new Error('Delete failed')
      await createClient().auth.signOut()
      window.location.href = '/?deleted=1'
    } catch (e) {
      setDeleteError(e?.message || 'Deletion failed — contact hello@marker.work')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--marker-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>LOADING</div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'var(--marker-cream)', fontFamily: 'var(--font-body)', color: 'var(--marker-text)' }}>

      {/* Header */}
      <div style={{ background: 'var(--marker-cream)', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid var(--marker-border)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => router.push('/app')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--marker-mid)', fontSize: 20, lineHeight: 1, padding: 0 }}>←</button>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500 }}>Settings</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {error && <span style={{ fontSize: 11, color: '#B91C1C' }}>{error}</span>}
            {saved && <span style={{ fontSize: 11, color: '#065F46', fontFamily: 'var(--font-mono)' }}>SAVED ✓</span>}
            <button onClick={save} disabled={saving} style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* Account */}
        <Section title="Account">
          <div style={{ fontSize: 13, color: 'var(--marker-mid)', marginBottom: 16 }}>{userEmail}</div>
          <button onClick={signOut} style={{ background: 'none', border: '1px solid var(--marker-border)', color: 'var(--marker-text)', padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Sign out</button>

        {/* Billing */}
        <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--marker-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>Plan</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {PLAN_LABELS[tier] || tier}
                {tier === 'trial' && ' · 7 days free'}
              </div>
            </div>
            {['standby', 'lite', 'pro'].includes(tier) && (
              <button onClick={openPortal} disabled={portalLoading} style={{ fontSize: 12, padding: '7px 14px', background: 'none', border: '1px solid var(--marker-border)', borderRadius: 8, cursor: 'pointer', color: 'var(--marker-text)', fontFamily: 'var(--font-body)' }}>
                {portalLoading ? 'Loading…' : 'Manage subscription'}
              </button>
            )}
          </div>

          {!['standby', 'lite', 'pro'].includes(tier) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PLANS_UI.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', border: '1px solid var(--marker-border)', borderRadius: 10, background: 'var(--marker-cream-2)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 2 }}>{p.name} <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)' }}>{p.price}</span></div>
                    <div style={{ fontSize: 11, color: 'var(--marker-mid)' }}>{p.desc}</div>
                  </div>
                  <button
                    onClick={() => startCheckout(p.id)}
                    disabled={upgrading === p.id}
                    style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer', flexShrink: 0, opacity: upgrading === p.id ? 0.6 : 1 }}
                  >
                    {upgrading === p.id ? 'Loading…' : 'Upgrade'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        </Section>

        {/* Target roles */}
        <Section title="Target roles">
          <Label sub="Which role families are you looking for?">Role families</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ROLE_FAMILIES.map(r => (
              <Chip key={r} label={r} selected={targetRoles.includes(r)} onClick={() => toggle(targetRoles, setTargetRoles, r)} />
            ))}
          </div>
        </Section>

        {/* Seniority */}
        <Section title="Seniority">
          <Label sub="Select all that apply">Target level(s)</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SENIORITIES.map(s => (
              <Chip key={s.id} label={s.label} selected={seniorities.includes(s.id)} onClick={() => toggle(seniorities, setSeniorities, s.id)} />
            ))}
          </div>
        </Section>

        {/* Industries */}
        <Section title="Industries">
          <Label sub="Sectors you want to work in">Target sectors</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {INDUSTRIES.map(ind => (
              <Chip key={ind} label={ind} selected={industries.includes(ind)} onClick={() => toggle(industries, setIndustries, ind)} />
            ))}
          </div>
        </Section>

        {/* Work preferences */}
        <Section title="Work preferences">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <Label>Max office days / week</Label>
              <input type="number" min="0" max="5" step="0.5" value={maxOfficeDays} onChange={e => setMaxOfficeDays(e.target.value)} style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <Label>Salary floor (£k)</Label>
              <input type="number" value={salaryFloor} onChange={e => setSalaryFloor(e.target.value)} placeholder="e.g. 90" style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <Label sub="Used for commute distance checks">Postcode (partial is fine)</Label>
            <input value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="e.g. SW1A" style={{ display: 'block', width: '100%', maxWidth: 200, padding: '9px 12px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={excludeSalesQuotas} onChange={e => setExcludeSalesQuotas(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--marker-black)' }} />
            <span style={{ fontSize: 13 }}>Exclude quota-carrying sales roles</span>
          </label>
        </Section>

        {/* CV */}
        <Section title="Your CV">
          <Label sub={`${cvText.length > 0 ? `${cvText.length.toLocaleString()} characters stored` : 'No CV on file'} · used by the CV Generator and scoring`}>CV text</Label>
          <textarea
            value={cvText}
            onChange={e => setCvText(e.target.value)}
            placeholder="Paste your CV here as plain text…"
            rows={10}
            style={{ display: 'block', width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6, fontFamily: 'var(--font-mono)' }}
          />
          <div style={{ fontSize: 11, color: 'var(--marker-mid)', marginTop: 6 }}>Paste as plain text. Formatting is stripped — content is what matters for ATS matching.</div>
        </Section>

        {/* Background */}
        <Section title="Professional background">
          <Label sub="Used to tune job searches, scoring, and CV generation">Field</Label>
          <select value={field} onChange={e => setField(e.target.value)} style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }}>
            <option value="">Not set</option>
            {['Software/IT','Data/Analytics','Product','Design/UX','Marketing','Sales/BD','Partnerships','Operations','Finance/Accounting','HR/People','Legal','Customer Success/Support','Engineering (non-software)','Healthcare/Clinical','Education/Academia','Public sector/Policy','Project/Programme Management','Consulting','Other'].map(f => <option key={f} value={f}>{f}</option>)}
          </select>

          <Label>Years of experience</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {[{ id: 'under2', label: 'Under 2' }, { id: '2to5', label: '2–5' }, { id: '5to10', label: '5–10' }, { id: '10to15', label: '10–15' }, { id: '15plus', label: '15+' }].map(y => (
              <button key={y.id} onClick={() => setYearsExperience(y.id)} style={{ padding: '7px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)', border: `1px solid ${yearsExperience === y.id ? 'var(--marker-black)' : 'var(--marker-border)'}`, background: yearsExperience === y.id ? 'var(--marker-black)' : 'var(--marker-cream-2)', color: yearsExperience === y.id ? 'var(--marker-cream)' : 'var(--marker-text)' }}>{y.label} yrs</button>
            ))}
          </div>

          <Label sub="Used when no CV is stored — a few sentences about your background">Career summary</Label>
          <textarea value={careerSummary} onChange={e => setCareerSummary(e.target.value)} placeholder="e.g. 10 years in digital marketing, most recently Head of Growth at a Series B startup. Looking for a Director-level role." rows={4} style={{ display: 'block', width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6, fontFamily: 'var(--font-body)' }} />

          <div style={{ marginTop: 16 }}>
            <Label>Work-life balance priority</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ id: 'low', label: 'Low' }, { id: 'medium', label: 'Medium' }, { id: 'high', label: 'High' }].map(w => (
                <button key={w.id} onClick={() => setWlbPriority(w.id)} style={{ flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)', border: `1px solid ${wlbPriority === w.id ? 'var(--marker-black)' : 'var(--marker-border)'}`, background: wlbPriority === w.id ? 'var(--marker-black)' : 'var(--marker-cream-2)', color: wlbPriority === w.id ? 'var(--marker-cream)' : 'var(--marker-text)' }}>{w.label}</button>
              ))}
            </div>
          </div>
        </Section>

        {/* Feature flags */}
        <Section title="Features">
          <Label sub="Controls which tools appear in your workspace">Search mode</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {[
              { id: 'perm',       label: 'Permanent roles only',      sub: 'CV tailoring, interview prep, perm job feed' },
              { id: 'contractor', label: 'Contract / interim only',    sub: 'Generic CV for recruiter blast, contractor role scanner, agency finder' },
              { id: 'both',       label: 'Both — perm and contractor', sub: 'Full access to all tools' },
            ].map(opt => (
              <button key={opt.id} onClick={() => setSearchMode(opt.id)} style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font-body)', border: `1px solid ${searchMode === opt.id ? 'var(--marker-black)' : 'var(--marker-border)'}`, background: searchMode === opt.id ? 'var(--marker-black)' : 'var(--marker-cream-2)' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: searchMode === opt.id ? 'var(--marker-cream)' : 'var(--marker-text)', marginBottom: 2 }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: searchMode === opt.id ? 'rgba(255,255,255,0.6)' : 'var(--marker-mid)', lineHeight: 1.4 }}>{opt.sub}</div>
              </button>
            ))}
          </div>

          {[
            { key: 'wantsGov', val: wantsGov, set: setWantsGov, label: 'Show public sector roles', sub: 'Civil service and NHS roles in your feed' },
            { key: 'wantsCvGen', val: wantsCvGen, set: setWantsCvGen, label: 'CV and cover letter generation', sub: 'Hides the CV tab if turned off' },
            { key: 'wantsInterviewPrep', val: wantsInterviewPrep, set: setWantsInterviewPrep, label: 'Interview preparation', sub: 'Hides the Interview tab if turned off' },
          ].map(({ key, val, set, label, sub }) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid var(--marker-border)' }}>
              <div style={{ flex: 1, paddingRight: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--marker-black)' }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--marker-mid)', marginTop: 2 }}>{sub}</div>
              </div>
              <button onClick={() => set(v => !v)} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0, background: val ? 'var(--marker-lime)' : 'var(--marker-border)', position: 'relative' }}>
                <span style={{ position: 'absolute', top: 2, left: val ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: 'var(--marker-black)', transition: 'left 0.15s' }} />
              </button>
            </div>
          ))}
        </Section>

        {/* Contract details — shown when contractor mode active */}
        {searchMode !== 'perm' && (
          <Section title="Contract details">
            <Label sub="Used to tune your Contractor Routes tab">Contract types</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {[{ id: 'day_rate', label: 'Day-rate' }, { id: 'ftc', label: 'FTC' }, { id: 'interim', label: 'Interim' }, { id: 'freelance', label: 'Freelance / SOW' }].map(ct => (
                <Chip key={ct.id} label={ct.label} selected={contractTypes.includes(ct.id)} onClick={() => toggle(contractTypes, setContractTypes, ct.id)} />
              ))}
            </div>

            <Label>IR35 preference</Label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[{ id: true, label: 'Outside IR35' }, { id: false, label: 'Inside only' }, { id: null, label: 'Either' }].map(o => (
                <button key={String(o.id)} onClick={() => setIr35Willing(o.id)} style={{ flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-body)', border: `1px solid ${ir35Willing === o.id ? 'var(--marker-black)' : 'var(--marker-border)'}`, background: ir35Willing === o.id ? 'var(--marker-black)' : 'var(--marker-cream-2)', color: ir35Willing === o.id ? 'var(--marker-cream)' : 'var(--marker-text)' }}>{o.label}</button>
              ))}
            </div>

            <Label>Contracting goal</Label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[{ id: 'contract', label: 'Pure contracting' }, { id: 'either', label: 'Contract or perm' }, { id: 'perm', label: 'Contract-to-perm' }].map(g => (
                <button key={g.id} onClick={() => toggle(contractGoal, setContractGoal, g.id)} style={{ flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-body)', border: `1px solid ${contractGoal.includes(g.id) ? 'var(--marker-black)' : 'var(--marker-border)'}`, background: contractGoal.includes(g.id) ? 'var(--marker-black)' : 'var(--marker-cream-2)', color: contractGoal.includes(g.id) ? 'var(--marker-cream)' : 'var(--marker-text)' }}>{g.label}</button>
              ))}
            </div>

            <Label sub="Leave blank if the same as your main field">Contractor field</Label>
            <input value={contractorField} onChange={e => setContractorField(e.target.value)} placeholder="e.g. Product Management (if you contract in a different discipline)" style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', boxSizing: 'border-box' }} />
          </Section>
        )}

        {/* Reset / onboarding */}
        <div style={{ borderBottom: '1px solid var(--marker-border)', paddingBottom: 24, marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 14 }}>Reset</div>
          <button onClick={() => { if (window.confirm('Reset your onboarding settings? Your pipeline data will be preserved.')) window.location.href = '/api/dev/reset-onboard' }} style={{ display: 'inline-block', fontSize: 13, color: '#B91C1C', border: '1px solid #FCA5A5', padding: '8px 14px', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Re-run onboarding</button>
          <div style={{ fontSize: 11, color: 'var(--marker-mid)', marginTop: 6 }}>Clears your track selection and runs the onboarding flow again. Your pipeline data is preserved.</div>
        </div>

        {/* Data & Privacy */}
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 14 }}>Data & privacy</div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Export your data</div>
            <div style={{ fontSize: 12, color: 'var(--marker-mid)', marginBottom: 10 }}>Download everything Marker holds about you — your profile, CV text, and pipeline — as a JSON file.</div>
            <a href="/api/data-export" download style={{ display: 'inline-block', fontSize: 13, color: 'var(--marker-text)', border: '1px solid var(--marker-border)', padding: '8px 14px', borderRadius: 8, textDecoration: 'none', background: 'var(--marker-cream)' }}>Export data (JSON)</a>
          </div>

          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#991B1B', marginBottom: 6 }}>Delete account</div>
            <div style={{ fontSize: 12, color: '#7F1D1D', marginBottom: 12, lineHeight: 1.6 }}>Permanently deletes your account, profile, and all pipeline data. This cannot be undone. To confirm, type <strong>delete my account</strong> below.</div>
            <input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="delete my account"
              style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #FCA5A5', borderRadius: 8, background: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
            />
            {deleteError && <div style={{ fontSize: 11, color: '#B91C1C', marginBottom: 8 }}>{deleteError}</div>}
            <button
              onClick={deleteAccount}
              disabled={deleteConfirm !== 'delete my account' || deleting}
              style={{ background: deleteConfirm === 'delete my account' && !deleting ? '#B91C1C' : '#FCA5A5', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: deleteConfirm === 'delete my account' && !deleting ? 'pointer' : 'default' }}
            >
              {deleting ? 'Deleting…' : 'Delete my account'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
