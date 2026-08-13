// Lightweight, zero-cost, zero-API UK geography helper for match-engine.js.
// No external geocoding service — just a static table of major UK cities/
// towns (lat/lon) plus a postcode-outward-code → city mapping, matched
// against free-text location strings the same way lib/uk-eligibility.js
// already matches free-text against its UK_SIGNALS/NON_UK_LOCS lists.
// Deliberately approximate: this is "close enough to rank a feed", not a
// routing engine. Unresolvable locations fall back to neutral (no penalty)
// everywhere this is used — see match-engine.js's scoreLocationFit.

// [name, lat, lon] — city/town centre, good enough for commute-radius ranking.
const UK_CITIES = [
  ['london', 51.5074, -0.1278], ['manchester', 53.4808, -2.2426], ['birmingham', 52.4862, -1.8904],
  ['bristol', 51.4545, -2.5879], ['leeds', 53.8008, -1.5491], ['edinburgh', 55.9533, -3.1883],
  ['glasgow', 55.8642, -4.2518], ['cardiff', 51.4816, -3.1791], ['belfast', 54.5973, -5.9301],
  ['liverpool', 53.4084, -2.9916], ['sheffield', 53.3811, -1.4701], ['newcastle', 54.9783, -1.6178],
  ['nottingham', 52.9548, -1.1581], ['leicester', 52.6369, -1.1398], ['coventry', 52.4068, -1.5197],
  ['brighton', 50.8225, -0.1372], ['cambridge', 52.2053, 0.1218], ['oxford', 51.7520, -1.2577],
  ['reading', 51.4543, -0.9781], ['milton keynes', 52.0406, -0.7594], ['aberdeen', 57.1497, -2.0943],
  ['dundee', 56.4620, -2.9707], ['southampton', 50.9097, -1.4044], ['portsmouth', 50.8198, -1.0880],
  ['plymouth', 50.3755, -4.1427], ['exeter', 50.7184, -3.5339], ['bath', 51.3811, -2.3590],
  ['york', 53.9600, -1.0873], ['norwich', 52.6309, 1.2974], ['ipswich', 52.0567, 1.1482],
  ['derby', 52.9225, -1.4746], ['stoke', 53.0027, -2.1794], ['wolverhampton', 52.5870, -2.1288],
  ['swansea', 51.6214, -3.9436], ['newport', 51.5842, -2.9977], ['luton', 51.8787, -0.4200],
  ['slough', 51.5105, -0.5950], ['guildford', 51.2362, -0.5704], ['woking', 51.3168, -0.5601],
  ['kingston', 51.4085, -0.3064], ['epsom', 51.3336, -0.2679], ['croydon', 51.3762, -0.0982],
  ['watford', 51.6565, -0.3903], ['st albans', 51.7520, -0.3360], ['basingstoke', 51.2668, -1.0876],
  ['maidstone', 51.2704, 0.5227], ['colchester', 51.8959, 0.8919], ['peterborough', 52.5695, -0.2405],
  ['northampton', 52.2405, -0.9027], ['warwick', 52.2823, -1.5849], ['gloucester', 51.8642, -2.2380],
  ['swindon', 51.5558, -1.7797], ['bournemouth', 50.7192, -1.8808], ['blackpool', 53.8175, -3.0357],
  ['preston', 53.7632, -2.7031], ['hull', 53.7676, -0.3274], ['sunderland', 54.9069, -1.3838],
  ['middlesbrough', 54.5742, -1.2350], ['bradford', 53.7960, -1.7594], ['wakefield', 53.6833, -1.4977],
  ['inverness', 57.4778, -4.2247], ['stirling', 56.1165, -3.9369], ['perth', 56.3950, -3.4308],
]

