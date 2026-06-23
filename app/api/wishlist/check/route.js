import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'


const KNOWN_SLUGS = {
  'Monzo':                    'monzo',
  'Wise':                     'wise',
  'Checkout.com':             'checkout',
  'HubSpot':                  'hubspot',
  'Multiverse':               'multiverse',
  'Intercom':                 'intercom',
  'Braze':                    'braze',
  'Amplitude':                'amplitude',
  'Mixpanel':                 'mixpanel',
  'Canva':                    'canva',
  'Figma':                    'figma',
  'Notion':                   'notion',
  'Shopify':                  'shopify',
  'Atlassian':                'atlassian',
  'Netflix':                  'netflix',
  'Airbnb':                   'airbnb',
  'Stripe':                   'stripe',
  'Deliveroo':                'deliveroo',
  'SumUp':                    'sumup',
  'GoCardless':               'gocardless',
  'Paysafe':                  'paysafe',
  'Klaviyo':                  'klaviyo',
  'Revolut':                  'revolut',
  'Tide':                     'tide',
  'Elastic':                  'elastic',
  'GitLab':                   'gitlab',
  'Awin':                     'awin',
  'PlayStation / Sony':       'sonyinteractiveentertainmentglobal',
  'Octopus Energy':           'octopusenergy',
  'Gousto':                   'gousto',
  'Smartly':                  'smartly',
  'AdRoll':                   'adroll',
  'Criteo':                   'criteo',
  'Yotpo':                    'yotpo',
  'Phorest':                  'phorest',
  'Segment':                  'segment',
  'Farfetch':                 'farfetch',
  'Palantir':                 'palantir',
  'Bumble':                   'bumble',
  'Adyen':                    'adyen',
  'Funding Circle':           'fundingcircle',
  'Snyk':                     'snyk',
  'Contentful':               'contentful',
  'Miro':                     'miro',
  'Typeform':                 'typeform',
  'Monday.com':               'monday',
  'Zendesk':                  'zendesk',
  'Twilio':                   'twilio',
  'Plaid':                    'plaid',
  'Remote':                   'remote',
  'Deel':                     'deel',
  'Personio':                 'personio',
  'Culture Amp':              'cultureamp',
  'Pendo':                    'pendo',
  'Duolingo':                 'duolingo',
  'Grammarly':                'grammarly',
  'Gong':                     'gong',
  'Asana':                    'asana',
  'Calendly':                 'calendly',
  'Spotify':                  'spotify',
  'Skyscanner':               'skyscanner',
  'Starling Bank':            'starlingbank',
  'Wayve':                    'wayve',
  'OakNorth':                 'oaknorth',
  'Zopa':                     'zopa',
  'Marshmallow':              'marshmallow',
  'Curve':                    'curve',
  'Paddle':                   'paddle',
  'Pleo':                     'pleo',
  'Soldo':                    'soldo',
  'Iwoca':                    'iwoca',
  'Yapily':                   'yapily',
  'Thought Machine':          'thoughtmachine',
  'Tractable':                'tractable',
  'Hopin':                    'hopin',
  'Salesloft':                'salesloft',
  'Bought By Many':           'boughtbymany',
  'Recharge':                 'recharge',
  'Papaya Global':            'papaya',
  'Lottie':                   'lottiefiles',
  'Drift':                    'drift',
  'Gocardless':               'gocardless',
  'Remote.com':               'remote',
}

// Careers page fallbacks for companies NOT on Greenhouse
const CAREERS_URLS = {
  'Google':              'https://careers.google.com',
  'Amazon':              'https://www.amazon.jobs',
  'Microsoft':           'https://careers.microsoft.com',
  'Meta':                'https://www.metacareers.com',
  'Apple':               'https://jobs.apple.com',
  'Goldman Sachs':       'https://www.goldmansachs.com/careers',
  'NatWest Group':       'https://www.natwestgroup.com/careers',
  'Lloyds Banking':      'https://www.lloydsbankinggroup.com/careers',
  'Barclays':            'https://home.barclays/careers',
  'BBC':                 'https://www.bbc.co.uk/careers',
  'Sky':                 'https://careers.sky.com',
  'Channel 4':           'https://jobs.channel4.com',
  'JP Morgan':           'https://careers.jpmorgan.com',
  'Morgan Stanley':      'https://www.morganstanley.com/careers',
  'Aviva':               'https://careers.aviva.co.uk',
  'HSBC':                'https://www.hsbc.com/careers',
  'Deloitte':            'https://www2.deloitte.com/uk/careers',
  'PwC':                 'https://www.pwc.co.uk/careers',
  'EY':                  'https://www.ey.com/en_uk/careers',
  'KPMG':                'https://www.kpmg.com/uk/careers',
  'Accenture':           'https://www.accenture.com/gb-en/careers',
  'McKinsey':            'https://www.mckinsey.com/careers',
  'Capgemini':           'https://www.capgemini.com/gb-en/careers',
  'Vodafone':            'https://careers.vodafone.com',
  'BT Group':            'https://careers.bt.com',
  'Unilever':            'https://careers.unilever.com',
  'GSK':                 'https://jobs.gsk.com',
  'AstraZeneca':         'https://careers.astrazeneca.com',
  'Nationwide':          'https://www.nationwidejobs.co.uk',
  'Octopus':             'https://octopus.energy/careers',
  'Wellcome Trust':      'https://jobs.wellcome.org',
  'Mastercard':          'https://careers.mastercard.com',
  'Visa':                'https://careers.visa.com',
  'PayPal':              'https://careers.pypl.com',
  'Deliveroo':           'https://careers.deliveroo.co.uk',
  'Just Eat':            'https://careers.just-eat.com',
  'Gousto':              'https://www.gousto.co.uk/careers',
  'Diageo':              'https://www.diageo.com/en/careers',
}

