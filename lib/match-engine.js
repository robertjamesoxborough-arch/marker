/**
 * Requite deterministic match engine.
 * Zero AI calls. Zero randomness. Same inputs → same output, always.
 * Every sub-score includes a plain-English reason for full inspectability.
 *
 * Usage:
 *   const { scoreMatch } = require('./match-engine')
 *   const result = scoreMatch(profile, job)
 *   // result.score       — overall 0–10 (1 d.p.)
 *   // result.dimensions  — { roleFit, seniorityFit, locationFit, compFit, freshness, cultureWlb }
 *   // each dimension     — { score: 0–10, reason: string }
 */

// ── Weights (must sum to 1.0) ─────────────────────────────────────────────
const WEIGHTS = {
  roleFit:      0.30,
  seniorityFit: 0.20,
  locationFit:  0.20,
  compFit:      0.15,
  freshness:    0.10,
  cultureWlb:   0.05,
}

// ── Seniority tiers (ascending) ───────────────────────────────────────────
// A profile's seniority text and a job title are each mapped to a tier.
// Score = function of tier gap.
const SENIORITY_TIERS = [
  { tier: 0, keywords: ['intern', 'graduate', 'trainee', 'apprentice', 'junior', 'entry'] },
  { tier: 1, keywords: ['analyst', 'associate', 'coordinator', 'specialist', 'executive', 'officer', 'assistant'] },
  { tier: 2, keywords: ['manager', 'lead', 'supervisor'] },
  { tier: 3, keywords: ['senior manager', 'senior director', 'principal', 'group manager', 'senior lead', 'senior'] },
  { tier: 4, keywords: ['head of', 'director', 'vp', 'vice president', 'general manager'] },
  { tier: 5, keywords: ['ceo', 'cto', 'cmo', 'coo', 'cfo', 'chief', 'partner', 'president', 'c-suite'] },
]

function matchesKeyword(text, kw) {
  // Word-boundary match: prevents "partnerships" hitting "partner", "senior" hitting "seniority" etc.
  const escaped = kw.replace(/[-\s]+/g, '[\\s-]+')
  return new RegExp('\\b' + escaped + '\\b', 'i').test(text)
}

function getTierForText(text) {
  if (!text) return null
  const t = text.toLowerCase()
  // Walk from high to low so multi-word keywords (e.g. "head of") win over single-word ones
  for (let i = SENIORITY_TIERS.length - 1; i >= 0; i--) {
    const { tier, keywords } = SENIORITY_TIERS[i]
    if (keywords.some(kw => matchesKeyword(t, kw))) return tier
  }
  return null
}

// ── Text utilities ────────────────────────────────────────────────────────
function tokenize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
}

function jaccardOverlap(a, b) {
  const setA = new Set(tokenize(a))
  const setB = new Set(tokenize(b))
  if (setA.size === 0 && setB.size === 0) return 0
  let shared = 0
  setA.forEach(w => { if (setB.has(w)) shared++ })
  const union = setA.size + setB.size - shared
  return union === 0 ? 0 : shared / union
}

// ── roleFit tuning: generic modifiers and functional families ─────────────
// A shared generic word ("technical", "senior") between two otherwise
// unrelated titles must not inflate the match on its own — these carry
// little signal about whether two roles are actually the same job.
const LOW_SIGNAL_WORDS = new Set([
  'senior', 'technical', 'digital', 'global', 'regional', 'national',
  'junior', 'principal', 'strategic', 'commercial', 'group', 'international',
  'remote', 'hybrid', 'uk',
])

function tokenizeSignificant(s) {
  return tokenize(s).filter(w => !LOW_SIGNAL_WORDS.has(w))
}

function jaccardOverlapSignificant(a, b) {
  const setA = new Set(tokenizeSignificant(a))
  const setB = new Set(tokenizeSignificant(b))
  if (setA.size === 0 && setB.size === 0) return 0
  let shared = 0
  setA.forEach(w => { if (setB.has(w)) shared++ })
  const union = setA.size + setB.size - shared
  return union === 0 ? 0 : shared / union
}

