// Shared UK-eligibility filter for every feed ingest source (cron/adzuna,
// cron/gov, cron/contract, cron/ats, and the feed-web/feed-gov/contractor-
// roles live fresh-scan paths). Ported from the personal tracker's
// app/lib/feeds.js — same allowlist-wins logic, proven against real Adzuna
// location strings there.

// Positive signals that a role is UK-based (or UK-inclusive). Any of these → eligible.
const UK_SIGNALS = ['united kingdom', ' uk', 'uk)', 'uk,', 'uk ', 'u.k', 'great britain', 'britain', 'england',
  'scotland', 'wales', 'northern ireland', 'london', 'manchester', 'birmingham', 'bristol', 'leeds',
  'glasgow', 'edinburgh', 'cardiff', 'belfast', 'liverpool', 'sheffield', 'newcastle', 'nottingham',
  'leicester', 'coventry', 'brighton', 'cambridge', 'oxford', 'reading', 'milton keynes', 'aberdeen', 'dundee']

// Comprehensive non-UK blocklist. Full country names + major cities + US/CA states, across all regions.
const NON_UK_LOCS = [
  // USA
  // 'new york' and 'portland' deliberately excluded from this US-city list — self-test against
  // real jobs_cache found both are genuine English place names (New York, a hamlet near Lincoln;
  // the Isle of Portland, Dorset), so as bare strings they produced real false-negatives here.
  // Not an issue for the personal tracker this pattern was ported from (no Marker/UK-wide feed
  // ever surfaced either place), but Marker's broader company/location coverage does.
  'united states', 'usa', 'u.s.a', ', us', 'us-', 'us only', 'americas', 'san francisco', 'los angeles',
  'chicago', 'boston', 'seattle', 'austin', 'denver', 'atlanta', 'dallas', 'houston', 'miami',
  'phoenix', 'philadelphia', 'san diego', 'san jose', 'washington', 'minneapolis', 'detroit', 'nashville',
  'charlotte', 'raleigh', 'columbus', 'indianapolis', 'las vegas', 'pittsburgh', 'tampa', 'orlando', 'salt lake',
  'california', 'texas', 'florida', 'new jersey', 'virginia', 'illinois', 'colorado', 'arizona', 'massachusetts',
  'pennsylvania', 'michigan', 'north carolina', 'oregon', 'georgia,', 'georgia (us',
  // Canada
  'canada', 'toronto', 'vancouver', 'montreal', 'ottawa', 'calgary', 'edmonton', 'winnipeg', 'ontario', 'quebec',
  // Europe (non-UK)
  'ireland', 'dublin', 'cork', 'galway', 'france', 'paris', 'lyon', 'germany', 'berlin', 'munich', 'frankfurt',
  'hamburg', 'cologne', 'stuttgart', 'dusseldorf', 'netherlands', 'amsterdam', 'rotterdam', 'utrecht', 'eindhoven',
  'belgium', 'brussels', 'antwerp', 'spain', 'madrid', 'barcelona', 'valencia', 'portugal', 'lisbon', 'porto',
  'italy', 'milan', 'rome', 'turin', 'switzerland', 'zurich', 'geneva', 'austria', 'vienna', 'poland', 'warsaw',
  'krakow', 'czech', 'prague', 'sweden', 'stockholm', 'norway', 'oslo', 'denmark', 'copenhagen', 'finland',
  'helsinki', 'luxembourg', 'greece', 'athens', 'romania', 'bucharest', 'hungary', 'budapest', 'bulgaria', 'sofia',
  'estonia', 'tallinn', 'lithuania', 'vilnius', 'latvia', 'riga', 'ukraine', 'kyiv',
  'serbia', 'belgrade', 'croatia', 'zagreb', 'slovenia', 'ljubljana', 'slovakia', 'bratislava',
  'bosnia', 'sarajevo', 'north macedonia', 'skopje', 'albania', 'tirana', 'montenegro', 'moldova', 'chisinau',
  'georgia (country)', 'tbilisi', 'armenia', 'yerevan', 'turkey', 'istanbul', 'ankara', 'cyprus', 'nicosia', 'malta', 'valletta', 'iceland', 'reykjavik',
  // Middle East / Africa
  'dubai', 'abu dhabi', 'uae', 'qatar', 'doha', 'riyadh', 'saudi', 'israel', 'tel aviv', 'egypt', 'cairo',
  'south africa', 'johannesburg', 'cape town', 'nigeria', 'lagos', 'kenya', 'nairobi',
  // APAC
  'singapore', 'hong kong', 'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'australia', 'new south wales',
  'new zealand', 'auckland', 'wellington', 'japan', 'tokyo', 'china', 'shanghai', 'beijing', 'shenzhen',
  'south korea', 'seoul', 'taiwan', 'taipei', 'thailand', 'bangkok', 'philippines', 'manila', 'indonesia',
  'jakarta', 'malaysia', 'kuala lumpur', 'vietnam', 'hanoi', 'ho chi minh', 'india', 'mumbai', 'bangalore',
  'bengaluru', 'new delhi', 'delhi', 'hyderabad', 'chennai', 'pune', 'kolkata', 'gurgaon', 'noida',
  // Latin America
  'brazil', 'sao paulo', 'mexico', 'argentina', 'buenos aires', 'chile', 'santiago', 'colombia', 'bogota',
]

function isUkEligible(location = '') {
  const loc = (location || '').toLowerCase().trim()
  if (!loc) return true
  // "Remote" pinned to a non-UK region (e.g. "Remote - US", "Remote (Americas)") → not eligible.
  if (/remote[^a-z]{0,4}(us|u\.s|usa|united states|americas|apac|emea only|canada|australia|india|germany|france|europe only|eu only)\b/.test(loc)) return false
  // Any explicit UK signal wins — even "London or New York" keeps the UK option.
  if (UK_SIGNALS.some(s => loc.includes(s))) return true
  // Bare "remote" with no foreign place named → treat as UK-eligible (feeds are GB-scoped).
  if (/\bremote\b/.test(loc) && !NON_UK_LOCS.some(n => loc.includes(n))) return true
  // Names a non-UK place → reject.
  if (NON_UK_LOCS.some(n => loc.includes(n))) return false
  // Ambiguous with no foreign signal (e.g. "EMEA", "Global") → keep.
  return true
}

module.exports = { isUkEligible }
