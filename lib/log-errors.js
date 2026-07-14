// Shared helper for the class of bug that let jobs_cache/wishlists/ai_usage
// fail silently: `const { data } = await service.from(X)...` discards
// `error`, so a permission failure (missing GRANT, RLS block) reads exactly
// like a legitimate empty result. Call this on every Supabase response
// where an empty/null result would otherwise be indistinguishable from a
// real failure -- it costs one line and makes the failure visible in
// Vercel logs instead of invisible.
export function logIfError(label, result) {
  if (result?.error) {
    console.error(`[supabase] ${label} failed:`, result.error.message)
  }
  return result
}
