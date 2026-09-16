// Feature flags for things that are deliberately dormant rather than deleted.

// STAGE 75: employer marketplace dormant.
//
// Requite is provisionally running candidate-pays only, with a permanent free
// tier, and is NOT operating an employer-side work-finding service. The reason
// is legal rather than product: the Conduct of Employment Agencies Regulations
// 2003 reg 26(6) publication exemption that the paid candidate tier may rely
// on is harder to sustain if we both charge candidates AND run an employer
// work-finding service. This is pending confirmation from a solicitor, so the
// employer code, API routes and database tables are all left intact.
//
// Setting this to true restores the employer registration form at /hire and
// the candidate-side Introductions panel on the dashboard. Nothing else was
// removed, so that is the whole of the reversal on the client side.
//
// Note this flag does NOT settle whether the paid candidate features are
// themselves work-finding services under the Employment Agencies Act 1973.
// That is a separate question and it is still open.
export const MARKETPLACE_LIVE = false
