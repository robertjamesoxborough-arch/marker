'use client'

import { useState } from 'react'
import { COLUMNS } from '../shared'

export default function AddJobModal({ onClose, onAdd }) {
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [jobLink, setJobLink] = useState('')
  const [office, setOffice] = useState('2')
  const [status, setStatus] = useState('considering')

  function submit() {
    if (!company.trim()) return
    onAdd({ id: crypto.randomUUID(), company: company.trim(), roleTitle: role.trim(), jobLink: jobLink.trim(), officeDays: parseFloat(office) || 2, status, ranking: 1, signal: '', signalReason: '', score: 0, scoreBreakdown: '', jd: '', link: '', addedAt: new Date().toISOString() })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 440 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, marginBottom: 20 }}>Add role</div>
        {[
          { label: 'Company', value: company, set: setCompany, placeholder: 'Monzo', required: true },
          { label: 'Role title', value: role, set: setRole, placeholder: 'Staff Product Manager' },
          { label: 'Job link', value: jobLink, set: setJobLink, placeholder: 'https://...' },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>{f.label}{f.required && ' *'}</label>
            <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Office days / wk</label>
            <input type="number" min="0" max="5" step="0.5" value={office} onChange={e => setOffice(e.target.value)} style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Column</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box' }}>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={submit} className="btn btn-primary" disabled={!company.trim()}>Add role</button>
        </div>
      </div>
    </div>
  )
}
