'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { track } from '@vercel/analytics'
import { getProfile, saveProfile } from '../../lib/db'
import { createClient } from '../../lib/supabase/client'

function Logo() {
  return (
    <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--marker-black)', display: 'inline-flex', alignItems: 'baseline', lineHeight: 1 }}>
      marker
      <span className="holo-dot" style={{ display: 'inline-block', width: '0.32em', height: '0.32em', borderRadius: '50%', marginLeft: '0.05em', position: 'relative', top: '-0.55em', flexShrink: 0 }} />
    </span>
  )
}

function OptionCard({ selected, onClick, title, sub }) {
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', textAlign: 'left', padding: '14px 16px',
      background: selected ? 'var(--marker-lime)' : 'var(--marker-cream-2)',
      border: `1px solid ${selected ? 'var(--marker-lime)' : 'var(--marker-border)'}`,
      borderRadius: 10, cursor: 'pointer', transition: 'all 0.1s',
    }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)' }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: selected ? '#3D3D00' : 'var(--marker-mid)', marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
    </button>
  )
}

function Chip({ label, selected, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', transition: 'all 0.1s',
      background: selected ? 'var(--marker-black)' : 'transparent',
      color: selected ? 'var(--marker-cream)' : 'var(--marker-text)',
      border: `1px solid ${selected ? 'var(--marker-black)' : 'var(--marker-border)'}`,
      fontFamily: 'var(--font-body)', fontWeight: selected ? 500 : 400,
    }}>
      {label}
    </button>
  )
}

function RecommendationBanner({ reason, children }) {
  return (
    <div style={{ marginBottom: 20, padding: '12px 14px', background: 'var(--marker-lime)', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', color: 'var(--marker-black)', opacity: 0.55, marginBottom: 5, textTransform: 'uppercase' }}>Marker suggests from your CV</div>
      <div style={{ fontSize: 13, color: 'var(--marker-black)', fontWeight: 500, lineHeight: 1.4, marginBottom: reason ? 5 : 0 }}>{children}</div>
      {reason && reason !== 'null' && <div style={{ fontSize: 12, color: 'var(--marker-black)', opacity: 0.65, lineHeight: 1.5 }}>{reason}</div>}
    </div>
  )
}

function Toggle({ on, onClick, label, sub }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 0', borderBottom: '1px solid var(--marker-border)' }}>
      <div style={{ flex: 1, paddingRight: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--marker-black)' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--marker-mid)', marginTop: 3, lineHeight: 1.5 }}>{sub}</div>}
      </div>
      <button onClick={onClick} style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
        background: on ? 'var(--marker-lime)' : 'var(--marker-border)', transition: 'background 0.15s', position: 'relative',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: on ? 22 : 2, width: 20, height: 20,
          borderRadius: '50%', background: 'var(--marker-black)', transition: 'left 0.15s',
        }} />
      </button>
    </div>
  )
}

// ── Data ──────────────────────────────────────────────────────────

const PROFESSIONAL_FIELDS = [
  'Software/IT', 'Data/Analytics', 'Product', 'Design/UX', 'Marketing',
  'Sales/BD', 'Partnerships', 'Operations', 'Finance/Accounting', 'HR/People',
  'Legal', 'Customer Success/Support', 'Engineering (non-software)',
  'Healthcare/Clinical', 'Education/Academia', 'Public sector/Policy',
  'Project/Programme Management', 'Consulting', 'Other',
]

const YEARS_EXPERIENCE = [
  { id: 'under2', label: 'Under 2 years' },
  { id: '2to5',   label: '2–5 years' },
  { id: '5to10',  label: '5–10 years' },
  { id: '10to15', label: '10–15 years' },
  { id: '15plus', label: '15+ years' },
]

const CONTRACT_TYPES = [
  { id: 'day_rate',  label: 'Day-rate contract' },
  { id: 'ftc',       label: 'Fixed-term contract (FTC)' },
  { id: 'interim',   label: 'Interim' },
  { id: 'freelance', label: 'Freelance / SOW' },
]

const STATUSES = [
  { id: 'employed_searching', title: 'Employed, actively searching' },
  { id: 'employed_passive',   title: 'Employed, passively open', sub: 'The Standby tier is built for you: weekly digest, no daily faff.' },
  { id: 'unemployed',         title: 'Unemployed' },
  { id: 'on_leave',           title: 'On leave', sub: 'Parental, sick, or otherwise.' },
  { id: 'student',            title: 'Student' },
  { id: 'returning',          title: 'Returning from a career break' },
]

const ROLE_FAMILIES = [
  // Marketing
  'Marketing Generalist', 'Product Marketing', 'Content Marketing', 'Brand & Comms',
  'Paid Media / Demand Gen', 'SEO / Organic', 'CRM / Lifecycle', 'Social Media',
  // Sales, BD & Partnerships
  'Partnerships', 'Business Development', 'Sales Generalist', 'Account Management',
  'Revenue / Sales Ops',
  // Product & Digital
  'Product Management', 'Digital Strategy', 'Programme Lead', 'Project Management',
  'Business Analysis', 'Strategy & Consulting',
  // Tech
  'Engineering', 'Data / Analytics', 'Design / UX', 'Product Design',
  // Operations & Finance
  'Operations Generalist', 'Finance Generalist', 'FP&A', 'Procurement',
  // People
  'HR Generalist', 'Talent Acquisition', 'People Ops', 'L&D',
  // Growth & CS
  'Growth', 'Customer Success', 'Community & Events',
  // Other
  'Legal', 'Comms / PR', 'Policy & Public Affairs',
]

