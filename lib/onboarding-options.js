// Single source of truth for the onboarding + settings dropdowns.
// Previously app/onboard/page.js and app/settings/page.js each kept their
// own copy of PROFESSIONAL_FIELDS / ROLE_FAMILIES / SALARY_FLOOR_OPTIONS —
// they drifted (settings' role list used different labels, e.g. "BD"
// instead of "Business Development", and never got the healthcare/
// education/trades widening onboarding's CV parser already has). Importing
// from here keeps both pages — and profile/save/route.js's server-side
// salary validation — looking at the same values.

// Fixed dropdown, not free text — a free-text £-value field caused a real
// data bug (85 typed where "85" meant 85k, stored as £85,000,000; see
// PROGRESS.md Stage 44 #9 / Stage 45 #9). Values are in whole £k, matching
// how the rest of the app displays and reasons about salary_floor.
export const SALARY_FLOOR_OPTIONS = [50, 60, 70, 80, 90, 100, 120, 150]

export const PROFESSIONAL_FIELDS = [
  'Software/IT', 'Data/Analytics', 'Product', 'Design/UX', 'Marketing',
  'Sales/BD', 'Partnerships', 'Operations', 'Finance/Accounting', 'HR/People',
  'Legal', 'Customer Success/Support', 'Engineering (non-software)',
  'Healthcare/Clinical', 'Education/Academia', 'Public sector/Policy',
  'Project/Programme Management', 'Consulting', 'Other',
]

// Role-family chip suggestions, keyed by the professional field(s) the user
// picked in Step 3. Previously this was one flat list shown to everyone
// regardless of field — 100% marketing/tech/office titles — so a nurse or
// electrician saw nothing relevant and had to rely on free text or the AI
// CV parser. Each field maps to the subset of families that are actually
// suggestions for that field; a user who picks multiple fields sees the
// union. Labels are preserved exactly where they already existed so
// previously-saved target_roles values keep matching a real chip.
export const ROLE_FAMILIES_BY_FIELD = {
  'Software/IT': ['Engineering', 'Digital Strategy', 'Product Management', 'Business Analysis'],
  'Data/Analytics': ['Data / Analytics', 'Business Analysis'],
  'Product': ['Product Management', 'Product Marketing', 'Digital Strategy', 'Business Analysis', 'Growth'],
  'Design/UX': ['Design / UX', 'Product Design'],
  'Marketing': ['Marketing Generalist', 'Product Marketing', 'Content Marketing', 'Brand & Comms', 'Paid Media / Demand Gen', 'SEO / Organic', 'CRM / Lifecycle', 'Social Media', 'Comms / PR', 'Growth'],
  'Sales/BD': ['Business Development', 'Sales Generalist', 'Account Management', 'Revenue / Sales Ops', 'Growth'],
  'Partnerships': ['Partnerships', 'Business Development'],
  'Operations': ['Operations Generalist', 'Procurement', 'Programme Lead'],
  'Finance/Accounting': ['Finance Generalist', 'FP&A', 'Procurement'],
  'HR/People': ['HR Generalist', 'Talent Acquisition', 'People Ops', 'L&D'],
  'Legal': ['Legal'],
  'Customer Success/Support': ['Customer Success', 'Community & Events'],
  'Engineering (non-software)': ['Electrician', 'Plumber', 'Gas Engineer', 'Mechanical Engineer', 'Electrical Engineer', 'Civil Engineer', 'Building Services Engineer', 'Maintenance Engineer', 'Site Manager'],
  'Healthcare/Clinical': ['Registered Nurse', 'Advanced Nurse Practitioner', 'Healthcare Assistant', 'Physiotherapist', 'Paramedic', 'GP', 'Clinical Lead', 'Occupational Therapist', 'Pharmacist'],
  'Education/Academia': ['Classroom Teacher', 'Head of Department', 'Deputy Head', 'Headteacher', 'Teaching Assistant', 'SENCO', 'Lecturer'],
  'Public sector/Policy': ['Policy & Public Affairs', 'Programme Lead', 'Civil Servant'],
  'Project/Programme Management': ['Programme Lead', 'Project Management', 'Business Analysis'],
  'Consulting': ['Strategy & Consulting'],
}

// Rotating example copy for onboarding + settings placeholders (Stage 68).
// A fixed example — even a "widened" one like "Ward Sister, Secondary
// School Teacher, Qualified Electrician" everywhere — still reads as THE
// scope of the product to whoever it never matches. Deliberately spans
// clinical, trades, legal, education, hospitality, logistics, retail and
// marketing/office work, and rotates by day of week (same low-tech, no-
// hydration-risk convention as shared.js's DAILY_INSIGHTS) so no single
// field is ever the one everyone sees.
export function dailyPick(list) {
  return list[new Date().getDay() % list.length]
}

