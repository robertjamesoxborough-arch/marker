import { createClient } from './supabase/client'

// Tracker UI uses 'considering' and 'to_apply'; schema uses 'worth_applying' and 'going_to_apply'
const TO_DB = { considering: 'worth_applying', to_apply: 'going_to_apply' }
const FROM_DB = { worth_applying: 'considering', going_to_apply: 'to_apply' }
const toDbStatus = s => TO_DB[s] || s
const fromDbStatus = s => FROM_DB[s] || s

function parseBreakdown(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return {} }
}

function jobToRow(job, userId, accountId) {
  const bd = parseBreakdown(job.scoreBreakdown)
  return {
    id: job.id,
    user_id: userId,
    account_id: accountId,
    custom_company: job.company || null,
    custom_role: job.roleTitle || null,
    status: toDbStatus(job.status || 'watchlist'),
    score: job.score || null,
    score_breakdown_json: {
      ...bd,
      careersUrl: job.link,
      ranking: job.ranking,
      officeNote: job.officeNote,
      dadFriendly: job.dadFriendly,
      factors: job.factors,
      salary: job.salary,
    },
    signal: job.signal || null,
    signal_reason: job.signalReason || null,
    office_days: job.officeDays ?? null,
    job_link: job.jobLink || null,
    notes: job.jd || null,
    added_at: job.addedAt ? new Date(job.addedAt).toISOString() : null,
    applied_at: job.appliedAt ? new Date(job.appliedAt).toISOString() : null,
    posted_at: job.postedAt ? new Date(job.postedAt).toISOString() : null,
    dead_link_flag: job.deadLink || false,
    cv_effort_level: job.cvEffortLevel || null,
    cv_generated_at: job.cvGeneratedAt ? new Date(job.cvGeneratedAt).toISOString() : null,
  }
}

function rowToJob(row) {
  const bd = row.score_breakdown_json || {}
  return {
    id: row.id,
    company: row.custom_company || '',
    link: bd.careersUrl || '',
    officeDays: row.office_days ?? undefined,
    ranking: bd.ranking ?? 1,
    status: fromDbStatus(row.status),
    lastChecked: row.posted_at ? row.posted_at.split('T')[0] : '',
    jobLink: row.job_link || '',
    roleTitle: row.custom_role || '',
    jd: row.notes || '',
    signal: row.signal || '',
    signalReason: row.signal_reason || '',
    score: row.score || 0,
    scoreBreakdown: JSON.stringify(bd),
    officeNote: bd.officeNote || '',
    addedAt: row.added_at || '',
    appliedAt: row.applied_at || '',
    postedAt: row.posted_at || '',
    dadFriendly: bd.dadFriendly || false,
    factors: bd.factors || null,
    salary: bd.salary || null,
    deadLink: row.dead_link_flag || false,
    cvEffortLevel: row.cv_effort_level || null,
    cvGeneratedAt: row.cv_generated_at || '',
  }
}

async function getContext() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase: null, user: null, accountId: null }

  let { data: userData } = await supabase.from('users').select('default_account_id').eq('id', user.id).single()

  // Auto-provision: user signed in before the schema trigger existed
  if (!userData) {
    const name = user.email.split('@')[0]
    const { data: account } = await supabase
      .from('accounts')
      .insert({ type: 'personal', name, plan: 'free', billing_email: user.email, region: 'uk' })
      .select('id').single()
    if (account) {
      await supabase.from('account_members').insert({ account_id: account.id, user_id: user.id, role: 'owner' })
      await supabase.from('users').insert({
        id: user.id, email: user.email, default_account_id: account.id,
        trial_ends_at: new Date(Date.now() + 7 * 86400000).toISOString()
      })
      await supabase.from('profiles').insert({ user_id: user.id })
      userData = { default_account_id: account.id }
    }
  }

  return { supabase, user, accountId: userData?.default_account_id }
}

export async function loadJobs() {
  const { supabase, user } = await getContext()
  if (!user) return null
  const { data, error } = await supabase
    .from('pipeline_items')
    .select('*')
    .eq('user_id', user.id)
    .order('added_at', { ascending: true })
  if (error || !data) return []
  return data.map(rowToJob)
}

export async function saveJobs(jobs) {
  const { supabase, user, accountId } = await getContext()
  if (!user || !accountId) return
  const rows = jobs.map(j => jobToRow(j, user.id, accountId))
  await supabase.from('pipeline_items').upsert(rows, { onConflict: 'id' })
}

export async function updateJobInDb(job) {
  const { supabase, user, accountId } = await getContext()
  if (!user || !accountId) return
  await supabase.from('pipeline_items').upsert(jobToRow(job, user.id, accountId), { onConflict: 'id' })
}

export async function deleteJobFromDb(id) {
  const { supabase, user } = await getContext()
  if (!user) return
  await supabase.from('pipeline_items').delete().eq('id', id).eq('user_id', user.id)
}

export async function loadFeedFromDb() {
  const { supabase, user } = await getContext()
  if (!user) return []
  const { data } = await supabase
    .from('jobs_cache')
    .select('*')
    .in('source', ['greenhouse', 'gov', 'adzuna'])
    .order('cached_at', { ascending: false })
    .limit(300)
  if (!data) return []
  return data.map(row => ({
    id: row.id,
    company: row.company,
    roleTitle: row.role_title,
    link: row.link,
    salary: row.salary,
    location: row.location,
    source: row.source,
    foundAt: row.cached_at,
    adzunaAttributionRequired: row.adzuna_attribution_required,
    ...(row.raw_json || {}),
  }))
}

export async function loadSalariesFromDb() {
  const { supabase, user } = await getContext()
  if (!user) return {}
  const { data } = await supabase
    .from('pipeline_items')
    .select('id, score_breakdown_json')
    .eq('user_id', user.id)
  if (!data) return {}
  const map = {}
  data.forEach(row => {
    const s = row.score_breakdown_json?.salary
    if (s) map[row.id] = s
  })
  return map
}

export async function saveSalaryToDb(id, salary) {
  const { supabase, user } = await getContext()
  if (!user) return
  const { data: row } = await supabase
    .from('pipeline_items')
    .select('score_breakdown_json')
    .eq('id', id).eq('user_id', user.id).single()
  if (!row) return
  await supabase
    .from('pipeline_items')
    .update({ score_breakdown_json: { ...row.score_breakdown_json, salary } })
    .eq('id', id).eq('user_id', user.id)
}

export async function getProfile() {
  const { supabase, user } = await getContext()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
  return data
}

export async function saveProfile(p) {
  const res = await fetch('/api/profile/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error([err.error, err.code, err.hint, err.details].filter(Boolean).join(' | '))
  }
}
