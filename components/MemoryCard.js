'use client'

import { useState, useEffect } from 'react'

const BENEFIT_LABELS = {
  enhanced_parental_leave: 'Enhanced parental leave',
  term_time:               'Term-time working',
  four_day_week:           '4-day week',
  fully_remote:            'Fully remote',
  hybrid:                  'Hybrid working',
  share_options:           'Share options',
  private_health:          'Private health insurance',
}

const TRACK_LABELS = {
  standard:       'Standard',
  balanced:       'Balanced (WLB priority)',
  parent:         'Parent-friendly',
  returner:       'Returning to work',
  career_changer: 'Career changer',
}

// Inline editable field — click to edit, save persists to DB
function Field({ label, value, placeholder = 'Not set: click to add', onSave, type = 'text' }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value ?? '')
  const [saving,  setSaving]  = useState(false)

  const display = value !== null && value !== undefined && value !== '' ? String(value) : null

  if (editing) {
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            autoFocus
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={async e => { if (e.key === 'Enter') { setSaving(true); await onSave(draft); setSaving(false); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
            style={{ flex: 1, fontSize: 13, padding: '6px 9px', border: '1px solid var(--marker-black)', borderRadius: 6, fontFamily: 'var(--font-body)', outline: 'none', background: '#fff', color: 'var(--marker-black)' }}
          />
          <button
            onClick={async () => { setSaving(true); await onSave(draft); setSaving(false); setEditing(false) }}
            style={{ fontSize: 11, padding: '6px 12px', border: 'none', borderRadius: 6, background: 'var(--marker-black)', color: 'var(--marker-cream)', cursor: saving ? 'default' : 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 600 }}
          >{saving ? '…' : 'Save'}</button>
          <button
            onClick={() => setEditing(false)}
            style={{ fontSize: 13, padding: '6px 9px', border: '1px solid var(--marker-border)', borderRadius: 6, background: 'transparent', color: 'var(--marker-mid)', cursor: 'pointer', fontFamily: 'var(--font-mono)', lineHeight: 1 }}
          >×</button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{ marginBottom: 14, cursor: 'pointer' }}
      onClick={() => { setDraft(value ?? ''); setEditing(true) }}
      title="Click to edit"
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: display ? 'var(--marker-black)' : 'var(--marker-border)', display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.4 }}>
        {display || placeholder}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-border)', flexShrink: 0 }}>✎</span>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--marker-mid)', borderBottom: '1px solid var(--marker-border)', paddingBottom: 6, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  )
}