const SENIORITIES = [
  { id: 'ic',             label: 'Individual Contributor', desc: 'No direct reports. Specialist, analyst, or coordinator level.' },
  { id: 'manager',        label: 'Manager',                desc: 'Leads a small team of 2–8 people, often still hands-on.' },
  { id: 'senior_manager', label: 'Senior Manager',         desc: 'Leads a larger team or owns a sub-function. Usually 8+ years.' },
  { id: 'head',           label: 'Head of',                desc: 'Owns an entire function and its budget. Reports into Director or C-suite.' },
  { id: 'director',       label: 'Director',               desc: 'Department lead with strategic and commercial accountability.' },
  { id: 'vp_plus',        label: 'VP / C-Suite',           desc: 'Executive or near-executive. Usually 15+ years.' },
]

function suggestSenioritiesFromTitle(title) {
  if (!title.trim()) return []
  const t = title.toLowerCase()
  if (t.includes('chief') || t.includes(' vp') || t.includes('vp ') || t.includes('vice president') || t.includes('managing director')) return ['vp_plus', 'director']
  if (t.includes('director')) return ['director', 'vp_plus', 'head']
  if (t.includes('head of') || t.includes('head,')) return ['head', 'director', 'senior_manager']
  if (t.includes('senior manager') || t.includes('sr. manager') || t.includes('sr manager')) return ['senior_manager', 'head']
  if (t.includes('manager') || t.includes('lead')) return ['manager', 'senior_manager']
  if (t.includes('analyst') || t.includes('executive') || t.includes('coordinator') || t.includes('associate')) return ['ic', 'manager']
  return []
}

const INDUSTRIES = [
  'Fintech', 'SaaS', 'Gaming', 'Martech', 'Retail Tech', 'Media',
  'EdTech', 'HealthTech', 'Public Sector', 'Charity / Non-profit',
  'Consumer Goods', 'Professional Services', 'Other',
]

const BENEFITS = [
  { id: 'enhanced_parental_leave', label: 'Enhanced parental leave' },
  { id: 'term_time',               label: 'Term-time working' },
  { id: 'four_day_week',           label: '4-day week' },
  { id: 'fully_remote',            label: 'Fully remote' },
  { id: 'hybrid',                  label: 'Hybrid' },
  { id: 'share_options',           label: 'Share options' },
  { id: 'private_health',          label: 'Private health' },
]

const RADIUS_OPTIONS = [
  { value: 10,   label: '10 mi' },
  { value: 25,   label: '25 mi' },
  { value: 50,   label: '50 mi' },
  { value: 100,  label: '100 mi' },
  { value: null, label: 'Anywhere' },
]

// ── Main page ─────────────────────────────────────────────────────

