'use client'

import { useState, useEffect, useRef } from 'react'
import { track } from '@vercel/analytics'
import { hashText } from '../../../lib/text-hash'
import { ProgressBar, WISHLIST_SEEDS, WLB_DATA } from '../shared'

export default function WishlistTab({ profile, jobs: pipelineJobs, addJob }) {
  const [wishlist,        setWishlist]        = useState(null)   // null = not loaded yet
  const [results,         setResults]         = useState({})
  const [showAdd,         setShowAdd]         = useState(false)
  const [addInput,        setAddInput]        = useState('')
  const [expanded,        setExpanded]        = useState({})
  const [generating,      setGenerating]      = useState(false)
  const [suggestions,     setSuggestions]     = useState(null)
  const [generateError,   setGenerateError]   = useState('')
  const [autoGenPending,  setAutoGenPending]  = useState(false)
  const hasChecked = useRef(false)

  const cvRaw = profile?.hard_filters_json?.cvRaw || ''
  const hasCV = !!(cvRaw.length > 100)
  const cvSignature = hasCV ? hashText(cvRaw) : null

  // Last-resort-only fallback, used solely when AI generation is unavailable
  // (no CV/summary yet, or generation genuinely failed). Never merged on top
  // of a correct AI result — see PROGRESS.md CV-personalisation fixes.
  function seedFallback(reason) {
    const tracks = profile?.hard_filters_json?.tracks?.length
      ? profile.hard_filters_json.tracks
      : profile?.track ? [profile.track] : ['standard']
    const seen = new Set()
    const seeds = []
    tracks.forEach(t => {
      ;(WISHLIST_SEEDS[t] || []).forEach(s => {
        if (!seen.has(s.company)) { seen.add(s.company); seeds.push({ name: s.company, sector: s.sector, note: s.note }) }
      })
    })
    track('wishlist_fallback_seeds', { reason, tracks: tracks.join(',') })
    return seeds
  }

  // Load wishlist once on mount — auto-generate from THIS CV whenever the
  // account has no wishlist yet, or its wishlist was generated from a CV
  // that has since changed (server-side signature, not a per-browser flag —
  // a browser-only flag never re-fired after a CV replacement, which is why
  // a stale target-company list could survive a totally new CV upload).
  useEffect(() => {
    const saved = profile?.hard_filters_json?.wishlist
    const savedSignature = profile?.hard_filters_json?.wishlistCvSignature || null
    const staleForThisCv = hasCV && savedSignature !== cvSignature
    if (saved && saved.length > 0 && !staleForThisCv) {
      setWishlist(saved)
      return
    }
    if (hasCV) {
      setWishlist([])
      setAutoGenPending(true)
      return
    }
    setWishlist(seedFallback('no_cv'))
  }, [])

  // Trigger auto-generate once wishlist is set to empty and pending flag is set
  useEffect(() => {
    if (!autoGenPending) return
    setAutoGenPending(false)
    generateWishlist(true)
  }, [autoGenPending])

  // Run Greenhouse check once when wishlist is first populated
  useEffect(() => {
    if (!wishlist || hasChecked.current) return
    hasChecked.current = true
    if (wishlist.length === 0) return
    const initial = {}
    wishlist.forEach(c => { initial[c.name] = { status: 'loading', jobs: [] } })
    setResults(initial)
    fetch('/api/wishlist/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companies: wishlist.map(c => ({ name: c.name, slug: c.slug })) }),
    })
      .then(r => r.json())
      .then(data => {
        const map = {}
        ;(data.results || []).forEach(r => { map[r.name] = r })
        setResults(map)
      })
      .catch(() => {
        const err = {}
        wishlist.forEach(c => { err[c.name] = { status: 'no_board', jobs: [], careersUrl: `https://www.google.com/search?q=${encodeURIComponent(c.name + ' jobs')}` } })
        setResults(err)
      })
  }, [wishlist])

  function persistWishlist(newList, signature) {
    fetch('/api/wishlist/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wishlist: newList, cvSignature: signature !== undefined ? signature : cvSignature }),
    }).catch(() => {})
  }

  function removeCompany(name) {
    const next = (wishlist || []).filter(c => c.name !== name)
    setWishlist(next)
    setResults(prev => { const n = { ...prev }; delete n[name]; return n })
    persistWishlist(next)
  }

  function addCompany() {
    const name = addInput.trim()
    if (!name || (wishlist || []).find(c => c.name.toLowerCase() === name.toLowerCase())) {
      setAddInput(''); setShowAdd(false); return
    }
    const entry   = { name, sector: '', note: '', addedAt: new Date().toISOString() }
    const newList = [...(wishlist || []), entry]
    setWishlist(newList)
    setResults(prev => ({ ...prev, [name]: { status: 'loading', jobs: [] } }))
    setAddInput(''); setShowAdd(false)
    persistWishlist(newList)
    // Check only the new company
    fetch('/api/wishlist/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companies: [{ name }] }),
    })
      .then(r => r.json())
      .then(data => {
        const r = data.results?.[0]
        if (r) setResults(prev => ({ ...prev, [name]: r }))
      })
      .catch(() => {
        setResults(prev => ({ ...prev, [name]: { status: 'no_board', jobs: [], careersUrl: `https://www.google.com/search?q=${encodeURIComponent(name + ' jobs')}` } }))
      })
  }

  function addJobToPipeline(job, companyName) {
    addJob({
      id: crypto.randomUUID(),
      company: companyName,
      roleTitle: job.title,
      jobLink: job.url,
      link: job.url,
      officeDays: 2,
      status: 'considering',
      ranking: 1, signal: '', signalReason: '', score: 0, scoreBreakdown: '', jd: '',
      addedAt: new Date().toISOString(),
    })
    if (job.url) {
      fetch('/api/dismiss', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: job.url, company: companyName, roleTitle: job.title }) }).catch(() => {})
    }
  }

  async function generateWishlist(autoAdd = false) {
    if (generating) return
    setGenerating(true); setGenerateError(''); setSuggestions(null)
    try {
      const res = await fetch('/api/wishlist/generate', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) {
        setGenerateError(data.error || 'Generation failed')
        // Fall back to seeds only when AI generation genuinely failed — logged, never silent.
        if (autoAdd) setWishlist(seedFallback('generation_failed'))
        return
      }
      const suggs = data.suggestions || []
      if (autoAdd && suggs.length > 0) {
        const newList = suggs.map(s => ({ name: s.company, sector: s.sector || '', note: s.why || '', addedAt: new Date().toISOString() }))
        hasChecked.current = false
        setWishlist(newList)
        persistWishlist(newList, cvSignature)
      } else {
        setSuggestions(suggs)
      }
    } catch {
      setGenerateError('Request failed. Try again.')
      if (autoAdd) setWishlist(seedFallback('generation_request_error'))
    } finally {
      setGenerating(false)
    }
  }

  function addSuggestion(s) {
    const name = s.company
    if ((wishlist || []).find(c => c.name.toLowerCase() === name.toLowerCase())) {
      setSuggestions(prev => prev.filter(x => x.company !== s.company))
      return
    }
    const entry   = { name, sector: s.sector || '', note: s.why || '', addedAt: new Date().toISOString() }
    const newList = [...(wishlist || []), entry]
    setWishlist(newList)
    setResults(prev => ({ ...prev, [name]: { status: 'loading', jobs: [] } }))
    setSuggestions(prev => prev.filter(x => x.company !== s.company))
    persistWishlist(newList)
    fetch('/api/wishlist/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companies: [{ name }] }) })
      .then(r => r.json())
      .then(data => { const r = data.results?.[0]; if (r) setResults(prev => ({ ...prev, [name]: r })) })
      .catch(() => setResults(prev => ({ ...prev, [name]: { status: 'no_board', jobs: [], careersUrl: `https://www.google.com/search?q=${encodeURIComponent(name + ' jobs')}` } })))
  }

  const addedLinks   = new Set(pipelineJobs.flatMap(j => [j.link, j.jobLink]).filter(Boolean))
  const list         = wishlist || []
  const withRoles    = list.filter(c => results[c.name]?.status === 'has_roles').length
  const totalChecked = list.filter(c => results[c.name]?.status && results[c.name].status !== 'loading').length
  const allLoading   = list.length > 0 && totalChecked === 0

  // Bug 1 fix: sort by rank ASC, then staleness (oldest/never-checked first)
  const sorted = [...list].sort((a, b) => {
    const rankA = parseFloat(a.rank) || 2
    const rankB = parseFloat(b.rank) || 2
    if (rankA !== rankB) return rankA - rankB
    const ageA = a.addedAt ? new Date(a.addedAt).getTime() : 0
    const ageB = b.addedAt ? new Date(b.addedAt).getTime() : 0
    return ageA - ageB
  })

  const hiringNow = sorted.filter(c => results[c.name]?.status === 'has_roles')
  const onRadar   = sorted.filter(c => results[c.name]?.status !== 'has_roles')

  function renderWishlistCard(co) {
    const result   = results[co.name] || { status: 'loading', jobs: [] }
    const { status, jobs: roleJobs = [], careersUrl } = result
    const isExp    = !!expanded[co.name]
    const hasRoles = status === 'has_roles'
    const loading  = status === 'loading'
    return (
      <div key={co.name} style={{ background: 'var(--marker-cream-2)', border: `1px solid ${hasRoles ? '#86EFAC' : 'var(--marker-border)'}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.4s' }}>
        <div style={{ padding: '12px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--marker-black)' }}>{co.name}</div>
              {co.sector && <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--marker-mid)', flexShrink: 0 }}>{co.sector}</span>}
            </div>
            {(() => {
              const wlb = WLB_DATA[co.name.toLowerCase()]
              if (!wlb) return null
              const offDays = parseInt(wlb.office)
              const offText = offDays === 0 ? 'Fully remote' : `${offDays}d/wk office`
              return (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 7px', borderRadius: 4, color: 'var(--marker-mid)', flexShrink: 0 }}>{wlb.leave} leave</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 7px', borderRadius: 4, color: 'var(--marker-mid)', flexShrink: 0 }}>{offText}</span>
                </div>
              )
            })()}
            {co.note && !WLB_DATA[co.name.toLowerCase()] && <div style={{ fontSize: 11, color: 'var(--marker-mid)', marginBottom: 4, lineHeight: 1.4 }}>{co.note}</div>}
            {loading && <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><div className="anim-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--marker-border)', flexShrink: 0 }} /><span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--marker-mid)' }}>Checking…</span></div>}
            {status === 'has_roles' && <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} /><span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#15803D', fontWeight: 500 }}>{roleJobs.length} matching role{roleJobs.length !== 1 ? 's' : ''} open now</span></div>}
            {status === 'no_roles' && <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--marker-border)', flexShrink: 0 }} /><span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--marker-mid)' }}>No matching roles right now{result.totalOnBoard ? `. ${result.totalOnBoard} others on their board.` : ''}</span></div>}
            {status === 'no_board' && <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}><div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--marker-border)', flexShrink: 0 }} /><a href={careersUrl || '#'} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--marker-black)', fontWeight: 500 }}>Search careers ↗</a></div>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
            {hasRoles && <button onClick={() => setExpanded(prev => ({ ...prev, [co.name]: !prev[co.name] }))} style={{ background: isExp ? 'var(--marker-black)' : 'var(--marker-lime)', border: 'none', padding: '6px 11px', borderRadius: 7, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em', color: isExp ? 'var(--marker-cream)' : 'var(--marker-black)' }}>{isExp ? 'HIDE' : `VIEW ${roleJobs.length}`}</button>}
            {!hasRoles && !loading && careersUrl && (
              <a href={careersUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', padding: '5px 9px', border: '1px solid var(--marker-border)', borderRadius: 6, textDecoration: 'none', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                JOBS ↗
              </a>
            )}
            <button onClick={() => removeCompany(co.name)} title="Remove" style={{ background: 'transparent', border: '1px solid var(--marker-border)', color: 'var(--marker-mid)', width: 28, height: 28, borderRadius: 7, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
          </div>
        </div>
        {isExp && hasRoles && (
          <div style={{ borderTop: '1px solid var(--marker-border)' }}>
            {roleJobs.map((job, i) => {
              const isAdded = addedLinks.has(job.url)
              return (
                <div key={i} style={{ padding: '10px 12px', borderBottom: i < roleJobs.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</div>
                    {job.location && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', marginTop: 2 }}>{job.location}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', padding: '4px 8px', border: '1px solid var(--marker-border)', borderRadius: 5, textDecoration: 'none' }}>View ↗</a>
                    <button onClick={() => !isAdded && addJobToPipeline(job, co.name)} disabled={isAdded} style={{ background: isAdded ? 'var(--marker-border)' : 'var(--marker-black)', color: isAdded ? 'var(--marker-mid)' : 'var(--marker-cream)', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: isAdded ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>{isAdded ? 'Added ✓' : '+ Pipeline'}</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const trackCtx = {
    balanced:       'WLB-first employers: hybrid working, strong leave policies, and low-stress cultures',
    parent:         'Family-friendly employers: enhanced parental leave, phased returns, fertility support',
    returner:       'Active returnship programmes: structured paid re-entry for career returners',
    career_changer: 'Open to non-traditional backgrounds: skills-first hiring and internal pathway programmes',
    standard:       'Top UK employers across tech, fintech, media, and professional services',
  }
  const activeTrack = profile?.track || 'standard'
  const trackLine = trackCtx[activeTrack]

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--marker-border)' }}>
        {/* Track context */}
        {trackLine && list.length > 0 && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
            {activeTrack} track · {trackLine}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: showAdd ? 12 : 0 }}>
          <div style={{ fontSize: 12, color: 'var(--marker-mid)' }}>
            {allLoading
              ? 'Checking career pages…'
              : list.length === 0
              ? 'Add a company below to start tracking'
              : withRoles > 0
              ? `${withRoles} open now · ${list.length - withRoles} on radar · live data`
              : `${list.length} companies tracked · checking for openings…`}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {hasCV && (
              <button onClick={generateWishlist} disabled={generating}
                style={{ background: generating ? 'var(--marker-border)' : 'var(--marker-black)', color: generating ? 'var(--marker-mid)' : 'var(--marker-cream)', border: 'none', padding: '8px 12px', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: generating ? 'default' : 'pointer', letterSpacing: '0.04em', flexShrink: 0 }}>
                {generating ? 'GENERATING…' : 'AI SUGGEST'}
              </button>
            )}
            <button
              onClick={() => setShowAdd(v => !v)}
              style={{ background: showAdd ? 'var(--marker-border)' : 'var(--marker-black)', color: showAdd ? 'var(--marker-mid)' : 'var(--marker-cream)', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
              {showAdd ? 'Cancel' : '+ Add'}
            </button>
          </div>
        </div>

        {generating && list.length > 0 && (
          <div style={{ padding: '12px 0 4px' }}>
            <ProgressBar duration={20} steps={['Scanning your CV for relevant sectors…', 'Matching to companies that hire your profile…', 'Ranking by fit and hiring activity…', 'Adding the finishing touches…', 'Nearly there…']} slowAt={45} slowMsg="Reading your CV takes a moment; suggestions will be specific to you, not generic." />
          </div>
        )}

        {showAdd && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={addInput}
              onChange={e => setAddInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCompany(); if (e.key === 'Escape') { setShowAdd(false); setAddInput('') } }}
              placeholder="Company name (e.g. Revolut, Adyen, Monzo…)"
              autoFocus
              style={{ flex: 1, padding: '9px 13px', fontSize: 13, border: '1px solid var(--marker-black)', borderRadius: 8, background: '#fff', outline: 'none', fontFamily: 'var(--font-body)', color: 'var(--marker-text)' }}
            />
            <button
              onClick={addCompany}
              style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '9px 16px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}
            >Add</button>
          </div>
        )}
      </div>

      {/* Company cards */}
      <div style={{ padding: '10px 16px 80px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {list.length === 0 && !suggestions && (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            {generating ? (
              <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em', marginBottom: 16 }}>BUILDING YOUR TARGET LIST…</div>
                <ProgressBar duration={20} steps={['Reading your CV…', 'Matching to UK employers…', 'Ranking by fit and hiring activity…', 'Nearly ready…']} slowAt={45} slowMsg="Taking your profile into account; companies will be specific to you." />
              </>
            ) : (
              <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em', marginBottom: 12 }}>NO COMPANIES YET</div>
                {hasCV
                  ? <button onClick={() => generateWishlist(false)} disabled={generating}
                      style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '10px 18px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em', display: 'block', margin: '0 auto 10px' }}>
                      Generate from my CV →
                    </button>
                  : <div style={{ fontSize: 13, color: 'var(--marker-mid)', marginBottom: 10 }}>Add your CV in the CV tab to get AI-personalised suggestions</div>
                }
                <button onClick={() => setShowAdd(true)} className="btn btn-ghost" style={{ fontSize: 13 }}>Or add manually</button>
              </>
            )}
          </div>
        )}

        {/* ── Hiring now section ── */}
        {list.length > 0 && !allLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: hiringNow.length > 0 ? '#22C55E' : 'var(--marker-border)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.01em' }}>
              {hiringNow.length > 0 ? `${hiringNow.length} hiring now` : 'None hiring right now'}
            </span>
          </div>
        )}
        {list.length > 0 && !allLoading && hiringNow.length === 0 && (
          <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--marker-text-soft)', lineHeight: 1.6, maxWidth: 320, margin: '0 auto' }}>
              None of your tracked companies have open roles right now. Check back tomorrow, or add more companies to broaden your radar.
            </div>
            {!hasCV && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--marker-mid)' }}>Add your CV in Settings to unlock AI-suggested companies tailored to your background.</div>
            )}
          </div>
        )}
        {hiringNow.map(co => renderWishlistCard(co))}

        {/* ── On your radar section ── */}
        {list.length > 0 && onRadar.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: hiringNow.length > 0 ? 8 : 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--marker-border)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-mid)', letterSpacing: '-0.01em' }}>On your radar ({onRadar.length})</span>
          </div>
        )}

        {onRadar.map(co => renderWishlistCard(co))}

        {/* AI suggestions */}

        {/* AI suggestions */}
        {generateError && (
          <div style={{ fontSize: 12, color: '#B91C1C', padding: '12px 14px', background: '#FEE2E2', borderRadius: 10 }}>{generateError}</div>
        )}
        {suggestions && suggestions.length > 0 && (
          <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 12, overflow: 'hidden', animation: 'fadeSlideIn 0.3s ease' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--marker-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>AI suggestions: based on your CV</div>
              <button onClick={() => setSuggestions(null)} style={{ background: 'none', border: 'none', color: 'var(--marker-mid)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
            </div>
            {suggestions.map((s, i) => (
              <div key={s.company} style={{ padding: '10px 14px', borderBottom: i < suggestions.length - 1 ? '1px solid var(--marker-border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--marker-black)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.company}</span>
                    {s.sector && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '1px 6px', borderRadius: 4, color: 'var(--marker-mid)' }}>{s.sector}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.5 }}>{s.why}</div>
                </div>
                <button onClick={() => addSuggestion(s)}
                  style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '6px 11px', borderRadius: 7, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em', flexShrink: 0 }}>
                  + ADD
                </button>
              </div>
            ))}
          </div>
        )}
        {suggestions && suggestions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)' }}>All suggestions added.</div>
        )}

        {list.length > 0 && (
          <div className="legal-line" style={{ paddingTop: 4 }}>
            Live data from public jobs boards. Not all companies post publicly; use "Search careers" to check the ones that don't. Refreshed on every visit.
          </div>
        )}
      </div>
    </div>
  )
}


