// NOTE FOR THE NEXT PERSON IN THIS FILE (Stage 74).
// Everything here is a factual description of what the code actually does,
// written to match the audited data flows. Two things are deliberately NOT
// resolved here because they are legal judgements rather than facts, and are
// sitting with counsel:
//   1. The full lawful-basis table. Only the two uncontroversial cases are
//      stated below (contract, for running the service you signed up to;
//      consent, for the optional analytics that are now genuinely gated).
//      Anything resting on legitimate interests needs an LIA and is not
//      asserted here.
//   2. The international transfer mechanism for Anthropic (US). The transfer
//      is disclosed as a fact; the safeguard it relies on is not named,
//      because which mechanism applies is the question counsel is answering.
// Do not paper over either with confident wording. An honest gap is better
// than an invented basis.
//
// Also outstanding: a geographic postal address, required of a distance
// seller. Marked clearly below rather than faked.

const SECTIONS = [
  {
    title: 'Who we are',
    body: 'Requite is a trading name of Robert Oxborough, a sole trader based in the United Kingdom. Requite is the data controller for the personal data described here. You can reach us at support@upstreaminsights.co.uk. A postal address for formal correspondence is being added and will appear here before paid plans go on sale.',
  },
  {
    title: 'What we collect',
    body: 'Your email address, used to create and sign you in to your account. Profile information you give us: your CV text, target roles, seniority, industries, sectors, location or postcode, salary expectations, working preferences and employment status. Your structured career history, which we generate from the CV you paste and which you can edit or delete. Your pipeline: the roles you add, their scores, stages and any notes you write. Records of your use of the AI features, so we can apply the usage limits published on the pricing page. If you subscribe, Stripe handles your payment details; we never see or store your card number. With your consent, aggregated analytics about which pages are used.',
  },
  {
    title: 'What we do with it',
    body: 'We use it to run the service you signed up for: matching and scoring roles against your profile, tailoring CVs and cover letters, preparing interview material, keeping your pipeline, and enforcing the usage limits on your plan. We do not sell your data. We do not share your CV, your profile or your pipeline with employers, recruiters or job boards. We do not use your data to train AI models, and our AI provider does not train on it either under the API terms we use.',
  },
  {
    title: 'Why we are allowed to',
    body: 'For everything needed to run your account and provide the features you asked for, we rely on the contract between us: you cannot have a personalised job-matching service without us processing the profile you give us. For optional analytics and referral attribution we rely on your consent, which you give or refuse on the cookie banner and can change at any time on the Cookie Policy page. Where we rely on consent, refusing it costs you nothing but those optional things.',
  },
  {
    title: 'Who else processes your data',
    body: 'Supabase provides our database and sign-in (data hosted in the EU). Vercel hosts the application and, only with your consent, provides analytics and performance monitoring. Anthropic provides the AI that powers scoring, CV and cover letter generation, interview and negotiation preparation, recruiter search, wishlist suggestions and referral message drafting. Stripe processes payments if you subscribe. Resend sends our transactional email. Each acts on our instructions under contract, and none of them is permitted to use your data for their own purposes.',
  },
  {
    title: 'Data leaving the UK',
    body: 'Anthropic processes data in the United States, so using any AI feature involves an international transfer of the relevant parts of your profile and CV. This is disclosed here as a matter of fact; the safeguard relied on for that transfer is being confirmed with our legal adviser and will be named here once settled. If you would rather nothing left the UK, you can use the pipeline, feed and tracking features without using the AI features at all.',
  },
  {
    title: 'The AI features specifically',
    body: 'When you score a role, generate a CV or cover letter, prepare for an interview, rehearse a negotiation, search for recruiters, generate wishlist suggestions or draft a referral message, the relevant parts of your profile and CV are sent to Anthropic to produce that result. Pasting your CV during onboarding also sends it to Anthropic once, to suggest your roles and seniority. We ask you not to include health, disability or other sensitive details in anything you paste, and our CV parser is instructed never to extract or repeat them.',
  },
  {
    title: 'Your contacts stay on your device',
    body: 'The Referrals feature lets you keep a small address book of people in your own network. That information is stored in your browser and never uploaded to us: we do not hold it, cannot see it, and have nothing to disclose or delete. When you ask for a draft message, that one contact\'s details are sent to our AI provider to write it and are not kept afterwards. Clearing your browser data will delete this address book, because your device is the only place it exists.',
  },
  {
    title: 'How long we keep it',
    body: 'We keep your account data for as long as your account exists. Deleting your account from Settings removes your profile, CV, career history, pipeline, wishlists and usage records, and closes your sign-in. You can also email us to ask for deletion and we will action it within one month. Cached job listings are not personal data and are pruned automatically on their own schedule.',
  },
  {
    title: 'Your rights',
    body: 'Under UK GDPR you have the right to see the personal data we hold about you, to correct it, to have it deleted, to object to or restrict how we use it, to take it elsewhere in a portable form, and to withdraw any consent you have given. You can download most of your data yourself at any time from Settings, and delete your account from the same page. For anything else, email support@upstreaminsights.co.uk. If you are not happy with how we have handled your data you can complain to the Information Commissioner\'s Office at ico.org.uk, or call their helpline on 0303 123 1113. We would rather you told us first so we can put it right.',
  },
  {
    title: 'Cookies and similar storage',
    body: 'We set two cookies to keep you signed in, and store some settings in your browser so the app remembers your preferences. Analytics and referral attribution are optional and load only if you accept them on the banner. Our Cookie Policy lists every item, what it is for, and how long it lasts, and lets you change your choice at any time.',
  },
  {
    title: 'Changes to this notice',
    body: 'If we change how we use your data in a way that affects you, we will tell you by email before it takes effect. The date at the top of this page always reflects the current version.',
  },
  {
    title: 'Contact',
    body: 'For any privacy question, or to exercise any of the rights above: support@upstreaminsights.co.uk.',
  },
]

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px 80px', fontFamily: 'var(--font-body)', color: 'var(--marker-text)', lineHeight: 1.7 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8 }}>Privacy Policy</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', marginBottom: 40 }}>Last updated: September 2026 · Requite</div>

      {SECTIONS.map(({ title, body }) => (
        <div key={title} style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 14 }}>{body}</div>
        </div>
      ))}

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--marker-border)' }}>
        <a href="/" style={{ fontSize: 13, color: 'var(--marker-mid)' }}>← Back to Requite</a>
      </div>
    </div>
  )
}