export default function OnboardPage() {
  const router = useRouter()
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [step, setStep]           = useState(1)
  const [userEmail, setUserEmail] = useState('')

  // Section A — Background
  const [field, setField]                           = useState('')
  const [customField, setCustomField]               = useState('')
  const [currentJobTitle, setCurrentJobTitle]       = useState('')
  const [yearsExperience, setYearsExperience]       = useState('')

  // Status
  const [status, setStatus] = useState(null)

  // CV + career summary
  const [cvText, setCvText]                         = useState('')
  const [careerSummary, setCareerSummary]           = useState('')
  const [cvParsing, setCvParsing]                   = useState(false)
  const [cvParseError, setCvParseError]             = useState('')
  const [cvSuggested, setCvSuggested]               = useState([])
  const [cvKeywords, setCvKeywords]                 = useState([])
  const [cvSuggestions, setCvSuggestions]           = useState(null)
  const [cvSupplement, setCvSupplement]             = useState('')

  // Profile
  const [targetRoles, setTargetRoles]               = useState([])
  const [customRole, setCustomRole]                 = useState('')
  const [seniorities, setSeniorities]               = useState([])
  const [industries, setIndustries]                 = useState([])
  const [customIndustry, setCustomIndustry]         = useState('')

  // Requirements
  const [postcode, setPostcode]                     = useState('')
  const [radiusMiles, setRadiusMiles]               = useState(null)
  const [maxOfficeDays, setMaxOfficeDays]           = useState(2)
  const [salaryFloor, setSalaryFloor]               = useState('')
  const [wlbPriority, setWlbPriority]               = useState('medium')
  const [excludeSalesQuotas, setExcludeSalesQuotas] = useState(false)
  const [benefits, setBenefits]                     = useState([])

  // Section C — Feature preferences
  const [wantsGov, setWantsGov]                     = useState(false)
  const [searchMode, setSearchMode]                 = useState('perm') // 'perm' | 'contractor' | 'both'
  const [wantsEasyLife, setWantsEasyLife]           = useState(false)
  const [wantsCvGen, setWantsCvGen]                 = useState(true)
  const [wantsInterviewPrep, setWantsInterviewPrep] = useState(true)

  // Section D — Contract details
  const [contractTypes, setContractTypes]           = useState([])
  const [ir35Willing, setIr35Willing]               = useState(null)
  const [contractGoal, setContractGoal]             = useState([])
  const [contractorField, setContractorField]       = useState('')

  const [saveError, setSaveError] = useState('')

  const openToContract = searchMode !== 'perm'
  const TOTAL = openToContract ? 6 : 5
  const isUK = !postcode.trim() || /^[A-Za-z]/.test(postcode.trim())

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserEmail(data.user?.email || ''))
    getProfile().then(p => {
      if (p?.track) router.replace('/app')
      else setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function toggleMulti(arr, setArr, id) {
    setArr(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function addCustomRole() {
    const r = customRole.trim()
    if (!r || targetRoles.includes(r)) return
    setTargetRoles(prev => [...prev, r])
    setCustomRole('')
  }

  function addCustomIndustry() {
    const ind = customIndustry.trim()
    if (!ind || industries.includes(ind)) return
    setIndustries(prev => [...prev, ind])
    setCustomIndustry('')
  }

  async function parseCv() {
    if (!cvText.trim() || cvParsing) return
    setCvParsing(true)
    setCvParseError('')
    try {
      const res = await fetch('/api/onboard/parse-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvText }),
      })
      const data = await res.json()
      const suggested = data.suggested || []
      const keywords  = data.keywords  || []
      const seniority = data.seniority || []
      const industrySuggestions = data.industries || []
      if (suggested.length === 0 && keywords.length === 0) {
        setCvParseError(data.error || 'No roles spotted. Continue and pick manually.')
      }
      setCvSuggested(suggested)
      setCvKeywords(keywords)
      setCvSuggestions(data)
      if (suggested.length > 0) setTargetRoles(prev => [...new Set([...prev, ...suggested])])
      if (seniority.length > 0) setSeniorities(prev => prev.length === 0 ? seniority : [...new Set([...prev, ...seniority])])
      if (industrySuggestions.length > 0) setIndustries(prev => prev.length === 0 ? industrySuggestions : [...new Set([...prev, ...industrySuggestions])])
      if (data.salaryHint && !salaryFloor) setSalaryFloor(String(data.salaryHint))
    } catch {
      setCvParseError('Request failed. Continue and pick roles manually.')
    } finally {
      setCvParsing(false)
    }
  }

  async function finish() {
    setSaving(true)
    setSaveError('')
    let refCode = null
    let taglineId = null
    try { refCode = localStorage.getItem('marker_ref') || null } catch {}
    try { taglineId = localStorage.getItem('marker_tagline_id') || null } catch {}

    // Derive legacy track field from feature preferences for backward compat
    const derivedTrack = wantsEasyLife ? 'balanced' : 'standard'
    const derivedTracks = ['standard', ...(wantsEasyLife ? ['balanced'] : [])]

    const cvRawFull = cvText.trim()
      ? cvText.trim() + (cvSupplement.trim() ? `\n\nAdditional context:\n${cvSupplement.trim()}` : '')
      : null

    // Use full CV if provided, fall back to career summary
    const cvContext = cvRawFull || (careerSummary.trim() ? `Professional summary:\n${careerSummary.trim()}` : null)

    try {
      await saveProfile({
        track: derivedTrack,
        tracks: derivedTracks,
        status,
        targetRoles,
        seniorities,
        industries,
        postcode,
        radiusMiles,
        maxOfficeDays,
        salaryFloor,
        excludeSalesQuotas,
        benefits,
        surfaces: {
          greenhouse: true,
          gov: wantsGov,
          balanced_roles: wantsEasyLife,
          returnships: false,
          parental_friendly: false,
        },
        cvRaw: cvContext,
        cvKeywords,
        refCode,
        isFirstSave: true,
        field: field === 'Other' ? (customField.trim() || 'Other') : field,
        yearsExperience,
        careerSummary: careerSummary.trim() || null,
        wlbPriority,
        wantsGov,
        searchMode,
        openToContract,
        wantsEasyLife,
        wantsCvGen,
        wantsInterviewPrep,
        contractTypes: openToContract ? contractTypes : [],
        ir35Willing: openToContract ? ir35Willing : null,
        contractGoal: openToContract ? (contractGoal.length > 0 ? contractGoal : null) : null,
        contractorField: openToContract ? (contractorField.trim() || null) : null,
      })
      if (taglineId) {
        fetch('/api/tagline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: parseInt(taglineId), field: 'conversion' }),
        }).catch(() => {})
      }
      // Populate structured career_history from the CV they just gave us.
      // Fire-and-forget: onboarding must never block or fail on this.
      if (cvRawFull) {
        fetch('/api/career-history/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cvText: cvRawFull }),
        }).catch(() => {})
      }
      track('onboard_complete', { field, track: derivedTrack })
      try {
        const ref = localStorage.getItem('marker_ref')
        if (ref) {
          fetch('/api/referral/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref }) }).catch(() => {})
          localStorage.removeItem('marker_ref')
        }
      } catch {}
      router.replace('/app')
    } catch (e) {
      setSaveError(e?.message || 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  const canContinue = [
    null,
    !!status,
    true,
    !!field && targetRoles.length > 0 && seniorities.length > 0,
    true,
    true,
    true,
  ][step]

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--marker-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>LOADING</div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'var(--marker-cream)', fontFamily: 'var(--font-body)', color: 'var(--marker-text)', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--marker-cream)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Logo />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {userEmail === 'robertjamesoxborough@gmail.com' && (
            <button
              onClick={() => {
                setField('Partnerships')
                setCurrentJobTitle('Director of Partnerships')
                setYearsExperience('10to15')
                setStatus('employed_searching')
                setTargetRoles(['Partnerships', 'Growth', 'Product Marketing'])
                setSeniorities(['head', 'director'])
                setIndustries(['Fintech', 'SaaS'])
                setPostcode('SW1A')
                setMaxOfficeDays(2)
                setStep(4)
              }}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', background: 'none', border: '1px solid var(--marker-border)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', letterSpacing: '0.04em' }}
            >
              DEV SKIP
            </button>
          )}
          <div className="holo-text" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', fontWeight: 600 }}>{step} of {TOTAL}</div>
        </div>
      </div>
      <div className="holo-hairline" style={{ position: 'sticky', top: '51px', zIndex: 10 }} />

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--marker-border)', position: 'relative' }}>
        <div className="holo-foil" style={{ height: '100%', width: `${(step / TOTAL) * 100}%`, transition: 'width 0.3s', borderRadius: '0 2px 2px 0' }} />
      </div>

      {/* Step content */}
      <div style={{ flex: 1, maxWidth: 540, width: '100%', margin: '0 auto', padding: '32px 20px 120px' }}>

        {/* STEP 1 — Status */}
        {step === 1 && (
          <div>
            <div className="kicker holo-text" style={{ marginBottom: 12 }}>Step 1</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8, lineHeight: 1.2 }}>Where are you right now?</h2>
            <p style={{ fontSize: 14, color: 'var(--marker-mid)', marginBottom: 24, lineHeight: 1.6 }}>Be honest: it's just us. This sets the urgency and tone of everything.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {STATUSES.map(s => (
                <OptionCard key={s.id} selected={status === s.id} onClick={() => setStatus(s.id)} title={s.title} sub={s.sub} />
              ))}
            </div>
          </div>
        )}

        {/* STEP 2 — CV (optional) */}
        {step === 2 && (
          <div>
            <div className="kicker holo-text" style={{ marginBottom: 12 }}>Step 2 · Optional</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8, lineHeight: 1.2 }}>Drop your CV in. We'll do the reading.</h2>
            <p style={{ fontSize: 14, color: 'var(--marker-mid)', marginBottom: 24, lineHeight: 1.6 }}>
              Paste your CV and we'll pre-fill your roles, seniority, and industries on the next step. No CV yet? Skip straight to the form below.
            </p>
            <textarea
              value={cvText}
              onChange={e => setCvText(e.target.value)}
              placeholder="Paste your CV here; plaintext is fine..."
              rows={10}
              style={{
                display: 'block', width: '100%', padding: '12px 14px', fontSize: 13, lineHeight: 1.6,
                border: '1px solid var(--marker-border)', borderRadius: 10, background: '#fff',
                color: 'var(--marker-text)', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                fontFamily: 'var(--font-body)',
              }}
            />
            <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={parseCv}
                disabled={!cvText.trim() || cvParsing || cvSuggested.length > 0}
                className={cvText.trim() && !cvParsing && cvSuggested.length === 0 ? 'holo-foil' : ''}
                style={{
                  padding: '10px 18px', fontSize: 13, fontWeight: 600, borderRadius: 10, border: 'none',
                  cursor: !cvText.trim() || cvParsing || cvSuggested.length > 0 ? 'not-allowed' : 'pointer',
                  background: cvSuggested.length > 0 ? 'var(--marker-lime)' : !cvText.trim() || cvParsing ? 'var(--marker-border)' : undefined,
                  color: 'var(--marker-black)', opacity: cvParsing ? 0.6 : 1,
                }}
              >
                {cvParsing ? 'Reading...' : cvSuggested.length > 0 ? 'Done ✓' : 'Read my CV'}
              </button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1.5 }}>
                {cvParsing ? 'Asking Claude...' : cvSuggested.length > 0 ? `Spotted ${cvSuggested.length} role ${cvSuggested.length === 1 ? 'family' : 'families'}, pre-selected next.` : 'Paste above then hit this.'}
              </span>
            </div>

            {cvParseError && <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 11, color: '#c0392b' }}>{cvParseError}</div>}

            {cvText.trim().length > 50 && (
              <div style={{ marginTop: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 4 }}>Anything missing from your CV?</label>
                <textarea
                  value={cvSupplement}
                  onChange={e => setCvSupplement(e.target.value)}
                  placeholder="e.g. Key skills not listed, recent wins, open to interim roles..."
                  rows={3}
                  style={{
                    display: 'block', width: '100%', padding: '10px 12px', fontSize: 13, lineHeight: 1.6,
                    border: '1px solid var(--marker-border)', borderRadius: 10, background: '#fff',
                    color: 'var(--marker-text)', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                    fontFamily: 'var(--font-body)',
                  }}
                />
              </div>
            )}

            {(cvSuggested.length > 0 || cvKeywords.length > 0) && (
              <div style={{ marginTop: 20, padding: 16, background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.08em', marginBottom: 10 }}>SPOTTED IN YOUR CV</div>
                {cvSuggested.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--marker-mid)', marginBottom: 6 }}>Role families, pre-selected on the next step:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {cvSuggested.map(r => <span key={r} className="chip chip-lime" style={{ fontSize: 11 }}>{r}</span>)}
                    </div>
                  </div>
                )}
                {cvKeywords.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--marker-mid)', marginBottom: 6 }}>Keywords we'll use to weight your results:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {cvKeywords.map(k => <span key={k} className="chip" style={{ fontSize: 11 }}>{k}</span>)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* No-CV fallback — shown when nothing pasted */}
            {!cvText.trim() && (
              <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--marker-border)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--marker-mid)', marginBottom: 14 }}>No CV yet? Fill this in instead</div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Current or most recent job title</label>
                  <input
                    value={currentJobTitle}
                    onChange={e => setCurrentJobTitle(e.target.value)}
                    placeholder="e.g. Head of Partnerships, Senior Data Analyst"
                    style={{ display: 'block', width: '100%', padding: '11px 14px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 10, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--marker-mid)', marginBottom: 10 }}>Years of experience</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {YEARS_EXPERIENCE.map(y => (
                      <button key={y.id} onClick={() => setYearsExperience(y.id)} style={{
                        padding: '9px 16px', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13,
                        border: `1px solid ${yearsExperience === y.id ? 'var(--marker-black)' : 'var(--marker-border)'}`,
                        background: yearsExperience === y.id ? 'var(--marker-black)' : 'var(--marker-cream-2)',
                        color: yearsExperience === y.id ? 'var(--marker-cream)' : 'var(--marker-text)',
                      }}>
                        {y.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Career summary <span style={{ fontWeight: 400, color: 'var(--marker-mid)' }}>(a few sentences)</span></label>
                  <textarea
                    value={careerSummary}
                    onChange={e => setCareerSummary(e.target.value)}
                    placeholder="e.g. 12 years in partnerships and growth, most recently Head of Partnerships at a fintech. Looking for a Director-level role in SaaS or media."
                    rows={5}
                    style={{
                      display: 'block', width: '100%', padding: '12px 14px', fontSize: 13, lineHeight: 1.7,
                      border: '1px solid var(--marker-border)', borderRadius: 10, background: '#fff',
                      color: 'var(--marker-text)', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                      fontFamily: 'var(--font-body)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3 — Profile */}
        {step === 3 && (
          <div>
            <div className="kicker holo-text" style={{ marginBottom: 12 }}>Step 3</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8, lineHeight: 1.2 }}>Your professional profile</h2>
            <p style={{ fontSize: 14, color: 'var(--marker-mid)', marginBottom: 28, lineHeight: 1.6 }}>Roles, level, sectors. We use all three to filter and score everything.</p>

            {/* Professional field */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--marker-mid)', marginBottom: 14 }}>What's your professional field?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PROFESSIONAL_FIELDS.map(f => (
                  <Chip key={f} label={f} selected={field === f} onClick={() => setField(f)} />
                ))}
              </div>
              {field === 'Other' && (
                <input
                  value={customField}
                  onChange={e => setCustomField(e.target.value)}
                  placeholder="Describe your field"
                  style={{ marginTop: 10, display: 'block', width: '100%', padding: '11px 14px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 10, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box' }}
                />
              )}
            </div>

            <div style={{ height: 1, background: 'var(--marker-border)', margin: '0 0 28px' }} />

            {/* Role families */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--marker-mid)', marginBottom: 14 }}>What kind of roles?</div>

              {cvSuggested.length > 0 && (
                <RecommendationBanner reason={cvSuggestions?.rolesReason}>
                  We spotted {cvSuggested.length} role {cvSuggested.length === 1 ? 'family' : 'families'} from your CV, pre-selected below. Add or remove anything.
                </RecommendationBanner>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {ROLE_FAMILIES.map(r => (
                  <Chip key={r} label={r} selected={targetRoles.includes(r)} onClick={() => toggleMulti(targetRoles, setTargetRoles, r)} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={customRole} onChange={e => setCustomRole(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomRole()}
                  placeholder="Not listed? Add your own"
                  style={{ flex: 1, padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box' }}
                />
                <button onClick={addCustomRole} className="btn btn-primary" style={{ flexShrink: 0, padding: '9px 14px', fontSize: 13 }}>Add</button>
              </div>
              {targetRoles.filter(r => !ROLE_FAMILIES.includes(r)).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {targetRoles.filter(r => !ROLE_FAMILIES.includes(r)).map(r => (
                    <span key={r} className="chip chip-lime" style={{ fontSize: 11 }}>
                      {r}
                      <button onClick={() => setTargetRoles(prev => prev.filter(x => x !== r))} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4, fontSize: 11, color: 'var(--marker-black)', padding: 0 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ height: 1, background: 'var(--marker-border)', margin: '24px 0' }} />

            {/* Seniority */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--marker-mid)', marginBottom: 8 }}>What level?</div>
              <p style={{ fontSize: 13, color: 'var(--marker-mid)', marginBottom: 14, lineHeight: 1.5 }}>Straddle two levels? Tick both. Hover for a description.</p>

              {cvSuggestions?.seniority?.length > 0 && (
                <RecommendationBanner reason={cvSuggestions.seniorityReason}>
                  Pre-selected: {cvSuggestions.seniority.map(id => SENIORITIES.find(s => s.id === id)?.label || id).join(' · ')}
                </RecommendationBanner>
              )}

              {!cvSuggested.length && (() => {
                const suggested = suggestSenioritiesFromTitle(currentJobTitle)
                if (!suggested.length) return null
                return (
                  <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--marker-lime)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, fontSize: 13, color: 'var(--marker-black)', lineHeight: 1.5 }}>
                    Based on that title: <strong>{suggested.map(id => SENIORITIES.find(s => s.id === id)?.label).join(', ')}</strong>
                    <button onClick={() => setSeniorities(prev => [...new Set([...prev, ...suggested])])} style={{ marginLeft: 10, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '3px 10px', borderRadius: 5, fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>Select these</button>
                  </div>
                )
              })()}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SENIORITIES.map(s => (
                  <button key={s.id} onClick={() => toggleMulti(seniorities, setSeniorities, s.id)} title={s.desc} style={{
                    padding: '8px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', transition: 'all 0.1s',
                    background: seniorities.includes(s.id) ? 'var(--marker-black)' : 'transparent',
                    color: seniorities.includes(s.id) ? 'var(--marker-cream)' : 'var(--marker-text)',
                    border: `1px solid ${seniorities.includes(s.id) ? 'var(--marker-black)' : 'var(--marker-border)'}`,
                    fontFamily: 'var(--font-body)', fontWeight: seniorities.includes(s.id) ? 500 : 400,
                  }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--marker-border)', margin: '24px 0' }} />

            {/* Industries */}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--marker-mid)', marginBottom: 14 }}>Which sectors?</div>

              {cvSuggestions?.industries?.length > 0 && (
                <RecommendationBanner reason={cvSuggestions.industriesReason}>
                  Pre-selected: {cvSuggestions.industries.join(' · ')}
                </RecommendationBanner>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {INDUSTRIES.map(ind => (
                  <Chip key={ind} label={ind} selected={industries.includes(ind)} onClick={() => toggleMulti(industries, setIndustries, ind)} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={customIndustry} onChange={e => setCustomIndustry(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomIndustry()}
                  placeholder="Not listed? Add your own"
                  style={{ flex: 1, padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box' }}
                />
                <button onClick={addCustomIndustry} className="btn btn-primary" style={{ flexShrink: 0, padding: '9px 14px', fontSize: 13 }}>Add</button>
              </div>
              {industries.filter(ind => !INDUSTRIES.includes(ind)).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {industries.filter(ind => !INDUSTRIES.includes(ind)).map(ind => (
                    <span key={ind} className="chip chip-lime" style={{ fontSize: 11 }}>
                      {ind}
                      <button onClick={() => setIndustries(prev => prev.filter(x => x !== ind))} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4, fontSize: 11, color: 'var(--marker-black)', padding: 0 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4 — Requirements */}
        {step === 4 && (
          <div>
            <div className="kicker holo-text" style={{ marginBottom: 12 }}>Step 4</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8, lineHeight: 1.2 }}>Your requirements</h2>
            <p style={{ fontSize: 14, color: 'var(--marker-mid)', marginBottom: 28, lineHeight: 1.6 }}>All optional. Skip straight through and adjust any time in Settings.</p>

            {cvSuggestions?.salaryHint && (
              <RecommendationBanner reason={cvSuggestions.salaryReason}>
                Suggested salary floor: £{cvSuggestions.salaryHint}k, based on your experience. Pre-filled below.
              </RecommendationBanner>
            )}

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 8 }}>Minimum salary</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number" value={salaryFloor} onChange={e => setSalaryFloor(e.target.value)}
                  placeholder="e.g. 80"
                  style={{ width: 100, padding: '12px 14px', fontSize: 15, border: '1px solid var(--marker-border)', borderRadius: 10, background: '#fff', color: 'var(--marker-text)', outline: 'none' }}
                />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--marker-mid)' }}>k / year</span>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 8 }}>Location</label>
              <input
                value={postcode} onChange={e => setPostcode(e.target.value)}
                placeholder="City, region, or postcode (e.g. Manchester, EC2A, Berlin)"
                style={{ display: 'block', width: '100%', padding: '12px 14px', fontSize: 15, border: '1px solid var(--marker-border)', borderRadius: 10, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {postcode.trim().length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 8 }}>Search radius</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {RADIUS_OPTIONS.map(r => (
                    <button key={String(r.value)} onClick={() => setRadiusMiles(r.value)} style={{
                      padding: '9px 16px', borderRadius: 10,
                      border: `1px solid ${radiusMiles === r.value ? 'var(--marker-black)' : 'var(--marker-border)'}`,
                      background: radiusMiles === r.value ? 'var(--marker-black)' : 'var(--marker-cream-2)',
                      color: radiusMiles === r.value ? 'var(--marker-cream)' : 'var(--marker-text)',
                      fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer',
                    }}>{r.label}</button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 8 }}>Max office days per week</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[0, 1, 2, 3, 4, 5].map(d => (
                  <button key={d} onClick={() => setMaxOfficeDays(d)} style={{
                    width: 48, height: 48, borderRadius: 10,
                    border: `1px solid ${maxOfficeDays === d ? 'var(--marker-black)' : 'var(--marker-border)'}`,
                    background: maxOfficeDays === d ? 'var(--marker-black)' : 'var(--marker-cream-2)',
                    color: maxOfficeDays === d ? 'var(--marker-cream)' : 'var(--marker-text)',
                    fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, cursor: 'pointer',
                  }}>{d === 5 ? '5+' : d}</button>
                ))}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', marginTop: 8 }}>
                {maxOfficeDays === 0 ? 'Fully remote only' : maxOfficeDays === 1 ? 'Remote-first (1d / wk)' : maxOfficeDays === 2 ? 'Hybrid (2d / wk)' : maxOfficeDays >= 5 ? 'Office fine' : `Up to ${maxOfficeDays} days / wk`}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 4 }}>Work-life balance priority</label>
              <div style={{ fontSize: 12, color: 'var(--marker-mid)', marginBottom: 10, lineHeight: 1.5 }}>How heavily should WLB factor into your match scores? High means roles with "always-on" or "fast-paced" signals score lower and get flagged.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'low',    label: 'Low',    desc: 'Pay and progression first. WLB noted, not a primary filter.' },
                  { id: 'medium', label: 'Medium', desc: 'Healthy balance matters. WLB balanced against other factors.' },
                  { id: 'high',   label: 'High',   desc: "WLB is a deal-breaker: startup \"hustle culture\" roles score lower" },
                ].map(w => (
                  <button key={w.id} onClick={() => setWlbPriority(w.id)} style={{
                    flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, textAlign: 'center',
                    border: `1px solid ${wlbPriority === w.id ? 'var(--marker-black)' : 'var(--marker-border)'}`,
                    background: wlbPriority === w.id ? 'var(--marker-black)' : 'var(--marker-cream-2)',
                    color: wlbPriority === w.id ? 'var(--marker-cream)' : 'var(--marker-text)',
                  }}>{w.label}</button>
                ))}
              </div>
              {wlbPriority && (
                <div style={{ fontSize: 12, color: 'var(--marker-mid)', marginTop: 8, lineHeight: 1.5 }}>
                  {wlbPriority === 'high' ? "WLB is a deal-breaker: startup \"hustle culture\" roles score lower" : wlbPriority === 'low' ? 'Pay and progression first. WLB noted, not a primary filter.' : 'Healthy balance matters. WLB balanced against other factors.'}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--marker-border)' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--marker-black)' }}>Exclude roles with sales quotas</div>
                <button onClick={() => setExcludeSalesQuotas(v => !v)} style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
                  background: excludeSalesQuotas ? 'var(--marker-lime)' : 'var(--marker-border)', transition: 'background 0.15s', position: 'relative',
                }}>
                  <span style={{ position: 'absolute', top: 2, left: excludeSalesQuotas ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: 'var(--marker-black)', transition: 'left 0.15s' }} />
                </button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 4 }}>Nice-to-have benefits</div>
              <div style={{ fontSize: 12, color: 'var(--marker-mid)', marginBottom: 10, lineHeight: 1.5 }}>We highlight roles that mention these, but we never hide roles that don't. Think of it as a bonus flag, not a filter.</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {BENEFITS.map(b => (
                  <Chip key={b.id} label={b.label} selected={benefits.includes(b.id)} onClick={() => toggleMulti(benefits, setBenefits, b.id)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 5 — Workspace */}
        {step === 5 && (
          <div>
            <div className="kicker holo-text" style={{ marginBottom: 12 }}>Step 5</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8, lineHeight: 1.2 }}>Customise your workspace</h2>
            <p style={{ fontSize: 14, color: 'var(--marker-mid)', marginBottom: 28, lineHeight: 1.6 }}>Switch on the features that are relevant to your hunt. You can change these any time in Settings.</p>

            <Toggle on={wantsGov} onClick={() => setWantsGov(v => !v)}
              label="Public sector / government roles"
              sub="Surfaces civil service, NHS, local authority, and other public sector roles in your feed" />
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 4 }}>What are you looking for?</div>
              <div style={{ fontSize: 12, color: 'var(--marker-mid)', marginBottom: 10, lineHeight: 1.5 }}>This sets which tools appear in your dashboard.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { id: 'perm',       label: 'Permanent roles only',       sub: 'Tailored CV prompts, interview prep, perm job feed' },
                  { id: 'contractor', label: 'Contract / interim only',     sub: 'Generic CV for recruiter blast, contractor role scanner, agency finder' },
                  { id: 'both',       label: 'Both (perm and contractor)',  sub: 'Full access to all tools. Most flexible option' },
                ].map(opt => (
                  <button key={opt.id} onClick={() => setSearchMode(opt.id)} style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font-body)', border: `1px solid ${searchMode === opt.id ? 'var(--marker-black)' : 'var(--marker-border)'}`, background: searchMode === opt.id ? 'var(--marker-black)' : 'var(--marker-cream-2)' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: searchMode === opt.id ? 'var(--marker-cream)' : 'var(--marker-text)', marginBottom: 2 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: searchMode === opt.id ? 'rgba(255,255,255,0.6)' : 'var(--marker-mid)', lineHeight: 1.4 }}>{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>
            <Toggle on={wantsEasyLife} onClick={() => setWantsEasyLife(v => !v)}
              label="Work-life balance employer suggestions"
              sub="Curated list of employers with strong WLB ratings: scores, leave, remote policy" />
            <Toggle on={wantsCvGen} onClick={() => setWantsCvGen(v => !v)}
              label="CV and cover letter generation"
              sub="Generate tailored CV prompts and cover letters for any pipeline role" />
            <Toggle on={wantsInterviewPrep} onClick={() => setWantsInterviewPrep(v => !v)}
              label="Interview preparation"
              sub="Full interview prep packs: company research, questions, and STAR stories" />

            {openToContract && (
              <div style={{ marginTop: 4, padding: '12px 14px', background: 'var(--marker-lime)', borderRadius: 10, fontSize: 13, color: 'var(--marker-black)', lineHeight: 1.5 }}>
                Contractor tools are on. The next step captures your contract preferences.
              </div>
            )}
          </div>
        )}

        {/* STEP 6 — Contract details (conditional) */}
        {step === 6 && (
          <div>
            <div className="kicker holo-text" style={{ marginBottom: 12 }}>Step 6</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8, lineHeight: 1.2 }}>Contract details</h2>
            <p style={{ fontSize: 14, color: 'var(--marker-mid)', marginBottom: 28, lineHeight: 1.6 }}>Helps us tune your Contractor Routes tab. All optional. Update any time in Settings.</p>

            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--marker-mid)', marginBottom: 12 }}>Which contract types?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {CONTRACT_TYPES.map(ct => (
                  <OptionCard key={ct.id} selected={contractTypes.includes(ct.id)} onClick={() => toggleMulti(contractTypes, setContractTypes, ct.id)} title={ct.label} />
                ))}
              </div>
            </div>

            {isUK && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--marker-mid)', marginBottom: 12 }}>IR35: able and willing to work outside IR35?</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ id: true, label: 'Yes, outside IR35' }, { id: false, label: 'Inside IR35 only' }, { id: null, label: 'Not sure / either' }].map(o => (
                    <button key={String(o.id)} onClick={() => setIr35Willing(o.id)} style={{
                      flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, textAlign: 'center',
                      border: `1px solid ${ir35Willing === o.id ? 'var(--marker-black)' : 'var(--marker-border)'}`,
                      background: ir35Willing === o.id ? 'var(--marker-black)' : 'var(--marker-cream-2)',
                      color: ir35Willing === o.id ? 'var(--marker-cream)' : 'var(--marker-text)',
                    }}>{o.label}</button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--marker-mid)', marginBottom: 12 }}>Contracting goal</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ id: 'contract', label: 'Pure contracting' }, { id: 'either', label: 'Contract or perm' }, { id: 'perm', label: 'Contract-to-perm' }].map(g => (
                  <button key={g.id} onClick={() => toggleMulti(contractGoal, setContractGoal, g.id)} style={{
                    flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, textAlign: 'center',
                    border: `1px solid ${contractGoal.includes(g.id) ? 'var(--marker-black)' : 'var(--marker-border)'}`,
                    background: contractGoal.includes(g.id) ? 'var(--marker-black)' : 'var(--marker-cream-2)',
                    color: contractGoal.includes(g.id) ? 'var(--marker-cream)' : 'var(--marker-text)',
                  }}>{g.label}</button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 4 }}>Contractor field (if different from {field || 'your main field'}</label>
              <div style={{ fontSize: 12, color: 'var(--marker-mid)', marginBottom: 8 }}>Some people contract in a different discipline. Leave blank if it's the same.</div>
              <input
                value={contractorField}
                onChange={e => setContractorField(e.target.value)}
                placeholder={`Leave blank if same as ${field || 'your main field'}`}
                style={{ display: 'block', width: '100%', padding: '11px 14px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 10, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        )}

      </div>

      {/* Sticky bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--marker-cream)', borderTop: '1px solid var(--marker-border)', padding: '14px 20px', zIndex: 10 }}>
        {saveError && (
          <div style={{ maxWidth: 540, margin: '0 auto 8px', fontSize: 12, color: '#c0392b', fontFamily: 'var(--font-mono)' }}>{saveError}</div>
        )}
        {step === 3 && !canContinue && (
          <div style={{ maxWidth: 540, margin: '0 auto 6px', fontSize: 11, color: '#B91C1C', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>Select your field, at least one role type, and your level to continue.</div>
        )}
        <div style={{ maxWidth: 540, margin: '0 auto', display: 'flex', gap: 10 }}>
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
              Back
            </button>
          )}
          {step < TOTAL ? (
            <button
              onClick={() => { if (!canContinue) return; track('onboard_step', { step: step + 1 }); setStep(s => s + 1) }}
              style={{
                flex: 2, padding: '13px 20px', borderRadius: 10, border: 'none',
                cursor: canContinue ? 'pointer' : 'not-allowed',
                background: canContinue ? 'var(--marker-black)' : 'var(--marker-border)',
                color: canContinue ? 'var(--marker-cream)' : 'var(--marker-mid)',
                fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 500, transition: 'all 0.1s',
              }}
            >
              {step === 2 && !cvText.trim() && !careerSummary.trim() ? 'Skip this step →' : 'Continue'}
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={saving}
              className={saving ? '' : 'holo-foil'}
              style={{
                flex: 2, padding: '13px 20px', borderRadius: 10, border: 'none',
                cursor: saving ? 'wait' : 'pointer',
                background: saving ? 'var(--marker-border)' : undefined,
                color: 'var(--marker-black)',
                fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600,
              }}
            >
              {saving ? 'Saving...' : "Let's go"}
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
