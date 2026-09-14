// Builds query sets for the shared nightly Adzuna ingests (cron/adzuna,
// cron/contract). Cost Guardrails RULE 1 says this must stay nightly +
// shared, never scale per-user-per-click — but a FIXED query list baked to
// one sector (the original 15 in the main feed were all marketing/product/
// tech) means the shared cache can structurally never contain roles for
// anyone else, regardless of who signs up. This still runs once, in one
// nightly batch, budget-gated via lib/adzuna-budget.js — it just widens
// what that one batch covers: a broadened static floor (bounded, always
// run) PLUS real distinct target_roles pulled from actual user profiles
// (bounded + deduped against the floor), so coverage grows with genuine
// demand instead of guesswork.
// Stage 70 — Adzuna's OWN category taxonomy (GET /v1/api/jobs/gb/categories,
// confirmed live), used for a genuinely profession-agnostic breadth sweep.
// This is NOT another hand-picked list like BASE_ROLE_QUERIES above: it is
// Adzuna's complete, Adzuna-maintained set of sectors, queried by CATEGORY
// with no "what" text filter at all, so no profession has to be named,
// typed, or anticipated by anyone at Requite for its sector to be covered.
// Confirmed live (Stage 70 diagnosis) that Adzuna itself carries huge real
// volume for professions the fixed floor above never thought to ask for —
// 27,178 "management accountant" listings, 24,003 "primary teacher", 8,173
// "plumber", 27,583 "care worker" — all invisible to the app before this,
// purely because the nightly batch never queried for them, not because
// Adzuna lacked the data. 'unknown' is excluded (it is Adzuna's literal
// uncategorised-junk bucket, not a real sector); every other category
// Adzuna reports is queried, in full, every night — no editorial picking.
export const ADZUNA_CATEGORIES = [
  'accounting-finance-jobs', 'it-jobs', 'sales-jobs', 'customer-services-jobs',
  'engineering-jobs', 'hr-jobs', 'healthcare-nursing-jobs', 'hospitality-catering-jobs',
  'pr-advertising-marketing-jobs', 'logistics-warehouse-jobs', 'teaching-jobs',
  'trade-construction-jobs', 'admin-jobs', 'legal-jobs', 'creative-design-jobs',
  'graduate-jobs', 'retail-jobs', 'consultancy-jobs', 'manufacturing-jobs',
  'scientific-qa-jobs', 'social-work-jobs', 'travel-jobs', 'energy-oil-gas-jobs',
  'property-jobs', 'charity-voluntary-jobs', 'domestic-help-cleaning-jobs',
  'maintenance-jobs', 'part-time-jobs', 'other-general-jobs',
]

export const BASE_ROLE_QUERIES = [
  { what: 'partnerships manager',         family: 'Partnerships' },
  { what: 'business development manager', family: 'BD' },
  { what: 'product marketing manager',    family: 'Product Marketing' },
  { what: 'growth manager',               family: 'Growth' },
  { what: 'product manager',              family: 'Product Management' },
  { what: 'programme manager',            family: 'Programme Lead' },
  { what: 'digital strategy manager',     family: 'Digital Strategy' },
  { what: 'data analyst',                 family: 'Data' },
  { what: 'software engineer',            family: 'Engineering' },
  { what: 'UX designer',                  family: 'Design' },
  { what: 'operations manager',           family: 'Ops' },
  { what: 'customer success manager',     family: 'Customer Success' },
  { what: 'marketing manager',            family: 'Marketing Generalist' },
  { what: 'head of partnerships',         family: 'Partnerships' },
  { what: 'head of product',              family: 'Product Management' },
  // Widened beyond the original marketing/tech-only floor.
  { what: 'registered nurse',             family: 'Clinical Nursing' },
  { what: 'clinical nurse specialist',    family: 'Clinical Nursing' },
  { what: 'secondary school teacher',     family: 'Education' },
  { what: 'head teacher',                 family: 'Education' },
  { what: 'qualified electrician',        family: 'Electrical Trades' },
  { what: 'accountant',                   family: 'Accountancy' },
  { what: 'solicitor',                    family: 'Legal' },
  { what: 'social worker',                family: 'Social Work' },
  { what: 'physiotherapist',              family: 'Allied Health' },
]

