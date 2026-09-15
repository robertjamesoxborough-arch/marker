'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { normaliseCompany } from '../../../lib/job-match'

const MESSAGE_TYPE_META = {
  warm_referral:        { label: 'Warm referral ask',    forStatus: 'pre' },
  reconnect_ask:        { label: 'Reconnect, then ask',  forStatus: 'pre' },
  speculative_outreach: { label: 'Speculative outreach', forStatus: 'none' },
  nudge:                { label: 'Post-application nudge', forStatus: 'post' },
  intel_request:        { label: 'Ask for intel',        forStatus: 'post' },
}

const POST_APPLY_STATUSES = ['applied', 'interviewing', 'offer']

const STATUS_FLOW = ['drafted', 'sent', 'responded', 'agreed', 'referred']
const STATUS_LABELS = { drafted: 'Drafted', sent: 'Sent', responded: 'Responded', agreed: 'Agreed', referred: 'Referred', declined: 'Declined', no_response: 'No response' }
const STATUS_COLORS = { drafted: 'var(--marker-border)', sent: '#93C5FD', responded: '#FCD34D', agreed: '#C6F432', referred: '#86EFAC', declined: '#FCA5A5', no_response: 'var(--marker-border)' }

const LABEL = { display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }
const INPUT = { display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }

