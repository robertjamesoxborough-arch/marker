'use client'

import { useState, useEffect, useRef } from 'react'

// Q&A turns hit /api/pipeline/tidy-up with action:'turn' (Haiku 4.5, cached
// system prompt, hard 8-turn server-side cap). Once the model signals
// done:true, one single action:'resort' call (Sonnet) produces the plan;
// applying it is plain updateJob() writes, no further model calls.
export default function TidyUpModal({ jobs, updateJob, onClose }) {
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [phase,    setPhase]    = useState('chat') // chat | sorting | done | locked | error
  const [lockMsg,  setLockMsg]  = useState('')
  const [result,   setResult]   = useState(null)
  const scrollRef = useRef(null)
  const started   = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    postTurn([])
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, phase])

  async function postTurn(nextMessages) {
    setLoading(true)
    try {
      const res = await fetch('/api/pipeline/tidy-up', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'turn', messages: nextMessages }),
      })
      const data = await res.json()
      if (data.locked) { setPhase('locked'); setLockMsg(data.error || 'This is a Pro feature.'); setLoading(false); return }
      if (!data.message) { setPhase('error'); setLoading(false); return }
      const updated = [...nextMessages, { role: 'assistant', content: data.message }]
      setMessages(updated)
      setLoading(false)
      if (data.done) runResort(updated)
    } catch {
      setPhase('error'); setLoading(false)
    }
  }

  function send() {
    if (!input.trim() || loading) return
    const updated = [...messages, { role: 'user', content: input.trim() }]
    setMessages(updated)
    setInput('')
    postTurn(updated)
  }

  async function runResort(finalMessages) {
    setPhase('sorting')
    const pipelineJobs = jobs.filter(j => !j.archived).map(j => ({ id: j.id, company: j.company, roleTitle: j.roleTitle, status: j.status, score: j.score }))
    try {
      const res = await fetch('/api/pipeline/tidy-up', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resort', messages: finalMessages, pipelineJobs }),
      })
      const data = await res.json()
      if (data.error) { setPhase('error'); return }
      data.holding?.forEach(id => updateJob(id, { holdingArea: true }))
      data.prioritized?.forEach(id => updateJob(id, { holdingArea: false }))
      setResult(data)
      setPhase('done')
    } catch {
      setPhase('error')
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', maxHeight: '80vh', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500 }}>Help me tidy up</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--marker-mid)', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {phase === 'locked' ? (
          <div>
            <div style={{ fontSize: 13, color: 'var(--marker-text)', marginBottom: 18, lineHeight: 1.5 }}>{lockMsg}</div>
            <button onClick={onClose} className="btn btn-ghost">Close</button>
          </div>
        ) : phase === 'error' ? (
          <div>
            <div style={{ fontSize: 13, color: 'var(--marker-text)', marginBottom: 18, lineHeight: 1.5 }}>Sorry, something went wrong. Nothing on your board has changed, feel free to try again.</div>
            <button onClick={onClose} className="btn btn-ghost">Close</button>
          </div>
        ) : phase === 'done' ? (
          <div>
            <div style={{ fontSize: 13, color: 'var(--marker-text)', marginBottom: 18, lineHeight: 1.5 }}>{result?.message}</div>
            <button onClick={onClose} className="btn btn-primary">Back to board</button>
          </div>
        ) : (
          <>
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14, minHeight: 140 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? 'var(--marker-lime)' : 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, maxWidth: '85%', lineHeight: 1.45, color: 'var(--marker-black)' }}>
                  {m.content}
                </div>
              ))}
              {(loading || phase === 'sorting') && (
                <div style={{ alignSelf: 'flex-start', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)' }}>
                  {phase === 'sorting' ? 'Sorting your board…' : '…'}
                </div>
              )}
            </div>
            {phase === 'chat' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') send() }}
                  disabled={loading}
                  placeholder="Type your answer…"
                  style={{ flex: 1, padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }}
                />
                <button onClick={send} disabled={loading || !input.trim()} className="btn btn-primary">Send</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
