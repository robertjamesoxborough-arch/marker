'use client'

import { useState } from 'react'
import { COLUMNS, PasteJdCallout } from '../shared'

export default function EditJobModal({ job, onClose, onSave, onDelete }) {
  const [company, setCompany]   = useState(job.company || '')
  const [role, setRole]         = useState(job.roleTitle || '')
  const [jobLink, setJobLink]   = useState(job.jobLink || '')
  const [office, setOffice]     = useState(String(job.officeDays ?? 2))
  const [status, setStatus]     = useState(job.status || 'watchlist')
  const [notes, setNotes]       = useState(job.jd || '')

  function save() {
    if (!company.trim()) return
    onSave({ ...job, company: company.trim(), roleTitle: role.trim(), jobLink: jobLink.trim(), officeDays: parseFloat(office) || 2, status, jd: notes })
    onClose()
  }

  function remove() {
    if (!confirm(`Remove ${job.company || 'this role'}?`)) return
    onDelete(job.id)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, marginBottom: 20 }}>Edit role</div>
        {[
          { label: 'Company *', value: company, set: setCompany, placeholder: 'Monzo' },
          { label: 'Role title', value: role, set: setRole, placeholder: 'Head of Partnerships' },
          { label: 'Job link', value: jobLink, set: setJobLink, placeholder: 'https://...' },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>{f.label}</label>
            <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Office days / wk</label>
            <input type="number" min="0" max="5" step="0.5" value={office} onChange={e => setOffice(e.target.value)} style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Pipeline stage</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', boxSizing: 'border-box' }}>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <PasteJdCallout subtext="Scoring, CV tailoring and interview prep all read this: worth pasting the full thing, not just a summary." />
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={6} placeholder="Paste the full job description here…" style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
          <button onClick={remove} style={{ background: 'none', border: '1px solid #FCA5A5', color: '#B91C1C', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>Remove</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button onClick={save} className="btn btn-primary" disabled={!company.trim()}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
