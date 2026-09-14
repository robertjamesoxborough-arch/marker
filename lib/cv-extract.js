// Extracts just the CV from a raw CV-generation model response (Stage 59).
//
// app/api/cv/generate/route.js's prompt deliberately asks the model to
// "work through these two steps and include them in your output" before
// the actual CV -- a ---JD REQUIREMENTS--- list and an ---EVIDENCE MAP---
// (Standard effort), plus an ---ATS ANALYSIS--- before and a
// ---SIFT ASSESSMENT--- after (Deep effort) -- so every tailored bullet can
// be traced to real evidence. That reasoning was always meant to be
// scaffolding, not the deliverable, but the route previously returned the
// entire unsplit response as `text`, so the downloaded/previewed CV
// contained the model's own working-out stapled around the real CV (and
// buildCvDocx's all-caps heading detector even bolded "JD REQUIREMENTS"
// and "EVIDENCE MAP" as if they were genuine CV section headers).
//
// This splits the response on its own `---SECTION NAME---` markers and
// returns only the content between ---TAILORED CV--- and the next marker
// (or end of string) as `cv`; everything else is kept separately as
// `reasoning`/`sift` so it can still be shown in the UI as "why we scored
// it this way" if useful, but is never mixed into the CV text again.

const SECTION_MARKER_RE = /^-{2,}\s*([A-Z][A-Z /]+?)\s*-{2,}\s*$/gm

function extractCvSections(raw) {
  const text = raw || ''
  const markers = []
  const re = new RegExp(SECTION_MARKER_RE)
  let m
  while ((m = re.exec(text))) {
    markers.push({ name: m[1].trim(), start: m.index, contentStart: m.index + m[0].length })
  }

  // No recognised section markers at all -- nothing can be safely stripped
  // (stripping on a guess risks deleting real CV content), so return
  // everything. usedFallback lets the caller know the expected structure
  // wasn't found, rather than silently assuming it was.
  if (markers.length === 0) {
    return { cv: text.trim(), reasoning: '', sift: '', usedFallback: true }
  }

  const sections = {}
  for (let i = 0; i < markers.length; i++) {
    const end = i + 1 < markers.length ? markers[i + 1].start : text.length
    sections[markers[i].name] = text.slice(markers[i].contentStart, end).trim()
  }

  const cv = sections['TAILORED CV']
  const reasoning = [sections['JD REQUIREMENTS'], sections['EVIDENCE MAP'], sections['ATS ANALYSIS']].filter(Boolean).join('\n\n')
  const sift = sections['SIFT ASSESSMENT'] || ''

  // Markers were found, but not the one that actually matters -- never
  // silently return an empty CV. Fall back to the full text so nothing is
  // lost, but flag it so this can be noticed rather than fail silently.
  if (!cv) {
    return { cv: text.trim(), reasoning, sift, usedFallback: true }
  }

  return { cv, reasoning, sift, usedFallback: false }
}

module.exports = { extractCvSections }
