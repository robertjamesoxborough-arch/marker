import { createClient } from '@supabase/supabase-js'

// Session O legal hardening: per-source kill switch. Reuses the existing
// admin_feature_flags table (fixed for real access in migration 008, never
// otherwise used) rather than a new one. One row per ingest source; if a
// provider complains, flip enabled=false in the admin CMS and every cron
// checks this before doing anything -- no deploy needed.
//
// Defaults to ENABLED when no row exists for a key, so shipping this cannot
// silently disable a cron that hasn't been given a flag row yet; only an
// explicit enabled:false in the table turns a source off.
export async function isSourceEnabled(sourceKey) {
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data, error } = await service
    .from('admin_feature_flags')
    .select('enabled')
    .eq('flag_key', `source_${sourceKey}`)
    .is('account_id', null)
    .maybeSingle()
  if (error) {
    console.error(`[isSourceEnabled] query failed for ${sourceKey}:`, error.message)
    return true // fail open for a broken flag query -- a real cron still needs to run
  }
  return data ? !!data.enabled : true
}