const KW = ['partner','marketing','growth','strategy','digital','business develop','programme','program','product market','commercial','brand','content','head of','director','vp ','senior manager','lead','performance','seo','organic','community','comms','communications','social']
const REJECT = ['engineer','software','developer','data sci','data anal','finance','accounting','legal','compliance','fraud','recruiter','talent acq','people ops','security','infrastructure','devops','qa ','customer service rep','sales representative','sales development','sdr ','bdr ','account executive','german speaking','french speaking']

const UK_RE    = /\b(london|uk|england|scotland|wales|remote|hybrid|manchester|edinburgh|bristol|birmingham|leeds|cardiff|belfast|cambridge|oxford|brighton|emea|europe)\b/i
const NON_UK   = /\b(united states|usa|\bus\b|canada|australia|germany|france|netherlands|india|singapore|new york|san francisco|berlin|amsterdam|paris|toronto|sydney|bangalore|warsaw|prague|bucharest|new delhi)\b/i

function isUkRole(location) {
  if (!location || location.trim() === '') return true
  if (NON_UK.test(location)) return false
  return UK_RE.test(location)
}

async function trySlug(slug) {
  try {
    const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`, {
      signal: AbortSignal.timeout(7000),
      headers: { 'User-Agent': 'Marker/1.0' },
    })
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data.jobs) ? data.jobs : null
  } catch { return null }
}

function filterMatch(jobs, slug) {
  return jobs
    .filter(j => {
      const t   = (j.title || '').toLowerCase()
      const loc = (j.location?.name || '').toLowerCase()
      return isUkRole(loc) && KW.some(k => t.includes(k)) && !REJECT.some(r => t.includes(r))
    })
    .slice(0, 10)
    .map(j => ({
      title:    j.title,
      url:      j.absolute_url || `https://boards.greenhouse.io/${slug}/jobs/${j.id}`,
      location: j.location?.name || '',
      updated:  j.updated_at || '',
    }))
}

export async function POST(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body      = await request.json().catch(() => ({}))
  const companies = Array.isArray(body.companies) ? body.companies : []
  if (!companies.length) return NextResponse.json({ results: [] })

  const settled = await Promise.allSettled(
    companies.map(async ({ name, slug }) => {
      const knownSlug  = slug || KNOWN_SLUGS[name]
      const guessSlug  = name.toLowerCase().replace(/[^a-z0-9]/g, '')
      const careersUrl = CAREERS_URLS[name]
        || `https://www.google.com/search?q=${encodeURIComponent(name + ' jobs careers site')}`

      // Try known slug first, then guess
      let jobs = null
      let resolvedSlug = null

      if (knownSlug) {
        jobs = await trySlug(knownSlug)
        if (jobs !== null) resolvedSlug = knownSlug
      }
      if (jobs === null && guessSlug && guessSlug !== knownSlug) {
        jobs = await trySlug(guessSlug)
        if (jobs !== null) resolvedSlug = guessSlug
      }

      if (jobs === null) {
        return { name, status: 'no_board', jobs: [], slug: null, careersUrl }
      }

      const matched = filterMatch(jobs, resolvedSlug)
      return {
        name,
        status:     matched.length > 0 ? 'has_roles' : 'no_roles',
        jobs:       matched,
        slug:       resolvedSlug,
        totalOnBoard: jobs.length,
        careersUrl: `https://boards.greenhouse.io/${resolvedSlug}`,
      }
    })
  )

  const results = settled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    const name       = companies[i]?.name || '?'
    const careersUrl = CAREERS_URLS[name]
      || `https://www.google.com/search?q=${encodeURIComponent(name + ' jobs careers site')}`
    return { name, status: 'no_board', jobs: [], careersUrl }
  })

  return NextResponse.json({ results })
}
