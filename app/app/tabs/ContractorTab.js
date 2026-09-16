'use client'

import { useState, useEffect } from 'react'
import { usePostedWithin, ProgressBar, STEPS_CT_ROLES, PostedWithinSelect, FreshScanButton, withinPostedWindow, WLB_DATA } from '../shared'
import RecruiterPanel from './RecruiterPanel'

export default function ContractorTab({ profile, jobs: pipelineJobs, addJob }) {
  const [subTab, setSubTab] = useState('roles')

  const [roles,       setRoles]       = useState(null)
  const [rolesLoading,setRolesLoading]= useState(false)
  const [rolesError,  setRolesError]  = useState('')
  const [addedRoles,  setAddedRoles]  = useState(new Set())

  const [recruiters,        setRecruiters]        = useState(null)
  const [recruitersLoading, setRecruitersLoading] = useState(false)
  const [recruitersError,   setRecruitersError]   = useState('')
  const [postedWithinDays,  setPostedWithinDays]   = usePostedWithin(14)

  const [companies,        setCompanies]        = useState(null)
  const [companiesLoading, setCompaniesLoading] = useState(false)
  const [companiesError,   setCompaniesError]   = useState('')
  const [companiesCachedAt,setCompaniesCachedAt]= useState(null)

  const CACHE_MS = 7 * 24 * 60 * 60 * 1000
  function isFresh(cachedAt) { return !!cachedAt && Date.now() - new Date(cachedAt).getTime() < CACHE_MS }

  // Auto-load both panels on first mount if no fresh cache
  useEffect(() => {
    const rolesCachedAt = profile?.hard_filters_json?.contractorRolesCachedAt
    if (isFresh(rolesCachedAt) && profile?.hard_filters_json?.contractorRoles) {
      setRoles(profile.hard_filters_json.contractorRoles)
    } else {
      scanRoles()
    }
    const recCachedAt = profile?.hard_filters_json?.contractorRecruitersCachedAt
    if (isFresh(recCachedAt) && profile?.hard_filters_json?.contractorRecruiters) {
      setRecruiters(profile.hard_filters_json.contractorRecruiters)
    } else {
      generateRecruiters()
    }
    loadCompanies(false)
  }, [])

  async function scanRoles() {
    setRolesLoading(true); setRolesError('')
    try {
      const res  = await fetch('/api/contractor/roles', { method: 'POST' })
      const data = await res.json()
      if (data.error) { setRolesError(data.error); return }
      setRoles(data.jobs || [])
    } catch { setRolesError('Request failed. Try again.') }
    finally { setRolesLoading(false) }
  }

  async function loadCompanies(fresh) {
    setCompaniesLoading(true); setCompaniesError('')
    try {
      const res  = await fetch('/api/contractor/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fresh: !!fresh }) })
      const data = await res.json()
      if (data.error) setCompaniesError(data.error)
      setCompanies(data.companies || [])
      setCompaniesCachedAt(data.cachedAt || null)
    } catch { setCompaniesError('Request failed. Try again.') }
    finally { setCompaniesLoading(false) }
  }

  async function generateRecruiters() {
    setRecruitersLoading(true); setRecruitersError('')
    try {
      const res  = await fetch('/api/contractor/recruiters', { method: 'POST' })
      const data = await res.json()
      if (data.error) { setRecruitersError(data.error); return }
      setRecruiters(data.recruiters || [])
    } catch { setRecruitersError('Request failed. Try again.') }
    finally { setRecruitersLoading(false) }
  }

  function addRoleToPipeline(job) {
    addJob({
      id: crypto.randomUUID(),
      company: job.company,
      roleTitle: job.title,
      jobLink: job.url,
      link: job.url,
      officeDays: 2,
      status: 'considering',
      ranking: 1,
      signal: job.signal || '',
      signalReason: job.reason || '',
      score: job.score || 0,
      scoreBreakdown: '',
      jd: '',
      source: 'contract_search',
      addedAt: new Date().toISOString(),
    })
    setAddedRoles(prev => new Set([...prev, job.id]))
  }

  const hfj           = profile?.hard_filters_json || {}
  const contractTypes = (hfj.contractTypes || ['interim']).join(' / ')
  const ir35          = hfj.ir35Willing || 'either'
  const ir35Label     = ir35 === 'outside' ? 'Outside IR35 preferred' : ir35 === 'inside' ? 'Inside IR35 OK' : 'Either IR35'

  const SUBTABS = [
    { id: 'roles',      label: 'Live Roles'  },
    { id: 'companies',  label: 'Target Companies' },
    { id: 'recruiters', label: 'Recruiters'  },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '18px 16px 0', borderBottom: '2px solid var(--marker-border)' }}>
        <div className="kicker holo-text" style={{ marginBottom: 6 }}>Contractor Routes</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 8 }}>Live contract roles. The right agencies.</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-lime)', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{contractTypes}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{ir35Label}</span>
        </div>
        <div style={{ display: 'flex', gap: 0 }}>
          {SUBTABS.map(s => (
            <button key={s.id} onClick={() => setSubTab(s.id)}
              style={{ background: 'none', border: 'none', borderBottom: subTab === s.id ? '2px solid var(--marker-black)' : '2px solid transparent', marginBottom: -2, padding: '10px 16px 8px', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: subTab === s.id ? 600 : 400, color: subTab === s.id ? 'var(--marker-black)' : 'var(--marker-mid)', cursor: 'pointer' }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'roles' && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rolesLoading && (
            <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)' }}>Scanning live contract roles…</div>
              <ProgressBar duration={35} steps={STEPS_CT_ROLES} slowAt={48} slowMsg="Scoring 40–60 roles takes a moment. Claude reads each one properly, not just the title." />
            </div>
          )}
          {rolesError && !rolesLoading && (
            <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#B91C1C' }}>
              {rolesError} <button onClick={scanRoles} style={{ background: 'none', border: 'none', color: '#B91C1C', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, padding: 0 }}>try again</button>
            </div>
          )}
          {roles && !rolesLoading && (() => {
            const filteredRoles = roles.filter(j => withinPostedWindow(j.foundAt || j.created, postedWithinDays))
            return (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{filteredRoles.length} of {roles.length} contract roles · scored</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <PostedWithinSelect days={postedWithinDays} onChange={setPostedWithinDays} />
                  <button onClick={scanRoles} style={{ background: 'none', border: '1px solid var(--marker-border)', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer', color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>↻ Rescan</button>
                  <FreshScanButton endpoints={['/api/contractor/roles']} onScanComplete={scanRoles} maxDaysOld={postedWithinDays} />
                </div>
              </div>
              {filteredRoles.length === 0 ? (
                <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.6, marginBottom: 10 }}>No matching contract roles found right now.</div>
                  <button onClick={scanRoles} style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '8px 16px', borderRadius: 7, fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>Try again</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredRoles.map(job => {
                    const isAdded   = addedRoles.has(job.id) || pipelineJobs.some(j => j.jobLink === job.url || j.link === job.url)
                    const scoreN    = parseFloat(job.score) || 0
                    const scoreBg   = scoreN >= 8 ? 'var(--marker-lime)' : scoreN >= 6 ? '#F5E4A0' : 'var(--marker-border)'
                    const wlbEntry  = WLB_DATA[(job.company || '').toLowerCase()]
                    return (
                      <div key={job.id} style={{ background: 'var(--marker-cream-2)', border: `1px solid ${job.signal === 'apply' ? '#86EFAC' : 'var(--marker-border)'}`, borderRadius: 10, padding: 12 }}>
                        {/* Title + dual scores */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.company}</div>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ background: scoreBg, fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, padding: '3px 9px', borderRadius: 6, color: 'var(--marker-black)' }}>{job.score || '–'}</div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--marker-mid)', letterSpacing: '0.04em', marginTop: 2 }}>JOB FIT</div>
                            </div>
                          </div>
                        </div>
                        {/* Tags */}
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                          {job.contractType && job.contractType !== 'Unknown' && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-lime)', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em' }}>{job.contractType}</span>
                          )}
                          {job.office && job.office !== 'Unknown' && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 6px', borderRadius: 4 }}>{job.office}</span>
                          )}
                          {job.salary && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 6px', borderRadius: 4 }}>{job.salary}</span>
                          )}
                          {job.location && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', padding: '2px 0' }}>{job.location}</span>
                          )}
                          {job.signal && job.signal !== 'maybe' && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: job.signal === 'apply' ? 'var(--marker-lime)' : '#FCA5A5', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{job.signal}</span>
                          )}
                        </div>
                        {job.reason && (
                          <div style={{ fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1.5, marginBottom: 8 }}>{job.reason}</div>
                        )}
                        {/* CTAs */}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', borderTop: '1px solid var(--marker-border)', paddingTop: 8 }}>
                          {job.url && (
                            <a href={job.url} target="_blank" rel="noopener noreferrer"
                              style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, color: 'var(--marker-black)', background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '6px 12px', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                              View JD ↗
                            </a>
                          )}
                          <button onClick={() => !isAdded && addRoleToPipeline(job)} disabled={isAdded}
                            style={{ background: isAdded ? 'var(--marker-lime)' : 'var(--marker-black)', color: isAdded ? 'var(--marker-black)' : 'var(--marker-cream)', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: isAdded ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                            {isAdded ? '✓ Added to pipeline' : 'Add to pipeline'}
                          </button>
                          {!isAdded && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>→ Considering</span>}
                        </div>
                      </div>
                    )
                  })}
                  <div className="legal-line" style={{ paddingTop: 4 }}>Contract roles from Adzuna. Scored by Claude for relevance to your profile. Not affiliated with employers listed.</div>
                </div>
              )}
            </>
            )
          })()}
        </div>
      )}

      {subTab === 'companies' && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.5 }}>
              UK companies that regularly use senior contractors and interims in your field, scored on contractor volume, conversion confidence and work-life balance.
            </div>
            <button onClick={() => loadCompanies(true)} disabled={companiesLoading} style={{ flexShrink: 0, background: 'transparent', border: '1px solid var(--marker-border)', color: 'var(--marker-mid)', padding: '7px 11px', borderRadius: 7, fontSize: 11, fontFamily: 'var(--font-mono)', cursor: companiesLoading ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
              {companiesLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {companiesCachedAt && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>LAST UPDATED {new Date(companiesCachedAt).toLocaleDateString()}</div>}
          {companiesError && <div style={{ padding: '10px 12px', borderRadius: 8, background: '#FEE2E2', border: '1px solid #FCA5A5', fontSize: 12, color: '#B91C1C' }}>{companiesError}</div>}
          {companiesLoading && !companies && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)' }}>LOADING…</div>}
          {companies && companies.length === 0 && !companiesLoading && (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)' }}>
              No list yet. Hit Refresh to generate one from your profile.
            </div>
          )}
          {(companies || []).map((c, i) => (
            <div key={i} style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)' }}>{c.company}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>TIER {c.tier}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--marker-mid)', marginTop: 2 }}>{c.sector}</div>
                {c.why && <div style={{ fontSize: 12, color: 'var(--marker-text)', marginTop: 4, lineHeight: 1.4 }}>{c.why}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                {c.careersUrl && <a href={c.careersUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--marker-mid)', fontFamily: 'var(--font-body)' }}>Careers →</a>}
              </div>
            </div>
          ))}
        </div>
      )}

      {subTab === 'recruiters' && (
        <RecruiterPanel profile={profile} mode="contractor" />
      )}

    </div>
  )
}