// cron/contract's floor (Stage 68 fix) — this was a FIXED, closed list of
// 14 white-collar interim/contract roles with zero widening at all, unlike
// the main feed above: a contractor in any field not on this list (an
// interim ward sister, an interim farm manager, a locum anything) got zero
// contract-feed coverage regardless of what they actually typed as their
// target role, purely because this file never read profiles.target_roles.
// Same fix as the main feed: keep the floor as a bootstrap, widen with real
// contractor-mode target_roles.
export const CONTRACT_BASE_ROLE_QUERIES = [
  { what: 'interim finance director',     family: 'Finance' },
  { what: 'interim CFO',                  family: 'Finance' },
  { what: 'interim programme manager',    family: 'Programme Lead' },
  { what: 'contract project manager',     family: 'Project Management' },
  { what: 'interim HR director',          family: 'HR' },
  { what: 'interim marketing director',   family: 'Marketing' },
  { what: 'interim operations director',  family: 'Ops' },
  { what: 'interim change manager',       family: 'Change & Transformation' },
  { what: 'contract business analyst',    family: 'Business Analysis' },
  { what: 'contract software engineer',   family: 'Engineering' },
  { what: 'day rate product manager',     family: 'Product Management' },
  { what: 'interim head of digital',      family: 'Digital' },
  { what: 'freelance creative director',  family: 'Creative' },
  { what: 'fixed term marketing manager', family: 'Marketing' },
]

// A distinct target_roles value already covered by the floor (either
// direction of substring) is skipped so the same demand isn't queried twice.
function alreadyCovered(role, base) {
  const r = role.toLowerCase()
  return base.some(b => r.includes(b.what) || b.what.includes(r))
}

// Shared widening loop: `base` is a bootstrap floor (bounded, always run);
// real distinct target_roles are pulled from every profile that passes
// `matchesProfile(hard_filters_json)` and appended, deduped against the
// floor, capped at extraCap. `matchesProfile` defaults to "every profile"
// (the main feed's behaviour); cron/contract passes a contractor-only
// filter so its widening only reflects contractor-mode users' own roles.
async function widenRoleQueries(supabase, base, { extraCap = 20, rowLimit = 500, matchesProfile = () => true } = {}) {
  const queries = [...base]
  try {
    const { data: rows } = await supabase
      .from('profiles')
      .select('target_roles, hard_filters_json')
      .not('target_roles', 'is', null)
      .limit(rowLimit)

    const seen = new Set(queries.map(q => q.what))
    const extra = []
    for (const row of (rows || [])) {
      if (!matchesProfile(row.hard_filters_json || {})) continue
      for (const role of (row.target_roles || [])) {
        const clean = String(role || '').trim().toLowerCase()
        if (!clean || clean.length < 3 || seen.has(clean)) continue
        if (alreadyCovered(clean, queries)) continue
        seen.add(clean)
        extra.push({ what: clean, family: 'user-derived' })
        if (extra.length >= extraCap) break
      }
      if (extra.length >= extraCap) break
    }
    queries.push(...extra)
  } catch {
    // Aggregation is a pure enhancement — if it fails for any reason, the
    // broadened static floor above still runs.
  }
  return queries
}

export async function buildAdzunaRoleQueries(supabase, opts = {}) {
  return widenRoleQueries(supabase, BASE_ROLE_QUERIES, opts)
}

// Same derivation as app/api/wishlist/generate/route.js and every other
// contractor-mode check in this codebase: searchMode wins when set,
// otherwise fall back to the older openToContract boolean.
function isContractorProfile(hfj) {
  const searchMode = hfj.searchMode || (hfj.openToContract === true ? 'both' : 'perm')
  return searchMode === 'contractor' || searchMode === 'both'
}

export async function buildContractRoleQueries(supabase, opts = {}) {
  return widenRoleQueries(supabase, CONTRACT_BASE_ROLE_QUERIES, { ...opts, matchesProfile: isContractorProfile })
}
