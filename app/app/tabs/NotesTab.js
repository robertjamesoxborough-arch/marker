'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

// A plain scratchpad. Deliberately the cheapest thing in the app: no AI
// call anywhere in this file, just a text column read and written
// directly from the browser against Supabase (migration 017), protected
// by RLS rather than a server-side check -- see that migration's comment
// for why that's a genuine departure from this codebase's usual pattern
// of an API route + service-role write.
//
// The 10-note cap is enforced twice on purpose: here, for an immediate,
// friendly message before a request is even sent; and in a Postgres
// trigger, which is what actually holds if two tabs are open at once or
// a client-side check is bypassed. If the trigger fires, its error is
// caught and shown as the same message, not a raw Postgres error.
const NOTE_CAP = 10
const MAX_LEN = 4000
const CAP_MESSAGE = `You've reached the ${NOTE_CAP}-note limit. Delete one to add another.`

const LABEL = { display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }

export default function NotesTab() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('notes')
      .select('id, body, created_at, updated_at')
      .order('updated_at', { ascending: false })
    if (err) setError('Could not load your notes. Try refreshing.')
    setNotes(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function startNew() {
    if (notes.length >= NOTE_CAP) { setError(CAP_MESSAGE); return }
    setError('')
    setEditingId('new')
    setDraft('')
  }

  function startEdit(note) {
    setError('')
    setEditingId(note.id)
    setDraft(note.body)
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft('')
  }

  async function saveDraft() {
    const body = draft.trim()
    if (!body || saving) return
    setSaving(true)
    setError('')

    if (editingId === 'new') {
      if (notes.length >= NOTE_CAP) { setError(CAP_MESSAGE); setSaving(false); return }
      const { data, error: err } = await supabase
        .from('notes')
        .insert({ body })
        .select('id, body, created_at, updated_at')
        .single()
      if (err) {
        // The DB trigger is the real enforcement (see migration 017) --
        // this catches the race where a second tab got in first.
        setError(err.message?.includes('notes_cap_reached') ? CAP_MESSAGE : 'Could not save that note. Try again.')
      } else {
        setNotes(prev => [data, ...prev])
        setEditingId(null)
        setDraft('')
      }
    } else {
      const { data, error: err } = await supabase
        .from('notes')
        .update({ body })
        .eq('id', editingId)
        .select('id, body, created_at, updated_at')
        .single()
      if (err) {
        setError('Could not save that note. Try again.')
      } else {
        setNotes(prev => prev.map(n => n.id === editingId ? data : n).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)))
        setEditingId(null)
        setDraft('')
      }
    }
    setSaving(false)
  }

  async function deleteNote(id) {
    setError('')
    const { error: err } = await supabase.from('notes').delete().eq('id', id)
    if (err) { setError('Could not delete that note. Try again.'); return }
    setNotes(prev => prev.filter(n => n.id !== id))
    setConfirmDeleteId(null)
    if (editingId === id) cancelEdit()
  }

  function titleFor(body) {
    const firstLine = (body || '').split('\n')[0].trim()
    return firstLine || 'Untitled note'
  }

  const atCap = notes.length >= NOTE_CAP

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 64px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em' }}>Notes</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)' }}>{notes.length}/{NOTE_CAP}</div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6, marginBottom: 20 }}>
        A plain scratchpad for anything you don&apos;t want to lose: a recruiter&apos;s name, a question to ask, a thought mid-search. Nothing here is scored or sent anywhere.
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B91C1C', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {editingId === null && (
        <button
          onClick={startNew}
          disabled={atCap}
          className="btn btn-primary"
          style={{ marginBottom: 20, padding: '10px 20px', fontSize: 13, opacity: atCap ? 0.4 : 1, cursor: atCap ? 'not-allowed' : 'pointer' }}
        >
          + New note
        </button>
      )}

      {editingId !== null && (
        <div style={{ border: '1px solid var(--marker-border)', borderRadius: 10, padding: 16, marginBottom: 20, background: 'var(--marker-cream-2)' }}>
          <label style={LABEL}>{editingId === 'new' ? 'New note' : 'Edit note'}</label>
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value.slice(0, MAX_LEN))}
            rows={6}
            placeholder="Jot it down..."
            style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)', lineHeight: 1.6, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>{draft.length}/{MAX_LEN}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={cancelEdit} className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: 13 }}>Cancel</button>
              <button onClick={saveDraft} disabled={!draft.trim() || saving} className="btn btn-lime" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, opacity: draft.trim() ? 1 : 0.4 }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--marker-mid)' }}>Loading your notes...</div>
      ) : notes.length === 0 && editingId === null ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--marker-mid)', fontSize: 13 }}>
          No notes yet. Start with whatever&apos;s on your mind.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.filter(n => n.id !== editingId).map(note => (
            <div key={note.id} style={{ border: '1px solid var(--marker-border)', borderRadius: 10, padding: '14px 16px', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => startEdit(note)}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 4, wordBreak: 'break-word' }}>{titleFor(note.body)}</div>
                  <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {note.body.length > 160 ? note.body.slice(0, 160) + '...' : note.body}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginTop: 8 }}>
                    {new Date(note.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {confirmDeleteId === note.id ? (
                    <>
                      <button onClick={() => deleteNote(note.id)} style={{ background: 'none', border: 'none', color: '#B91C1C', fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: '4px 8px' }}>Confirm</button>
                      <button onClick={() => setConfirmDeleteId(null)} style={{ background: 'none', border: 'none', color: 'var(--marker-mid)', fontSize: 12, cursor: 'pointer', padding: '4px 8px' }}>Keep</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(note.id)} style={{ background: 'none', border: 'none', color: 'var(--marker-mid)', fontSize: 12, cursor: 'pointer', padding: '4px 8px' }} title="Delete note">Delete</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
