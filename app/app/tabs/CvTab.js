'use client'

import { useState, useEffect } from 'react'
import ContractorCvPanel from './ContractorCvPanel'
import RecruiterPanel from './RecruiterPanel'
import DirectCvPanel from './DirectCvPanel'

export default function CvTab({ profile, jobs: allJobs, updateJob, prefill, onClearPrefill, onSwitchToEngine }) {
  const cvRaw = profile?.hard_filters_json?.cvRaw || ''
  const hfj   = profile?.hard_filters_json || {}
  const searchMode = hfj.searchMode || (hfj.openToContract === true ? 'both' : 'perm')
  const isContractorOnly = searchMode === 'contractor'
  const [section, setSection] = useState(isContractorOnly ? 'contractor_cv' : 'generate')

  // A pipeline card's "Tailor CV" button always means the primary AI Generate
  // path — jump there even if the user was last looking at another section.
  useEffect(() => { if (prefill && !isContractorOnly) setSection('generate') }, [prefill]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!cvRaw) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, padding: 32 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>NO PROFILE YET</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-black)', textAlign: 'center' }}>Build your profile first</div>
        <div style={{ fontSize: 13, color: 'var(--marker-mid)', textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}>
          Paste your CV in <strong>Settings › Your CV</strong> to unlock tailored CV prompts. Takes 30 seconds.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="/settings" style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', textDecoration: 'none', display: 'inline-block', fontWeight: 500 }}>Paste CV in Settings →</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Tab purpose header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--marker-border)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 3 }}>
          {isContractorOnly ? 'Contractor CV' : searchMode === 'both' ? 'CV tools' : 'Tailor your application'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6 }}>
          {isContractorOnly
            ? 'Generate a skills-based CV to send directly to recruiters, no specific JD needed. Designed for contractor market.'
            : 'Pick a role from your pipeline and generate a tailored CV or cover letter in seconds, matched to the JD, with a copy-paste option if you’d rather use your own Claude or ChatGPT.'}
        </div>
      </div>

      {/* Section toggle — AI Generate is the primary, default path; the old
          separate "Tailor CV" copy-paste tab is gone, folded into AI
          Generate as a one-click fallback (see the toggle inside it). */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 16px', borderBottom: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)' }}>
        {[
          ...(searchMode !== 'contractor' ? [{ id: 'generate', label: 'AI Generate' }, { id: 'cover', label: 'Cover Letter' }] : []),
          ...(searchMode !== 'perm' ? [{ id: 'contractor_cv', label: 'Contractor CV' }] : []),
          { id: 'recruiters', label: 'Recruiters' },
        ].map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${section === s.id ? 'var(--marker-black)' : 'var(--marker-border)'}`, background: section === s.id ? 'var(--marker-black)' : 'transparent', color: section === s.id ? 'var(--marker-cream)' : 'var(--marker-text)', fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
            {s.label}
          </button>
        ))}
      </div>

      {section === 'contractor_cv' && (
        <ContractorCvPanel profile={profile} />
      )}

      {section === 'recruiters' && (
        <RecruiterPanel profile={profile} mode={isContractorOnly ? 'contractor' : 'perm'} />
      )}

      {section === 'cover' && (
        <DirectCvPanel allJobs={allJobs} profile={profile} updateJob={updateJob} docType="cover" />
      )}
      {section === 'generate' && (
        <DirectCvPanel allJobs={allJobs} profile={profile} updateJob={updateJob} prefill={prefill} onClearPrefill={onClearPrefill}
          contractorAvailable={searchMode !== 'perm'} onSelectContractor={() => setSection('contractor_cv')} />
      )}
    </div>
  )
}
