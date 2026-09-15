'use client'

import { useState } from 'react'
import { Packer } from 'docx'
import { buildCvDocx } from '../../../lib/cv-docx'

// The original contractor-specific framing/instructions, kept verbatim —
// used only as the copy-paste fallback now (the primary path below sends
// this same brief server-side through the real generate pipeline instead).
function buildContractorCvFallbackPrompt(profile) {
  const hfj = profile?.hard_filters_json || {}
  const roles = (hfj.targetRoles || []).join(', ') || 'senior contractor'
  const field = (Array.isArray(hfj.field) ? hfj.field.join(', ') : hfj.field) || 'your field'
  const yearsExp = hfj.yearsExperience || ''
  const summary = hfj.careerSummary || ''
  const cvRaw = (hfj.cvRaw || '').slice(0, 3000)
  const ir35 = hfj.ir35Willing === true ? 'outside IR35' : hfj.ir35Willing === false ? 'inside IR35 only' : 'inside or outside IR35'
  const contractTypes = (hfj.contractTypes || []).join(', ') || 'contract and interim'

  return `You are an expert CV writer for UK contractors and interim professionals.

Write a clean, skills-led contractor CV for the following person. This CV will be sent directly to recruitment agencies; it must be concise, outcomes-focused, and easy to skim in 10 seconds.

Professional background:
${summary || cvRaw || `Experienced ${field} professional with ${yearsExp ? yearsExp + ' years experience' : 'significant experience'} in ${roles}.`}

Target roles: ${roles}
Field: ${field}
IR35 preference: ${ir35}
Contract type preference: ${contractTypes}

CV structure to produce:
1. Name + contact line placeholder (e.g. "[Name] | [Email] | [LinkedIn] | Day rate: £[X]/day")
2. Professional summary (3-4 lines, contractor positioning, sector breadth, key skills)
3. Core skills (bullet list, 12-16 items; use keywords recruiters search for)
4. Career history (most recent first: company, role, dates, 3-4 achievement bullets per role using £/% outcomes where possible)
5. Education + certifications (brief)

Rules:
- UK English throughout
- No "responsible for". Use strong verbs: (led, delivered, grew, built, reduced)
- Include day rate placeholder
- Keep to 2 pages equivalent
- Format clearly with section headers

Return the CV text only, no preamble, no explanation.`
}

export default function ContractorCvPanel({ profile }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCopyFallback, setShowCopyFallback] = useState(false)
  const [copied, setCopied] = useState(false)

  async function generate() {
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/cv/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'contractor' }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function downloadDocx(text) {
    const doc = buildCvDocx(text)
    const blob = await Packer.toBlob(doc)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'Contractor CV.docx'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6 }}>
        Generate a skills-led CV to send directly to recruitment agencies, not tied to any single role: the same premium output as your AI Generate CV (verified-stats check, format-safe layout), just framed for contractor mailshots.
      </div>

      <button onClick={generate} disabled={loading}
        style={{ padding: '11px', borderRadius: 8, background: loading ? 'var(--marker-mid)' : 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer' }}>
        {loading ? 'Generating…' : 'Generate'}
      </button>

      {/* One deliberately-kept copy-paste fallback, same pattern as AI
          Generate's — for people who'd rather use their own Claude/ChatGPT
          than spend an in-app allowance. Clearly secondary to Generate. */}
      {!showCopyFallback && (
        <button onClick={() => setShowCopyFallback(true)}
          style={{ background: 'none', border: 'none', padding: '4px 0', fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--marker-mid)', textDecoration: 'underline', cursor: 'pointer', alignSelf: 'center' }}>
          Prefer to use your own ChatGPT/Claude? Copy the prompt instead →
        </button>
      )}

      {showCopyFallback && (() => {
        const prompt = buildContractorCvFallbackPrompt(profile)
        return (
          <div style={{ border: '1px solid var(--marker-border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--marker-black)' }}>Copy-paste fallback</div>
              <button onClick={() => setShowCopyFallback(false)} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--marker-mid)', cursor: 'pointer', textDecoration: 'underline' }}>Back to Generate</button>
            </div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 8, padding: 10, maxHeight: 220, overflowY: 'auto' }}>
                <pre style={{ margin: 0, fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mono)', color: 'var(--marker-text)' }}>{prompt}</pre>
              </div>
              <button onClick={() => { navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 2500) }}
                style={{ width: '100%', padding: '10px', borderRadius: 8, background: copied ? 'var(--marker-lime)' : 'var(--marker-black)', color: copied ? 'var(--marker-black)' : 'var(--marker-cream)', border: 'none', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                {copied ? 'Copied ✓' : 'Copy prompt'}
              </button>
            </div>
          </div>
        )
      })()}

      {error && <div style={{ padding: 10, borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', fontFamily: 'var(--font-body)', fontSize: 13, color: '#dc2626' }}>{error}</div>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {result.atsCheck && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: result.atsCheck.structureOk ? '#f0fdf4' : '#fffbeb', border: `1px solid ${result.atsCheck.structureOk ? '#86efac' : '#fcd34d'}`, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--marker-black)', lineHeight: 1.6 }}>
              <strong>Format &amp; keyword check:</strong> {result.atsCheck.summary}
            </div>
          )}
          {result.flaggedMetrics && result.flaggedMetrics.length > 0 && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fcd34d', fontFamily: 'var(--font-body)', fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
              <strong>Verified-stats warning:</strong> The following numbers were not found in your stored CV. Review before using: <strong>{result.flaggedMetrics.join(', ')}</strong>
            </div>
          )}
          {result.flaggedMetrics && result.flaggedMetrics.length === 0 && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#166534', letterSpacing: '0.06em' }}>
              VERIFIED: all metrics trace to your stored CV
            </div>
          )}
          <textarea readOnly value={result.text}
            style={{ width: '100%', minHeight: 320, padding: 12, borderRadius: 8, border: '1px solid var(--marker-border)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-text)', background: 'var(--marker-cream-2)', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => navigator.clipboard.writeText(result.text)}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--marker-border)', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer', color: 'var(--marker-text)' }}>
              Copy to clipboard
            </button>
            <button onClick={() => downloadDocx(result.text)}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--marker-black)', background: 'var(--marker-black)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer', color: 'var(--marker-cream)' }}>
              Download as Word (.docx)
            </button>
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1.5 }}>
        Generated from your profile. To improve the output, add your full CV text in <a href="/settings" style={{ color: 'var(--marker-black)' }}>Settings</a>.
      </div>
    </div>
  )
}
