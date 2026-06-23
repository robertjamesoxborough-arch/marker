import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const SEED = [
  // Marketing
  { category: 'marketing', title: 'Pick final tagline from 4 candidates', description: 'Choose between: "Mark your moves." / "Every move, marked." / "The job hunt, marked." / "Find the role worth marking."', status: 'in_progress' },
  { category: 'marketing', title: 'Buy domain', description: 'Priority: marker.work — fallback: getmarker.com or marker.app', status: 'todo' },
  { category: 'marketing', title: 'Set up Plausible analytics', description: 'Privacy-respecting — free tier to start', status: 'todo' },
  { category: 'marketing', title: 'Set up ConvertKit', description: 'Email capture for pre-launch list', status: 'todo' },
  { category: 'marketing', title: 'Create LinkedIn company page', status: 'todo' },
  { category: 'marketing', title: 'Build press list of 50 UK journalists', description: 'Guardian Money, FT Work & Careers, Times Money, BBC Worklife, Sifted, BusinessLive', status: 'todo' },
  { category: 'marketing', title: 'Write 3 SEO cornerstone articles', description: '(1) work-life balance data (2) parental leave benchmarks (3) AI CV tailoring', status: 'todo' },
  { category: 'marketing', title: 'Affiliate programme structure', description: '20% recurring commission for life of customer', status: 'todo' },
  { category: 'marketing', title: 'Submit to Product Hunt, BetaList, Indie Hackers, HN', description: 'Launch week — coordinate timing', status: 'todo' },

  // Legal
  { category: 'legal', title: 'Privacy Policy', description: 'Via SeedLegals or Rocket Lawyer — budget ~£200-500', status: 'todo' },
  { category: 'legal', title: 'Terms of Service', description: 'Customised — budget ~£300-700', status: 'todo' },
  { category: 'legal', title: 'Cookie banner', description: 'Cookiebot free tier or custom', status: 'todo' },
  { category: 'legal', title: 'DPAs signed with all processors', description: 'Supabase, Anthropic, Stripe, Vercel', status: 'todo' },
  { category: 'legal', title: '⚠️ Apply for Adzuna commercial API access', description: 'Email api@adzuna.com — LEGAL BLOCKER for step 3.2 nightly cron', status: 'todo' },
  { category: 'legal', title: 'Verify Adzuna badge on every sourced card', description: 'Min 116×23px — legal requirement', status: 'todo' },
  { category: 'legal', title: 'AI disclaimers in product', description: 'Parental leave factor accuracy, AI-generated CV review, score estimates', status: 'todo' },
  { category: 'legal', title: 'Companies House Ltd registration', status: 'todo' },
  { category: 'legal', title: 'Business bank account', description: 'Separate from personal', status: 'todo' },
  { category: 'legal', title: 'Public liability + professional indemnity insurance', description: 'Hiscox or Superscript', status: 'todo' },
  { category: 'legal', title: 'Right-to-be-forgotten / data export in Settings', status: 'todo' },

  // Product
  { category: 'product', title: 'Track-based feature gating', status: 'in_progress' },
  { category: 'product', title: 'Wishlist tab', status: 'todo' },
  { category: 'product', title: 'CV Generator tab (3 effort levels)', status: 'todo' },
  { category: 'product', title: 'Job Feed tab (Greenhouse + Gov)', status: 'todo' },
  { category: 'product', title: 'Stripe billing integration', status: 'todo' },
  { category: 'product', title: 'Beta launch flow', description: '£7.50/mo for life — promo code, 50 users from LinkedIn', status: 'todo' },
  { category: 'product', title: 'BYO Anthropic key flow', description: 'Encrypt with Supabase Vault — never log', status: 'todo' },

  // Press
  { category: 'press', title: 'Build press list', description: 'Guardian Money, FT, Times, BBC Worklife, Sifted — 50 contacts', status: 'todo' },
  { category: 'press', title: 'PR pitch: Guardian Money', status: 'todo' },
  { category: 'press', title: 'PR pitch: BBC Worklife', status: 'todo' },
  { category: 'press', title: 'PR pitch: FT Work & Careers', status: 'todo' },
  { category: 'press', title: 'PR pitch: Sifted', status: 'todo' },

  // B2B Sales
  { category: 'b2b_sales', title: 'Outreach to 50 UK career coaches', description: '10 emails/week cadence', status: 'todo' },
  { category: 'b2b_sales', title: 'Coach white-label pricing page', description: '£49/mo + £6/client (Pro) · £149/mo + £5/client (Agency)', status: 'todo' },
  { category: 'b2b_sales', title: 'Outreach to 20 outplacement firms', status: 'todo' },
  { category: 'b2b_sales', title: 'University careers services outreach', description: '30 UK universities', status: 'todo' },
]

async function getAdminUser(cookieStore) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL || 'robertjamesoxborough@gmail.com'
  if (!user || user.email !== adminEmail) return null
  return user
}

function service() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function GET() {
  const cookieStore = await cookies()
  if (!await getAdminUser(cookieStore)) return NextResponse.json({ error: 'Forbidden' }, { status: 401 })

  const sb = service()
  let { data, error } = await sb.from('admin_todos').select('*').order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Seed on first load
  if (!data || data.length === 0) {
    const { data: seeded } = await sb.from('admin_todos').insert(SEED).select()
    data = seeded || []
  }

  return NextResponse.json(data)
}

export async function POST(request) {
  const cookieStore = await cookies()
  if (!await getAdminUser(cookieStore)) return NextResponse.json({ error: 'Forbidden' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await service()
    .from('admin_todos')
    .insert({ category: body.category, title: body.title, description: body.description || null, status: 'todo' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request) {
  const cookieStore = await cookies()
  if (!await getAdminUser(cookieStore)) return NextResponse.json({ error: 'Forbidden' }, { status: 401 })

  const body = await request.json()
  const updates = {}
  if (body.status) {
    updates.status = body.status
    if (body.status === 'done') updates.completed_at = new Date().toISOString()
    else updates.completed_at = null
  }
  if (body.title) updates.title = body.title

  const { data, error } = await service()
    .from('admin_todos')
    .update(updates)
    .eq('id', body.id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request) {
  const cookieStore = await cookies()
  if (!await getAdminUser(cookieStore)) return NextResponse.json({ error: 'Forbidden' }, { status: 401 })

  const { id } = await request.json()
  const { error } = await service().from('admin_todos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