// Broad functional families. A job clearly in one family and a target
// clearly in a disjoint family is a domain mismatch even when they share
// modifier words — e.g. "Technical Sales Executive" vs "technical delivery"
// share "technical" but sales and delivery are not the same job.
const ROLE_FAMILIES = {
  sales: ['sales', 'account executive', 'account manager', 'business development', 'bdm', 'sdr'],
  engineering: ['engineer', 'developer', 'devops', 'sre'],
  delivery: ['delivery', 'programme', 'program', 'project manager', 'pmo', 'scrum'],
  marketing: ['marketing', 'brand', 'communications', 'pr', 'content'],
  data: ['data analyst', 'data scientist', 'analytics', 'analyst'],
  hr: ['human resources', 'hr', 'people partner', 'talent acquisition', 'recruitment', 'recruiter'],
  finance: ['finance', 'financial', 'accountant', 'accounting'],
  operations: ['operations', 'supply chain', 'logistics', 'warehouse'],
  product: ['product manager', 'product owner', 'product lead'],
  design: ['designer', 'ux', 'ui', 'user experience'],
  legal: ['legal', 'compliance', 'counsel'],
}

function familiesOf(text) {
  const families = new Set()
  for (const [family, kws] of Object.entries(ROLE_FAMILIES)) {
    if (kws.some(kw => matchesKeyword(text, kw))) families.add(family)
  }
  return families
}

// Only a real signal when BOTH sides have a determinable family and they
// share none — if either side's family can't be determined, stay silent
// rather than guess.
function familiesConflict(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return false
  for (const f of setA) if (setB.has(f)) return false
  return true
}

