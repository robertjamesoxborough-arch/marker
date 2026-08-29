// Builds the query set for the shared nightly Adzuna ingest (cron/adzuna).
// Cost Guardrails RULE 1 says this must stay nightly + shared, never scale
// per-user-per-click — but a FIXED query list baked to one sector (the
// original 15 were all marketing/product/tech) means the shared cache can
// structurally never contain roles for anyone else, regardless of who
// signs up. This still runs once, in one nightly batch, budget-gated via
// lib/adzuna-budget.js — it just widens what that one batch covers:
// a broadened static floor (bounded, always run) PLUS real distinct
// target_roles pulled from actual user profiles (bounded + deduped against
// the floor), so coverage grows with genuine demand instead of guesswork.
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

// A distinct target_roles value already covered by the static floor
// (either direction of substring) is skipped so the same demand isn't
// queried twice.
function alreadyCovered(role, base) {
  const r = role.toLowerCase()
  return base.some(b => r.includes(b.what) || b.what.includes(r))
}

export async function buildAdzunaRoleQueries(supabase, { extraCap = 20, rowLimit = 500 } = {}) {
  const queries = [...BASE_ROLE_QUERIES]
  try {
    const { data: rows } = await supabase
      .from('profiles')
      .select('target_roles')
      .not('target_roles', 'is', null)
      .limit(rowLimit)

    const seen = new Set(queries.map(q => q.what))
    const extra = []
    for (const row of (rows || [])) {
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
