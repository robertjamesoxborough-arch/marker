'use client'

import { useState, useEffect } from 'react'
import { SourceLabel } from '../shared'

// Wishlist Roles — pure cache reader over /api/job-feed. Genuinely
// distinct from Live Roles: Live Roles pulls from the wider market (Adzuna,
// multi-ATS); this only ever shows roles nightly-scraped from the career
// pages of companies on the user's OWN wishlist (cron/wishlist-scrape).
// Zero AI cost per view (cost rule 7 -- no live-scan exception at all here).
export default function WishlistJobsTab({ jobs: pipelineJobs, addJob }) {
  const [jobs,    setJobs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError(''); setMessage('')
    try {
      const res = await fetch('/api/job-feed', { method: 'POST' })
      const data = await res.json()
      if (data.error) { setError(data.error); setJobs([]) }
      else { setJobs(data.jobs || []); setMessage(data.message || '') }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const addedLinks = new Set(pipelineJobs.flatMap(j => [j.link, j.jobLink]).filter(Boolean))
  const addedJobCacheIds = new Set(pipelineJobs.map(j => j.jobCacheId).filter(Boolean))

  function addToPipeline(job) {
    addJob({
      id: crypto.randomUUID(), jobCacheId: job.id || null, company: job.company, roleTitle: job.title,
      jobLink: job.url, link: job.url, officeDays: 2, status: 'considering',
      ranking: 1, signal: '', signalReason: '', score: job.score || 0,
      scoreBreakdown: '', jd: '', source: 'wishlist_scrape', addedAt: new Date().toISOString(),
    })
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.5 }}>
        Roles found directly on the career pages of companies on your wishlist, checked every night. Different from Live Roles, which pulls from the wider job market: this only ever shows roles at companies you've specifically chosen.
      </div>

      {loading && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>LOADING…</div>}

      {error && (
        <div style={{ padding: '10px 12px', borderRadius: 8, background: '#FEE2E2', border: '1px solid #FCA5A5', fontSize: 12, color: '#B91C1C' }}>{error}</div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div style={{ padding: '32px 16px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', marginBottom: 8, letterSpacing: '0.04em' }}>NOTHING HERE YET</div>
          <div style={{ fontSize: 12, color: 'var(--marker-mid)', maxWidth: 340, margin: '0 auto', lineHeight: 1.5 }}>
            {message || "Add companies to your wishlist and we'll check their career pages nightly."}
          </div>
        </div>
      )}

      {jobs.map(job => (
        <div key={job.id} style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{job.company}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title || '–'}</div>
            {(job.location || job.salary) && (
              <div style={{ fontSize: 11, color: 'var(--marker-mid)', marginTop: 2 }}>{[job.location, job.salary].filter(Boolean).join(' · ')}</div>
            )}
            <div style={{ marginTop: 2 }}><SourceLabel job={job} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {job.score != null && (
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, background: 'var(--marker-lime)', color: 'var(--marker-black)', padding: '3px 9px', borderRadius: 6 }}>{job.score}</div>
            )}
            {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--marker-mid)', fontFamily: 'var(--font-body)' }}>View →</a>}
            <button onClick={() => addToPipeline(job)} disabled={addedJobCacheIds.has(job.id) || addedLinks.has(job.url)} className="btn btn-primary" style={{ fontSize: 11, padding: '6px 10px' }}>
              {addedJobCacheIds.has(job.id) || addedLinks.has(job.url) ? 'Added' : 'Add'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