// ── Salary parser ─────────────────────────────────────────────────────────
// Handles: "£70,000–£90,000", "£80k", "70000", "£70k-£80k"
function parseSalaryMidGBP(salaryStr) {
  if (!salaryStr) return null

  // Handle "Nk" shorthand first
  const kMatches = salaryStr.match(/(\d+(?:\.\d+)?)\s*k/gi)
  if (kMatches) {
    const vals = kMatches.map(k => parseFloat(k) * 1000)
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }

  // Extract raw numbers >= 1000 (avoids matching day/year counts)
  const nums = (salaryStr.match(/[\d,]+/g) || [])
    .map(n => parseInt(n.replace(/,/g, ''), 10))
    .filter(n => n >= 10000)

  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

// ── Dimension scorers ─────────────────────────────────────────────────────

function scoreRoleFit(profile, job) {
  const targets = profile?.target_roles || []
  const keywords = profile?.hard_filters_json?.cvKeywords || []
  const jobTitle = job?.role_title || job?.roleTitle || ''

  if (!jobTitle) return { score: 5, reason: 'No job title available to compare against target roles' }
  if (targets.length === 0 && keywords.length === 0) {
    return { score: 5, reason: 'No target roles or keywords set in profile; add them for a better match' }
  }

  const jobFamilies = familiesOf(jobTitle)

  let best = 0
  let bestTarget = ''
  let bestConflict = false
  for (const t of targets) {
    const overlap = jaccardOverlapSignificant(jobTitle, t)
    if (overlap > best) {
      best = overlap
      bestTarget = t
      bestConflict = familiesConflict(jobFamilies, familiesOf(t))
    }
  }

  // Also score against all keywords combined
  const keywordStr = keywords.join(' ')
  if (keywordStr) {
    const kwOverlap = jaccardOverlapSignificant(jobTitle, keywordStr) * 0.7
    if (kwOverlap > best) {
      best = kwOverlap
      bestTarget = 'your keywords'
      bestConflict = familiesConflict(jobFamilies, familiesOf(keywordStr))
    }
  }

  // A functional-domain mismatch overrides word overlap — shared modifier
  // words between two different kinds of role are not a real match.
  if (bestConflict) {
    return { score: 3, reason: `"${jobTitle}" shares wording with "${bestTarget}" but is a different type of role; not a real match despite the overlap` }
  }

  if (best >= 0.40) {
    return { score: 10, reason: `"${jobTitle}" is a close match to "${bestTarget}"` }
  } else if (best >= 0.25) {
    return { score: 8, reason: `"${jobTitle}" strongly aligns with your target "${bestTarget}"` }
  } else if (best >= 0.12) {
    return { score: 6, reason: `"${jobTitle}" partially overlaps with "${bestTarget}": some skill match` }
  } else if (best >= 0.04) {
    const shown = targets.slice(0, 2).join(', ') || 'your targets'
    return { score: 4, reason: `"${jobTitle}" has limited overlap with ${shown}` }
  } else {
    const shown = targets.slice(0, 2).join(', ') || 'your targets'
    return { score: 2, reason: `"${jobTitle}" doesn't match ${shown}` }
  }
}

function scoreSeniorityFit(profile, job) {
  const profileSeniority = profile?.seniority || ''
  const jobTitle = job?.role_title || job?.roleTitle || ''

  if (!profileSeniority) return { score: 5, reason: 'No seniority level set in profile; add it for a better match' }
  if (!jobTitle) return { score: 5, reason: 'No job title to assess seniority against' }

  const profileTier = getTierForText(profileSeniority)
  const jobTier = getTierForText(jobTitle)

  const tierLabel = (t) => {
    const entry = SENIORITY_TIERS.find(e => e.tier === t)
    return entry ? entry.keywords[0] : `tier ${t}`
  }

  if (profileTier === null) {
    return { score: 6, reason: `Profile seniority "${profileSeniority}" not mapped; defaulting to neutral` }
  }
  if (jobTier === null) {
    return { score: 6, reason: `Can't determine seniority from "${jobTitle}"; defaulting to neutral` }
  }

  const diff = Math.abs(profileTier - jobTier)

  if (diff === 0) {
    return { score: 10, reason: `Seniority match: "${jobTitle}" is ${tierLabel(jobTier)} level, matching your "${profileSeniority}"` }
  } else if (diff === 1) {
    return { score: 7, reason: `Near-match: role is ${tierLabel(jobTier)}, you target ${tierLabel(profileTier)}: one level apart` }
  } else if (diff === 2) {
    return { score: 4, reason: `Seniority gap: role is ${tierLabel(jobTier)}, you target ${tierLabel(profileTier)}: two levels apart` }
  } else {
    return { score: 1, reason: `Seniority mismatch: role is ${tierLabel(jobTier)}, you target ${tierLabel(profileTier)}` }
  }
}

function scoreLocationFit(profile, job) {
  const maxOfficeDays = profile?.max_office_days ?? null
  const jobLocation = (job?.location || '').toLowerCase()
  const rawText = JSON.stringify(job?.raw_json || {}).toLowerCase().slice(0, 2000)
  const combined = jobLocation + ' ' + rawText

  const isRemote = /\bremote\b/.test(combined)
  const isHybrid = /\bhybrid\b/.test(combined)

  // Extract explicit office day count
  let officeDays = null
  const officePatterns = [
    /(\d)\s*days?\s*(?:per\s*week\s*)?(?:in\s*(?:the\s*)?)?(?:office|onsite|on-?site)/i,
    /(\d)\s*(?:days?|×|x)\s*(?:a\s*week|\/week|pw)\s*(?:in\s*)?(?:office|onsite)/i,
    /office[^.]{0,30}?(\d)\s*days?/i,
  ]
  for (const p of officePatterns) {
    const m = combined.match(p)
    if (m) { officeDays = parseInt(m[1]); break }
  }

  // Infer from WFH days
  if (officeDays === null) {
    const wfhMatch = combined.match(/(\d)\s*days?\s*(?:wfh|work(?:ing)?\s*from\s*home|remote)/i)
    if (wfhMatch) officeDays = Math.max(0, 5 - parseInt(wfhMatch[1]))
  }

  if (maxOfficeDays === null) {
    if (isRemote) return { score: 8, reason: 'Remote role; set max office days in profile for a precise score' }
    if (isHybrid) return { score: 7, reason: 'Hybrid role; set max office days in profile for a precise score' }
    return { score: 6, reason: 'No office day preference set; cannot score location fit precisely' }
  }

  if (isRemote && officeDays === null) {
    return { score: 10, reason: `Fully remote, within your ${maxOfficeDays}-day limit` }
  }

  if (officeDays !== null) {
    const gap = officeDays - maxOfficeDays
    if (gap <= 0) {
      return { score: 10, reason: `${officeDays} office day${officeDays !== 1 ? 's' : ''}/week, within your ${maxOfficeDays}-day limit` }
    } else if (gap === 1) {
      return { score: 6, reason: `${officeDays} office days/week; 1 day over your ${maxOfficeDays}-day limit` }
    } else if (gap === 2) {
      return { score: 3, reason: `${officeDays} office days/week; ${gap} days over your ${maxOfficeDays}-day limit` }
    } else {
      return { score: 1, reason: `${officeDays} office days/week; ${gap} days over your ${maxOfficeDays}-day limit` }
    }
  }

  if (isHybrid) {
    return { score: 7, reason: `Hybrid (days unspecified); likely compatible with your ${maxOfficeDays}-day limit` }
  }

  // UK city with no remote/hybrid signal — assume in-office
  const ukCities = ['london', 'manchester', 'birmingham', 'bristol', 'leeds', 'edinburgh', 'glasgow', 'oxford', 'cambridge', 'reading', 'nottingham', 'sheffield', 'liverpool']
  const hasCity = ukCities.some(c => jobLocation.includes(c))
  if (hasCity) {
    if (maxOfficeDays === 0) return { score: 3, reason: `Office location (${job?.location}); you prefer fully remote` }
    if (maxOfficeDays <= 2) return { score: 5, reason: `Office location (${job?.location}); may require more than your ${maxOfficeDays}-day limit` }
    return { score: 7, reason: `Office location (${job?.location}); likely compatible with your ${maxOfficeDays}-day limit` }
  }

  return { score: 6, reason: 'Location / working arrangement not specified' }
}

function scoreCompFit(profile, job) {
  const floor = profile?.salary_floor ?? null
  const salaryStr = job?.salary || ''

  if (!salaryStr) {
    if (!floor) return { score: 5, reason: 'No salary data; set a salary floor in profile to score compensationrofile for a better match' }
    return { score: 5, reason: `Salary not advertised; can't compare against your £${Math.round(floor / 1000)}k floor` }
  }

  const mid = parseSalaryMidGBP(salaryStr)
  if (!mid) {
    return { score: 5, reason: `Salary listed ("${salaryStr}") but could not be parsed` }
  }

  const midK = Math.round(mid / 1000)

  if (!floor) {
    return { score: 7, reason: `Salary ~£${midK}k; set a salary floor in profile forr a precise match` }
  }

  const floorK = Math.round(floor / 1000)
  const ratio = mid / floor

  if (ratio >= 1.2)  return { score: 10, reason: `Salary ~£${midK}k, well above your £${floorK}k floor` }
  if (ratio >= 1.1)  return { score: 8,  reason: `Salary ~£${midK}k, above your £${floorK}k floor` }
  if (ratio >= 0.97) return { score: 6,  reason: `Salary ~£${midK}k, at your £${floorK}k floor` }
  if (ratio >= 0.85) return { score: 4,  reason: `Salary ~£${midK}k, slightly below your £${floorK}k floor` }
  return               { score: 1,  reason: `Salary ~£${midK}k, significantly below your £${floorK}k floor` }
}

function scoreFreshness(job) {
  const freshness = job?.freshness || null

  // Prefer the stored freshness field (written by cron)
  if (freshness) {
    switch (freshness) {
      case 'Fresh':   return { score: 10, reason: 'Fresh: verified within 48 hours' }
      case 'Aging':   return { score: 7,  reason: 'Aging: posted 2–5 days ago, still active' }
      case 'Stale':   return { score: 3,  reason: 'Stale: posted 5–14 days ago; apply promptly' }
      case 'Expired': return { score: 0,  reason: 'Expired: over 14 days old; may already be filled' }
      default:        return { score: 5,  reason: `Freshness status: ${freshness}` }
    }
  }

  // Fall back to computing from available date fields
  const dateStr = job?.cached_at || job?.first_seen_at || job?.created || null
  if (!dateStr) return { score: 5, reason: 'Freshness unknown; no date information available' }

  const ageMs = Date.now() - new Date(dateStr).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)

  if (ageDays < 2)  return { score: 10, reason: 'Fresh: posted within 48 hours' }
  if (ageDays < 5)  return { score: 7,  reason: `Aging: posted ${Math.round(ageDays)} days ago` }
  if (ageDays < 14) return { score: 3,  reason: `Stale: posted ${Math.round(ageDays)} days ago; apply promptly` }
  return              { score: 0,  reason: `Expired: posted ${Math.round(ageDays)} days ago` }
}