export default function ReferralsTab({ jobs, profile, prefill, onClearPrefill }) {
  const supabase = useMemo(() => createClient(), [])
  const activeJobs = (jobs || []).filter(j => !['watchlist', 'no_jobs', 'rejected'].includes(j.status))

  const [contacts, setContacts] = useState([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [requests, setRequests] = useState([])

  const [showAddContact, setShowAddContact] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', company: '', pastCompanies: '', relationship: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const [draftFor, setDraftFor] = useState(null) // { contact, job|null }
  const [messageType, setMessageType] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [draftResult, setDraftResult] = useState(null) // { message, lint }
  const [draftError, setDraftError] = useState('')
  const [copied, setCopied] = useState(false)

  async function loadAll() {
    setContactsLoading(true)
    const [{ data: c }, { data: r }] = await Promise.all([
      supabase.from('contacts').select('*').order('name'),
      supabase.from('referral_requests').select('*').order('created_at', { ascending: false }),
    ])
    setContacts(c || [])
    setRequests(r || [])
    setContactsLoading(false)
  }

  useEffect(() => { loadAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // "Ask for a referral" from a Pipeline card / Today item — pre-selects
  // that job and opens the draft panel for the best-matching contact, if
  // one exists, so the deep link lands somewhere useful, not just the tab.
  useEffect(() => {
    if (!prefill || contactsLoading) return
    const job = activeJobs.find(j => j.id === prefill.jobId)
    if (job) {
      const matched = contacts.find(c => c.company && job.company && normaliseCompany(c.company) === normaliseCompany(job.company))
      if (matched) startDraft(matched, job)
    }
    onClearPrefill?.()
  }, [prefill, contactsLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  function matchedJobs(contact) {
    if (!contact.company) return []
    return activeJobs.filter(j => j.company && normaliseCompany(j.company) === normaliseCompany(contact.company))
  }

  function resetForm() { setForm({ name: '', company: '', pastCompanies: '', relationship: '', notes: '' }) }

  async function saveContact() {
    if (!form.name.trim() || saving) return
    setSaving(true)
    const row = {
      name: form.name.trim(),
      company: form.company.trim() || null,
      past_companies: form.pastCompanies.split(',').map(s => s.trim()).filter(Boolean),
      relationship: form.relationship.trim() || null,
      notes: form.notes.trim() || null,
    }
    try {
      if (editingId) {
        await supabase.from('contacts').update({ ...row, updated_at: new Date().toISOString() }).eq('id', editingId)
      } else {
        await supabase.from('contacts').insert(row)
      }
      resetForm(); setShowAddContact(false); setEditingId(null)
      await loadAll()
    } finally { setSaving(false) }
  }

  function editContact(c) {
    setForm({ name: c.name, company: c.company || '', pastCompanies: (c.past_companies || []).join(', '), relationship: c.relationship || '', notes: c.notes || '' })
    setEditingId(c.id); setShowAddContact(true)
  }

  async function deleteContact(id) {
    await supabase.from('contacts').delete().eq('id', id)
    await loadAll()
  }

  function startDraft(contact, job) {
    setDraftFor({ contact, job: job || null })
    setDraftResult(null); setDraftError('')
    if (!job) { setMessageType('speculative_outreach'); return }
    const pre = !POST_APPLY_STATUSES.includes(job.status)
    setMessageType(pre ? 'warm_referral' : 'nudge')
  }

  async function generate() {
    if (!draftFor || !messageType || drafting) return
    setDrafting(true); setDraftError(''); setDraftResult(null)
    try {
      const { contact, job } = draftFor
      const res = await fetch('/api/referral/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: { name: contact.name, company: contact.company, pastCompanies: contact.past_companies, relationship: contact.relationship, lastContactedAt: contact.last_contacted_at, notes: contact.notes },
          job: job ? { roleTitle: job.roleTitle, company: job.company, jd: job.jd, status: job.status } : null,
          messageType,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setDraftError(data.error || 'Generation failed'); return }
      setDraftResult(data)
    } catch {
      setDraftError('Request failed. Try again.')
    } finally {
      setDrafting(false)
    }
  }

  async function saveRequest(initialStatus) {
    if (!draftFor || !draftResult) return
    const { contact, job } = draftFor
    const row = {
      contact_id: contact.id,
      job_id: job?.id || null,
      message_type: messageType,
      drafted_message: draftResult.message,
      status: initialStatus,
      ...(initialStatus === 'sent' ? { sent_at: new Date().toISOString() } : {}),
    }
    await supabase.from('contacts').update({ last_contacted_at: new Date().toISOString() }).eq('id', contact.id)
    await supabase.from('referral_requests').insert(row)
    setDraftFor(null); setDraftResult(null)
    await loadAll()
  }

  async function advanceStatus(req, status) {
    const stamps = { sent: 'sent_at', responded: 'responded_at', agreed: 'agreed_at', referred: 'referred_at' }
    const update = { status, updated_at: new Date().toISOString() }
    if (stamps[status]) update[stamps[status]] = new Date().toISOString()
    await supabase.from('referral_requests').update(update).eq('id', req.id)
    await loadAll()
  }

  function copy() {
    if (!draftResult?.message) return
    navigator.clipboard.writeText(draftResult.message).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const availableTypes = draftFor?.job
    ? Object.entries(MESSAGE_TYPE_META).filter(([, m]) => m.forStatus === (POST_APPLY_STATUSES.includes(draftFor.job.status) ? 'post' : 'pre'))
    : Object.entries(MESSAGE_TYPE_META).filter(([, m]) => m.forStatus === 'none')

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--marker-border)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 3 }}>Your network</div>
        <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6 }}>
          The referral channel produces most real hires, far more than cold applications. Keep the people you know, and let Requite draft the outreach: a warm ask for a specific role, or just staying in touch at a company you admire.
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Contacts ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Contacts ({contacts.length})</div>
            <button onClick={() => { setShowAddContact(o => !o); setEditingId(null); resetForm() }}
              style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
              {showAddContact ? 'Cancel' : '+ Add contact'}
            </button>
          </div>

          {showAddContact && (
            <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={LABEL}>Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Sam Okafor" style={INPUT} />
              </div>
              <div>
                <label style={LABEL}>Current company <span style={{ fontWeight: 400, color: 'var(--marker-mid)' }}>(optional)</span></label>
                <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="e.g. Monzo" style={INPUT} />
              </div>
              <div>
                <label style={LABEL}>Past companies <span style={{ fontWeight: 400, color: 'var(--marker-mid)' }}>(comma separated, optional)</span></label>
                <input value={form.pastCompanies} onChange={e => setForm(f => ({ ...f, pastCompanies: e.target.value }))} placeholder="e.g. Revolut, Wise" style={INPUT} />
              </div>
              <div>
                <label style={LABEL}>How you know them</label>
                <input value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))} placeholder="e.g. Former colleague at Acme, 2019-2021" style={INPUT} />
              </div>
              <div>
                <label style={LABEL}>Notes <span style={{ fontWeight: 400, color: 'var(--marker-mid)' }}>(optional)</span></label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anything worth remembering for next time" rows={2} style={{ ...INPUT, resize: 'vertical' }} />
              </div>
              <button onClick={saveContact} disabled={!form.name.trim() || saving}
                style={{ background: form.name.trim() ? 'var(--marker-black)' : 'var(--marker-border)', color: form.name.trim() ? 'var(--marker-cream)' : 'var(--marker-mid)', border: 'none', padding: '10px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: form.name.trim() ? 'pointer' : 'default' }}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add contact'}
              </button>
            </div>
          )}

          {contactsLoading ? (
            <div style={{ fontSize: 12, color: 'var(--marker-mid)', padding: '12px 0' }}>Loading…</div>
          ) : contacts.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--marker-mid)', padding: '16px 0', textAlign: 'center' }}>No contacts yet. Add the people you already know, at companies you're targeting.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {contacts.map(c => {
                const matches = matchedJobs(c)
                return (
                  <div key={c.id} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--marker-border)', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--marker-black)' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--marker-mid)' }}>
                          {[c.company, c.relationship].filter(Boolean).join(' · ') || 'No details yet'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button onClick={() => editContact(c)} style={{ background: 'none', border: '1px solid var(--marker-border)', borderRadius: 5, padding: '4px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--marker-mid)', cursor: 'pointer' }}>EDIT</button>
                        <button onClick={() => deleteContact(c.id)} style={{ background: 'none', border: '1px solid var(--marker-border)', borderRadius: 5, padding: '4px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--marker-mid)', cursor: 'pointer' }}>DEL</button>
                      </div>
                    </div>
                    {matches.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                        {matches.map(j => (
                          <button key={j.id} onClick={() => startDraft(c, j)}
                            style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-lime)', border: 'none', padding: '3px 8px', borderRadius: 4, cursor: 'pointer' }}>
                            {POST_APPLY_STATUSES.includes(j.status) ? 'Nudge for' : 'Ask about'}: {j.roleTitle || j.company}
                          </button>
                        ))}
                      </div>
                    )}
                    <button onClick={() => startDraft(c, null)}
                      style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', textDecoration: 'underline', cursor: 'pointer' }}>
                      Speculative outreach (no specific role) →
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Draft panel ── */}
        {draftFor && (
          <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--marker-black)', background: 'var(--marker-cream-2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)' }}>
                {draftFor.job ? `${draftFor.contact.name} · ${draftFor.job.roleTitle || draftFor.job.company}` : `${draftFor.contact.name} · speculative`}
              </div>
              <button onClick={() => setDraftFor(null)} style={{ background: 'none', border: 'none', color: 'var(--marker-mid)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
            </div>

            {draftFor.job && (
              <div style={{ fontSize: 11, color: 'var(--marker-mid)' }}>
                Role status: <strong>{draftFor.job.status}</strong>{POST_APPLY_STATUSES.includes(draftFor.job.status) ? ': already applied, so a referral ask is off the table; nudge or intel only.' : ''}
              </div>
            )}

            <div>
              <label style={LABEL}>Message type</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {availableTypes.map(([id, meta]) => (
                  <button key={id} onClick={() => { setMessageType(id); setDraftResult(null) }}
                    style={{ padding: '7px 12px', borderRadius: 7, border: `1px solid ${messageType === id ? 'var(--marker-black)' : 'var(--marker-border)'}`, background: messageType === id ? 'var(--marker-black)' : 'transparent', color: messageType === id ? 'var(--marker-cream)' : 'var(--marker-text)', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                    {meta.label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={generate} disabled={drafting || !messageType}
              style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '10px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: drafting ? 'default' : 'pointer' }}>
              {drafting ? 'Drafting…' : draftResult ? 'Regenerate' : 'Draft message'}
            </button>

            {draftError && <div style={{ fontSize: 12, color: '#B91C1C', padding: '8px 10px', background: '#FEE2E2', borderRadius: 6 }}>{draftError}</div>}

            {draftResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {draftResult.lint && (
                  <div style={{ padding: '7px 10px', borderRadius: 6, background: draftResult.lint.ok ? '#F0FDF4' : '#FFFBEB', border: `1px solid ${draftResult.lint.ok ? '#86EFAC' : '#FDE68A'}`, fontSize: 11, color: draftResult.lint.ok ? '#166534' : '#92400E' }}>
                    {draftResult.lint.ok ? '✓ Clean: British English, no em dashes, no AI-tell filler' : `⚠ ${draftResult.lint.issues.join(' · ')}`}
                  </div>
                )}
                <textarea readOnly value={draftResult.message} rows={6}
                  style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--marker-border)', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--marker-text)', background: '#fff', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={copy} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--marker-border)', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer' }}>
                    {copied ? 'Copied ✓' : 'Copy'}
                  </button>
                  <button onClick={() => saveRequest('sent')} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--marker-lime)', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    Mark as sent
                  </button>
                  <button onClick={() => saveRequest('drafted')} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--marker-border)', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer' }}>
                    Save as draft
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Referral requests tracker ── */}
        {requests.length > 0 && (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Tracked asks ({requests.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {requests.map(r => {
                const contact = contacts.find(c => c.id === r.contact_id)
                const job = activeJobs.find(j => j.id === r.job_id)
                const nextIdx = STATUS_FLOW.indexOf(r.status)
                const nextStatus = nextIdx >= 0 && nextIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[nextIdx + 1] : null
                return (
                  <div key={r.id} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--marker-border)', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--marker-black)' }}>{contact?.name || 'Unknown contact'}{job ? ` · ${job.roleTitle || job.company}` : ' · speculative'}</div>
                        <div style={{ fontSize: 10, color: 'var(--marker-mid)', fontFamily: 'var(--font-mono)' }}>{MESSAGE_TYPE_META[r.message_type]?.label || r.message_type}</div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 8px', borderRadius: 4, background: STATUS_COLORS[r.status] || 'var(--marker-border)', color: 'var(--marker-black)', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </div>
                    {!['declined', 'no_response', 'referred'].includes(r.status) && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        {nextStatus && (
                          <button onClick={() => advanceStatus(r, nextStatus)} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '4px 9px', borderRadius: 4, cursor: 'pointer' }}>
                            Mark {STATUS_LABELS[nextStatus]} →
                          </button>
                        )}
                        <button onClick={() => advanceStatus(r, 'declined')} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'transparent', border: '1px solid var(--marker-border)', color: 'var(--marker-mid)', padding: '4px 9px', borderRadius: 4, cursor: 'pointer' }}>Declined</button>
                        <button onClick={() => advanceStatus(r, 'no_response')} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'transparent', border: '1px solid var(--marker-border)', color: 'var(--marker-mid)', padding: '4px 9px', borderRadius: 4, cursor: 'pointer' }}>No response</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '10px 16px 16px' }}>
        <div className="legal-line">Referrals are drafted from your own contacts and career history. Requite never contacts anyone on your behalf, sees or stores your contacts&apos; own data beyond what you enter, or shares anything with employers.</div>
      </div>
    </div>
  )
}