// Postcode outward-code area letters → nearest city, for when the profile
// stores a real postcode ("KT18") rather than a city name ("London"). Only
// the areas likely to appear on a UK job-hunting profile are covered;
// anything else falls through to no-match (neutral, no penalty).
const POSTCODE_AREA_TO_CITY = {
  E: 'london', EC: 'london', N: 'london', NW: 'london', SE: 'london', SW: 'london', W: 'london', WC: 'london',
  BR: 'london', CR: 'london', DA: 'london', EN: 'london', HA: 'london', IG: 'london', KT: 'kingston',
  RM: 'london', SM: 'london', TW: 'london', UB: 'london', WD: 'watford',
  M: 'manchester', SK: 'manchester', OL: 'manchester', BL: 'manchester', WN: 'manchester', WA: 'manchester',
  B: 'birmingham', WV: 'wolverhampton', DY: 'birmingham', WS: 'birmingham', CV: 'coventry',
  BS: 'bristol', BA: 'bath', LS: 'leeds', WF: 'wakefield', BD: 'bradford', HD: 'leeds', HX: 'leeds',
  EH: 'edinburgh', G: 'glasgow', KY: 'edinburgh', ML: 'glasgow', PA: 'glasgow', FK: 'stirling',
  CF: 'cardiff', SA: 'swansea', NP: 'newport', BT: 'belfast',
  L: 'liverpool', CH: 'liverpool', PR: 'preston', FY: 'blackpool', LA: 'preston',
  S: 'sheffield', DN: 'sheffield', NG: 'nottingham', DE: 'derby', LE: 'leicester',
  NE: 'newcastle', SR: 'sunderland', TS: 'middlesbrough', DH: 'newcastle', DL: 'york',
  BN: 'brighton', CB: 'cambridge', OX: 'oxford', RG: 'reading', MK: 'milton keynes',
  AB: 'aberdeen', DD: 'dundee', SO: 'southampton', PO: 'portsmouth', PL: 'plymouth', EX: 'exeter',
  YO: 'york', NR: 'norwich', IP: 'ipswich', ST: 'stoke', SN: 'swindon', BH: 'bournemouth',
  HU: 'hull', LU: 'luton', SL: 'slough', GU: 'guildford', GL: 'gloucester', WR: 'gloucester',
  KT18: 'epsom', PE: 'peterborough', NN: 'northampton', CV1: 'coventry', ME: 'maidstone', CO: 'colchester',
  AL: 'st albans', RH: 'guildford',
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8 // Earth radius, miles
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

// Match free text against the city table — longest name first so "west
// london" doesn't get beaten by a shorter unrelated substring.
function resolveCityFromText(text) {
  const t = (text || '').toLowerCase()
  if (!t) return null
  const sorted = [...UK_CITIES].sort((a, b) => b[0].length - a[0].length)
  for (const [name, lat, lon] of sorted) {
    if (t.includes(name)) return { name, lat, lon }
  }
  return null
}

// A postcode string is either a real UK postcode ("KT18 5LB", "SW1A") or
// just a city name typed into the same field ("London"). Try postcode-area
// extraction first, then fall back to plain city-name matching.
function resolveUserLocation(postcode) {
  const raw = (postcode || '').trim().toUpperCase()
  if (!raw) return null

  // Real postcode outward code: 1-2 letters, optional digit(s), e.g. "KT18", "SW1A", "M1".
  const m = raw.match(/^([A-Z]{1,2})(\d[\dA-Z]?)/)
  if (m) {
    const area = m[1]
    const areaWithDigit = area + m[2][0] // e.g. "KT1" style, for the few multi-digit overrides above
    const cityName = POSTCODE_AREA_TO_CITY[raw.split(/\s/)[0]] || POSTCODE_AREA_TO_CITY[areaWithDigit] || POSTCODE_AREA_TO_CITY[area]
    if (cityName) {
      const city = UK_CITIES.find(c => c[0] === cityName)
      if (city) return { name: city[0], lat: city[1], lon: city[2] }
    }
  }

  // Not postcode-shaped (or area not in the table) — try it as a plain city name.
  return resolveCityFromText(postcode)
}

// Returns null if either side can't be resolved (caller should fall back to
// neutral scoring), otherwise { miles, withinRadius }.
function geoDistance(userPostcode, jobLocationText, radiusMiles) {
  const user = resolveUserLocation(userPostcode)
  if (!user) return null
  const job = resolveCityFromText(jobLocationText)
  if (!job) return null
  const miles = Math.round(haversineMiles(user.lat, user.lon, job.lat, job.lon))
  const radius = Number.isFinite(radiusMiles) && radiusMiles > 0 ? radiusMiles : 50
  return { miles, withinRadius: miles <= radius, userCity: user.name, jobCity: job.name }
}

module.exports = { geoDistance, resolveUserLocation, resolveCityFromText, haversineMiles }