function scoreCultureWlb(profile, job) {
  const tracks = profile?.tracks || (profile?.track ? [profile.track] : [])
  const benefits = profile?.hard_filters_json?.benefits || []

  const jobText = [
    job?.role_title || job?.roleTitle || '',
    job?.location || '',
    JSON.stringify(job?.raw_json || {}).slice(0, 3000),
  ].join(' ').toLowerCase()

  const BENEFIT_KEYWORDS = {
    fully_remote:            ['fully remote', 'remote first', 'remote-first', '100% remote'],
    hybrid:                  ['hybrid', 'flexible working', 'flexible location', 'work from home'],
    four_day_week:           ['4-day week', 'four day week', '4 day week', 'compressed hours'],
    enhanced_parental_leave: ['enhanced parental', 'enhanced maternity', 'enhanced paternity', '26 weeks', 'shared parental'],
    term_time:               ['term time', 'school hours', 'term-time working'],
    share_options:           ['share options', 'equity', 'esop', 'emi options', 'vesting'],
    private_health:          ['private health', 'bupa', 'vitality', 'health insurance', 'private medical'],
  }

  const matched = []
  const concerns = []

  for (const b of benefits) {
    const kws = BENEFIT_KEYWORDS[b] || []
    if (kws.some(kw => jobText.includes(kw))) {
      matched.push(b.replace(/_/g, ' '))
    }
  }

  if (tracks.includes('balanced') || tracks.includes('parent')) {
    const red = ['always-on', 'fast-paced startup', 'high growth startup', 'hustle', '24/7']
    if (red.some(r => jobText.includes(r))) concerns.push('startup/always-on culture signals')
  }

  if (tracks.includes('parent')) {
    if (/parental|maternity|paternity/.test(jobText)) matched.push('parental leave mentioned')
  }

  if (matched.length > 0 && concerns.length === 0) {
    const score = Math.min(10, Math.round((5 + matched.length * 1.5) * 10) / 10)
    return { score, reason: `WLB signals found: ${matched.slice(0, 3).join(', ')}` }
  }
  if (concerns.length > 0 && matched.length === 0) {
    return { score: 3, reason: `Culture concerns: ${concerns.join(', ')}` }
  }
  if (matched.length > 0 && concerns.length > 0) {
    return { score: 5, reason: `Mixed: positive: ${matched.join(', ')}; concerns: ${concerns.join(', ')}` }
  }
  return { score: 5, reason: 'No specific WLB or culture signals found in job details' }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Score a job against a candidate profile.
 *
 * @param {object} profile — Supabase profiles row (target_roles, seniority,
 *   max_office_days, salary_floor, postcode, hard_filters_json, tracks, track)
 * @param {object} job — jobs_cache row OR ad-hoc job object
 *   (role_title, company, location, salary, freshness, raw_json, cached_at)
 * @returns {{ score: number, dimensions: object }}
 */
function scoreMatch(profile, job) {
  const roleFit      = scoreRoleFit(profile, job)
  const seniorityFit = scoreSeniorityFit(profile, job)
  const locationFit  = scoreLocationFit(profile, job)
  const compFit      = scoreCompFit(profile, job)
  const fresh        = scoreFreshness(job)
  const cultureWlb   = scoreCultureWlb(profile, job)

  const weighted =
    roleFit.score      * WEIGHTS.roleFit +
    seniorityFit.score * WEIGHTS.seniorityFit +
    locationFit.score  * WEIGHTS.locationFit +
    compFit.score      * WEIGHTS.compFit +
    fresh.score        * WEIGHTS.freshness +
    cultureWlb.score   * WEIGHTS.cultureWlb

  const score = Math.round(weighted * 10) / 10

  return {
    score,
    dimensions: {
      roleFit,
      seniorityFit,
      locationFit,
      compFit,
      freshness: fresh,
      cultureWlb,
    },
  }
}

module.exports = { scoreMatch }