// Calls /api/profile/save with the given field update
async function saveField(update) {
  await fetch('/api/profile/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  })
}

export default function MemoryCard() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    fetch('/api/profile/memory')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Could not load profile.'); setLoading(false) })
  }, [])

  if (loading) return <div style={{ padding: 24, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)' }}>Loading…</div>
  if (error)   return <div style={{ padding: 24, fontSize: 13, color: '#EF4444' }}>{error}</div>

  const { profile, careerHistory, wishlists } = data
  const hfj = profile?.hard_filters_json || {}

  const reload = async () => {
    const r = await fetch('/api/profile/memory')
    if (r.ok) setData(await r.json())
  }

  const save = async (update) => {
    await saveField(update)
    await reload()
  }

  const benefits = (hfj.benefits || []).map(b => BENEFIT_LABELS[b] || b)

  return (
    <div style={{ padding: '18px 16px', maxWidth: 600 }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div className="kicker holo-text" style={{ marginBottom: 6 }}>G3: We never forget you</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 6 }}>Everything Requite knows about you</div>
        <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6 }}>Every field below is used to personalise your scores, feed, and AI tools. Click any field to edit; changes save instantly and take effect on your next AI call.</div>
      </div>

      {/* Role preferences */}
      <Section title="Role preferences">
        <Field
          label="Target roles"
          value={(profile?.target_roles || []).join(', ') || null}
          placeholder="e.g. Head of Partnerships, Director of Partnerships"
          onSave={v => save({ targetRoles: v.split(',').map(s => s.trim()).filter(Boolean) })}
        />
        <Field
          label="Seniority level"
          value={profile?.seniority || null}
          placeholder="e.g. Head of, Director, Senior Manager"
          onSave={v => save({ seniorities: [v.trim()] })}
        />
        <Field
          label="Industries"
          value={(profile?.industries || []).join(', ') || null}
          placeholder="e.g. Tech, Fintech, Media"
          onSave={v => save({ industries: v.split(',').map(s => s.trim()).filter(Boolean) })}
        />
      </Section>

      {/* Working preferences */}
      <Section title="Working preferences">
        <Field
          label="Max office days / week"
          value={profile?.max_office_days != null ? String(profile.max_office_days) : null}
          placeholder="e.g. 2"
          type="number"
          onSave={v => save({ maxOfficeDays: v })}
        />
        <Field
          label="Location (postcode or area)"
          value={profile?.postcode || null}
          placeholder="e.g. SW1A or London"
          onSave={v => save({ postcode: v.trim() })}
        />
        <Field
          label="Minimum salary (£k)"
          value={profile?.salary_floor ? String(Math.round(profile.salary_floor / 1000)) : null}
          placeholder="e.g. 80 (for £80k)"
          type="number"
          onSave={v => save({ salaryFloor: v })}
        />
      </Section>

      {/* Skills */}
      <Section title="Skills &amp; keywords (used in AI scoring)">
        <Field
          label="Key skills / keywords"
          value={(hfj.cvKeywords || []).join(', ') || null}
          placeholder="e.g. partnerships, B2B, EMEA, strategic alliances"
          onSave={v => save({ cvKeywords: v.split(',').map(s => s.trim()).filter(Boolean) })}
        />
      </Section>

      {/* Benefits wanted — read-only in v1, shown as chips */}
      {benefits.length > 0 && (
        <Section title="Benefits you care about">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {benefits.map(b => (
              <span key={b} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '3px 8px', borderRadius: 4, color: 'var(--marker-text)' }}>{b}</span>
            ))}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-border)', marginTop: 8 }}>Edit benefits in Settings → onboarding</div>
        </Section>
      )}

      {/* CV on file */}
      <Section title="CV on file">
        <div style={{ fontSize: 13, color: hfj.cvRaw ? 'var(--marker-black)' : 'var(--marker-border)', marginBottom: 4 }}>
          {hfj.cvRaw
            ? `✓ ${hfj.cvRaw.length.toLocaleString()} characters stored`
            : 'No CV stored; paste it in Settings to unlock full AI scoring'}
        </div>
        {hfj.cvRaw && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 6, padding: '8px 10px', maxHeight: 80, overflow: 'hidden', lineHeight: 1.5 }}>
            {hfj.cvRaw.slice(0, 200)}…
          </div>
        )}
      </Section>

      {/* Career history */}
      {careerHistory.length > 0 && (
        <Section title="Career history on file">
          {careerHistory.slice(0, 5).map((h, i) => (
            <div key={h.id || i} style={{ marginBottom: 10, paddingLeft: 10, borderLeft: '2px solid var(--marker-border)' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--marker-black)' }}>{h.role_title}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', marginTop: 2 }}>
                {h.company} · {h.start_date ? h.start_date.slice(0, 7) : '?'} – {h.end_date ? h.end_date.slice(0, 7) : 'present'}
              </div>
            </div>
          ))}
          {careerHistory.length > 5 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)' }}>+ {careerHistory.length - 5} more roles on file</div>
          )}
        </Section>
      )}

      {/* Target companies */}
      {wishlists.length > 0 && (
        <Section title="Target companies">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {wishlists.map((w, i) => (
              <span key={w.id || i} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '3px 8px', borderRadius: 4 }}>{w.company}</span>
            ))}
          </div>
        </Section>
      )}

      {/* Footer note */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-border)', lineHeight: 1.6, marginTop: 8 }}>
        All data stored in your private profile. Wiping any AI conversation history leaves this record byte-identical. This is what Requite reads on every call, never a chat log.
      </div>
    </div>
  )
}
