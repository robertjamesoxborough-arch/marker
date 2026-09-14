'use client'

import { useState, useEffect } from 'react'
import { ProgressBar } from '../shared'

export default function RecruiterPanel({ profile, mode }) {
  const hfj = profile?.hard_filters_json || {}
  const isContractor = mode === 'contractor'
  const cacheKey = isContractor ? 'contractorRecruiters' : 'permRecruiters'
  const cacheAtKey = isContractor ? 'contractorRecruitersCachedAt' : 'permRecruitersCachedAt'
  const apiPath = isContractor ? '/api/contractor/recruiters' : '/api/perm/recruiters'
  const CACHE_MS = 7 * 24 * 60 * 60 * 1000

  const [recruiters, setRecruiters] = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [copied, setCopied]         = useState(null) // index of copied item
  const [allowance, setAllowance]   = useState(null) // { allowed, used, cap, tier }

  const wishlist = (hfj.wishlist || []).map(c => c.name.toLowerCase())
  const remaining = allowance && allowance.cap > 0 ? Math.max(0, allowance.cap - allowance.used) : null
  const atLimit   = allowance && allowance.cap > 0 && allowance.used >= allowance.cap

  async function loadAllowance() {
    try {
      const res = await fetch('/api/profile/recruiter-allowance')
      if (res.ok) setAllowance(await res.json())
    } catch {}
  }

  useEffect(() => {
    const cached   = hfj[cacheKey]
    const cachedAt = hfj[cacheAtKey]
    if (cached && cachedAt && Date.now() - new Date(cachedAt).getTime() < CACHE_MS) {
      setRecruiters(cached)
    }
    // Do NOT auto-generate: a recruiter search is a Sonnet + web_search call
    // (the most expensive in the product) that consumes the monthly allowance,
    // so it must always be an explicit user click, never a side effect of
    // opening the tab.
    loadAllowance()
  }, [])

  async function generate() {
    setLoading(true); setError('')
    try {
      const res = await fetch(apiPath, { method: 'POST' })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setRecruiters(data.recruiters || [])
    } catch { setError('Request failed. Try again.') }
    finally { setLoading(false); loadAllowance() }
  }

  function buildCvPrompt(r) {
    const cvRaw = hfj.cvRaw || hfj.careerSummary || ''
    const targetRoles = (profile?.target_roles || []).join(', ') || 'senior professional'
    const atsName = r.ats?.name || 'their ATS'
    const atsFormat = r.ats?.format || '.docx'
    const atsInstructions = r.ats?.instructions || 'single-column format, no tables or text boxes'
    return `Please create a CV optimised for submission to ${r.agency}. They use ${atsName}. Formatting requirements: ${atsInstructions}. Preferred format: ${atsFormat}.

My target roles: ${targetRoles}

My CV:
${cvRaw || '[No CV added yet. Go to Settings > Profile to add your CV.]'}

Please:
1. Reformat for ${atsName} compatibility: ${atsInstructions}
2. Ensure all skills, tools, and sector keywords appear as plain body text (not in tables or text boxes)
3. Job titles and seniority level should be prominent at the start of each role
4. Keep every job title, company, and date accurate. Do not invent anything.
5. Output as clean text I can paste into ${atsFormat} format

Make sure the CV is tailored to ${r.agency}'s typical clients: ${(r.companies || []).slice(0, 5).join(', ')}.`
  }

  function copyPrompt(r, idx) {
    navigator.clipboard.writeText(buildCvPrompt(r)).then(() => {
      setCopied(idx); setTimeout(() => setCopied(null), 2500)
    })
  }

  function getOverlap(r) {
    if (!r.companies || wishlist.length === 0) return []
    return r.companies.filter(c => wishlist.includes(c.toLowerCase()))
  }

  const priorityLabels = { 1: 'Priority 1', 2: 'Priority 2', 3: 'Priority 3' }
  const priorityColors = { 1: 'var(--marker-lime)', 2: '#F5E4A0', 3: 'var(--marker-cream)' }

  const byPriority = [1, 2, 3].map(p => ({
    priority: p,
    list: (recruiters || []).filter(r => (r.priority || 3) === p),
  })).filter(g => g.list.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--marker-border)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 4 }}>
          {isContractor ? 'Contract specialist agencies' : 'Recruiters worth working with'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.6 }}>
          {isContractor
            ? 'Agencies that regularly place senior contractors. Sorted by how relevant they are to your field. Set up alerts and add yourself to each database.'
            : 'Agencies and search firms for senior permanent roles. Register with Priority 1 first. Each card includes ATS tips and a ready-to-use CV prompt optimised for their system.'}
        </div>
        {recruiters && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>
              {remaining !== null ? `${remaining} of ${allowance.cap} searches left this month` : ''}
            </span>
            <button onClick={generate} disabled={atLimit} title={atLimit ? 'Monthly recruiter searches used up' : ''}
              style={{ background: 'none', border: '1px solid var(--marker-border)', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-mono)', cursor: atLimit ? 'not-allowed' : 'pointer', color: 'var(--marker-mid)', letterSpacing: '0.04em', opacity: atLimit ? 0.5 : 1 }}>↻ Refresh</button>
          </div>
        )}
      </div>

      {!recruiters && !loading && !error && (
        <div style={{ padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--marker-mid)', maxWidth: 340, lineHeight: 1.6 }}>
            Requite researches live UK agencies matched to your field and seniority, with ATS tips and a ready-to-use CV prompt for each. This runs a web search, so it counts against your monthly recruiter searches.
          </div>
          {allowance && allowance.cap === 0 ? (
            <>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>Recruiter search is a Pro or Max feature.</div>
              <a href="/pricing" className="btn btn-primary" style={{ fontSize: 13, fontWeight: 600 }}>Upgrade to unlock →</a>
            </>
          ) : (
            <>
              <button onClick={generate} className="btn btn-primary" style={{ fontSize: 14, fontWeight: 600 }}>Find my recruiters →</button>
              {remaining !== null && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>{remaining} of {allowance.cap} searches left this month</div>
              )}
            </>
          )}
        </div>
      )}

      {loading && (
        <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)' }}>
            {isContractor ? 'Finding specialist agencies…' : 'Researching recruiters for your field…'}
          </div>
          <ProgressBar duration={25}
            steps={['Searching for specialist agencies…', 'Checking ATS systems and company relationships…', 'Ranking by relevance to your profile…', 'Almost done…']}
            slowAt={40} slowMsg="Researching agency specialisms takes a moment; results will be specific to your field." />
        </div>
      )}

      {error && !loading && (
        <div style={{ margin: 16, background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#B91C1C' }}>
          {error} <button onClick={generate} style={{ background: 'none', border: 'none', color: '#B91C1C', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, padding: 0 }}>try again</button>
        </div>
      )}

      {recruiters && !loading && (
        <div style={{ padding: '12px 16px 80px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {byPriority.map(group => (
            <div key={group.priority}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: priorityColors[group.priority], border: '1px solid var(--marker-border)', padding: '3px 8px', borderRadius: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{priorityLabels[group.priority]}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {group.list.map((r, i) => {
                  const overlap = getOverlap(r)
                  const allCompanies = r.companies || []
                  const idx = (group.priority - 1) * 10 + i
                  return (
                    <div key={i} style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 12, overflow: 'hidden' }}>
                      {/* Agency header */}
                      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--marker-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--marker-black)', marginBottom: 3 }}>{r.agency}</div>
                            <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.5 }}>{r.specialisation}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                            {r.register && (
                              <a href={r.register} target="_blank" rel="noopener noreferrer"
                                style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, color: 'var(--marker-black)', background: 'var(--marker-lime)', border: 'none', padding: '6px 11px', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                                Register ↗
                              </a>
                            )}
                          </div>
                        </div>
                        {r.coverage && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 6px', borderRadius: 4, color: 'var(--marker-mid)' }}>{r.coverage}</span>
                        )}
                      </div>

                      {/* Insight */}
                      {r.insight && (
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--marker-border)', background: 'var(--marker-cream)' }}>
                          <div style={{ fontSize: 12, color: 'var(--marker-black)', lineHeight: 1.6 }}>{r.insight}</div>
                        </div>
                      )}

                      {/* ATS section */}
                      {r.ats && (
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--marker-border)', background: 'rgba(0,0,0,0.015)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-black)', color: 'var(--marker-cream)', padding: '2px 7px', borderRadius: 4, letterSpacing: '0.04em' }}>ATS</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-black)', fontWeight: 600 }}>{r.ats.name}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)' }}>{r.ats.format}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1.65 }}>{r.ats.instructions}</div>
                        </div>
                      )}

                      {/* Companies covered */}
                      {allCompanies.length > 0 && (
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--marker-border)' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 7 }}>
                            Companies they place at{overlap.length > 0 ? ` · ${overlap.length} match your shortlist` : ''}
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {allCompanies.slice(0, 12).map(co => {
                              const isMatch = wishlist.includes(co.toLowerCase())
                              return (
                                <span key={co} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: isMatch ? 'var(--marker-lime)' : 'var(--marker-cream)', border: `1px solid ${isMatch ? '#86EFAC' : 'var(--marker-border)'}`, padding: '2px 7px', borderRadius: 4, color: 'var(--marker-black)', fontWeight: isMatch ? 600 : 400 }}>
                                  {co}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* How to approach + CTA */}
                      <div style={{ padding: '10px 14px' }}>
                        {r.note && (
                          <div style={{ fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1.6, marginBottom: 10, borderLeft: '2px solid var(--marker-lime)', paddingLeft: 8 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 3, color: 'var(--marker-mid)' }}>How to approach</span>
                            {r.note}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button onClick={() => copyPrompt(r, idx)}
                            style={{ background: copied === idx ? 'var(--marker-lime)' : 'var(--marker-black)', color: copied === idx ? 'var(--marker-black)' : 'var(--marker-cream)', border: 'none', padding: '7px 13px', borderRadius: 7, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                            {copied === idx ? 'COPIED ✓' : '📋 Copy CV prompt'}
                          </button>
                          <a href="https://claude.ai" target="_blank" rel="noopener noreferrer"
                            style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, color: 'var(--marker-black)', background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '7px 13px', borderRadius: 7, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                            Open Claude ↗
                          </a>
                          {r.linkedin && (
                            <a href={r.linkedin} target="_blank" rel="noopener noreferrer"
                              style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--marker-mid)', background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '7px 13px', borderRadius: 7, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                              LinkedIn ↗
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <div className="legal-line">Agency and ATS information generated by AI. Verify details directly with each agency before submitting. Not affiliated with any agency listed.</div>
        </div>
      )}
    </div>
  )
}

