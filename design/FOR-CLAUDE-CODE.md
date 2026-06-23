# Marker — Design handoff for Claude Code

This folder is the visual source of truth for Marker. Claude Code should read
`styles.css` (the brand tokens), look at the `.html` and `.jsx` files (the
component patterns), and follow the addendum below.

---

## PASTE THIS INTO YOUR MASTER BUILD PROMPT

Drop it inside `--- BEGIN PROMPT ---` / `--- END PROMPT ---`, immediately
after the "Brand identity (use throughout)" section.

```
## Visual reference (look at this before writing UI)

A finished brand + marketing canvas lives at `~/Desktop/marker/design/`. The
canvas itself is `design/Marker — Brand & Marketing.html`. Open it in a browser
to see every surface laid out — logo, palette, type, voice, website desktop,
website mobile, product UI, ads, marketing assets. It is the source of truth.
If anything in this brief contradicts the canvas, follow the canvas and tell
Rob.

Before writing any UI:
1. Read `design/styles.css` and port the CSS variables verbatim into the
   Marker app's Tailwind config and globals. Do not invent new colour names.
2. Read `design/components/Logo.jsx` and port the wordmark as a real React
   component used everywhere a logo appears.
3. Skim `design/components/WebDesktopHome.jsx` and
   `design/components/ProductMobileUI.jsx` — they show the type scale,
   spacing, and card patterns to repeat.

Specific decisions made during design that override or extend the original
brand spec:

- The wordmark uses a "differentiated final r" rather than a dot above the i
  (there is no i in marker). The signature mark is a small holographic dot
  sitting above the second r. The .holo-dot, .holo-hairline, and .holo-foil
  CSS classes in design/styles.css implement this — copy them verbatim.

- Holographic accent rule: at most ONE holo element per surface. Allowed
  uses: the wordmark dot, a 1px holo hairline as a section divider, or a
  single foil chip. Never as a background wash, never on multiple elements
  in the same view, never on the lime. If a layout cannot honour the
  "at most one" rule, fall back to solid lime.

- Type scale: display headlines run very large (96–124px on desktop hero,
  40–52px on mobile). Body 15–16px Inter. Mono 10–11px JetBrains Mono for
  labels, kickers, and data badges. Tracking -3% on display, -0.5% on body.

- Kickers: monospace, 11px, uppercase, 0.12em letter-spacing, mid-grey.
  Use them above every section heading.

- Score badge: lime background, Space Grotesk 500, 6–8px radius. This is
  the most repeated UI element across the app — build it once as
  <ScoreBadge value={9.2} /> and reuse.

- Editorial copy patterns to use across the product and marketing:
  - "Mark your moves. Skip the rest."
  - "For senior people who'd quite like their evenings back"
  - "The job hunt, marked."
  - "No card. No 'talk to sales'."
  - "Worth applying?" not "Recommended"
  - Status column names exactly: Watchlist / No jobs / Worth applying? /
    Going to apply / Applied / Interviewing / Offer / Rejected

- Marketing surfaces (OG image, email digest header, Product Hunt thumb,
  favicons) are designed in the canvas. When you generate them in code,
  match those layouts.

When you scaffold Tailwind in step 1.2, set the colour palette from
design/styles.css verbatim. Set --font-display: 'Space Grotesk',
--font-body: 'Inter', --font-mono: 'JetBrains Mono' as the only three font
families.
```

---

## File map

- `Marker — Brand & Marketing.html` — open in a browser to see everything
- `styles.css` — brand tokens (CSS vars + holo classes). Port verbatim.
- `components/Logo.jsx` — wordmark component
- `components/BrandFoundation.jsx` — palette, type, voice cards
- `components/Personas.jsx` — Sam / Priya / James audience cards
- `components/WebDesktopHome.jsx` — full desktop homepage layout
- `components/WebMobileHome.jsx` — mobile homepage layout
- `components/ProductMobileUI.jsx` — pipeline kanban UI density reference
- `components/Ads.jsx` — six ad creatives in production sizes
- `components/Marketing.jsx` — OG, email, PH thumb, favicons