export const JOB_TITLE_EXAMPLE_SETS = [
  ['Warehouse Operations Manager', 'Registered Nurse', 'Corporate Solicitor'],
  ['Secondary School Teacher', 'Site Electrician', 'Financial Controller'],
  ['Head Chef', 'Quantity Surveyor', 'HR Business Partner'],
  ['Ward Sister', 'HGV Fleet Supervisor', 'Product Marketing Manager'],
  ['Retail Store Manager', 'Structural Engineer', 'Paralegal'],
  ['Deputy Head Teacher', 'Electrical Contractor', 'Management Accountant'],
  ['Restaurant General Manager', 'Occupational Therapist', 'Supply Chain Analyst'],
]

export const CAREER_SUMMARY_EXAMPLES = [
  '8 years in retail operations, most recently Store Manager for a national chain. Looking for an area or regional management role.',
  '12 years in acute nursing, most recently a Senior Sister role in an NHS trust. Looking for an advanced practice or clinical leadership role.',
  '6 years as a qualified electrician, currently running my own contracting business. Looking for a site supervisor or facilities management role.',
  '10 years in corporate law, most recently a Senior Associate at a City firm. Looking for a Legal Counsel or Head of Legal role in-house.',
  '15 years teaching secondary school science, most recently Head of Department. Looking for a Deputy Head or curriculum leadership role.',
  '9 years in hospitality management, most recently General Manager of a 120-cover restaurant. Looking for a multi-site operations role.',
  '7 years in logistics and supply chain, most recently a Warehouse Operations Manager for a national distributor. Looking for a regional logistics role.',
]

// Each entry is one coherent example person (title/skills/highlight belong
// together), rotated as a set so the mini quick-profile-build form never
// shows three fields all pointing at the same profession.
export const QUICK_PROFILE_EXAMPLES = [
  { title: 'Senior Sister at an NHS trust', skills: 'clinical leadership, triage, staff training', highlight: 'Cut ward incident rate by a third' },
  { title: 'Site Electrician at a commercial contractor', skills: 'fault finding, compliance testing, apprentice supervision', highlight: 'Delivered a £2m rewire project two weeks early' },
  { title: 'General Manager at a 120-cover restaurant', skills: 'P&L ownership, rota planning, supplier negotiation', highlight: 'Grew covers 30% year on year' },
  { title: 'Senior Associate at a City law firm', skills: 'contract negotiation, due diligence, client management', highlight: 'Led due diligence on a £40m acquisition' },
  { title: 'Warehouse Operations Manager at a national distributor', skills: 'inventory control, team leadership, H&S compliance', highlight: 'Cut pick-and-pack errors by 22%' },
  { title: 'Head of Growth at a Series B startup', skills: 'paid acquisition, lifecycle marketing, brand strategy', highlight: 'Doubled qualified pipeline in 9 months' },
  { title: 'Head of Department at a secondary school', skills: 'curriculum design, staff mentoring, exam strategy', highlight: 'Raised department GCSE pass rate by 15 points' },
]

// Flattened, deduped union of every family above — used as the fallback
// when no field is selected yet (or only "Other"), and as the master set
// for detecting genuinely custom/CV-derived role strings.
export const ROLE_FAMILIES = [...new Set(Object.values(ROLE_FAMILIES_BY_FIELD).flat())]

// Previously app/onboard/page.js and app/settings/page.js each kept their
// own copy of SENIORITIES too, and they'd already drifted: onboard's
// vp_plus label read "VP / C-Suite", settings' read "VP+" for the same id.
// Settings also never carried the `desc` field onboard uses as a tooltip.
// Unified on onboard's fuller version (desc is simply unused by settings'
// render, which only reads .id/.label).
export const SENIORITIES = [
  { id: 'ic',             label: 'Individual Contributor', desc: 'No direct reports. Specialist, analyst, or coordinator level.' },
  { id: 'manager',        label: 'Manager',                desc: 'Leads a small team of 2–8 people, often still hands-on.' },
  { id: 'senior_manager', label: 'Senior Manager',         desc: 'Leads a larger team or owns a sub-function. Usually 8+ years.' },
  { id: 'head',           label: 'Head of',                desc: 'Owns an entire function and its budget. Reports into Director or C-suite.' },
  { id: 'director',       label: 'Director',               desc: 'Department lead with strategic and commercial accountability.' },
  { id: 'vp_plus',        label: 'VP / C-Suite',           desc: 'Executive or near-executive. Usually 15+ years.' },
]

export const INDUSTRIES = [
  'Fintech', 'SaaS', 'Gaming', 'Martech', 'Retail Tech', 'Media',
  'EdTech', 'HealthTech', 'Public Sector', 'Charity / Non-profit',
  'Consumer Goods', 'Professional Services', 'Other',
]

// Role-family chips to show for the given selected field(s). Falls back to
// the full master list when fields is empty or maps to nothing (e.g. only
// "Other" picked) so the picker is never empty before a field is chosen.
export function visibleRoleFamilies(fields) {
  const mapped = [...new Set((fields || []).flatMap(f => ROLE_FAMILIES_BY_FIELD[f] || []))]
  return mapped.length > 0 ? mapped : ROLE_FAMILIES
}
