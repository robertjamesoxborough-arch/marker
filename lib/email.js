import { Resend } from 'resend'
import { BRAND_NAME } from './brand'

const FROM = `${BRAND_NAME} <onboarding@resend.dev>`

function getResend() {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

function base(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    body{margin:0;padding:0;background:#F5F5EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1A1A1A}
    .wrap{max-width:520px;margin:40px auto;background:#fff;border:1px solid #E0E0D8;border-radius:12px;overflow:hidden}
    .top{background:#1A1A1A;padding:24px 32px;display:flex;align-items:center;gap:6px}
    .logo{font-size:18px;font-weight:500;color:#FAF7F2}
    .body{padding:32px}
    h1{margin:0 0 16px;font-size:20px;font-weight:600;line-height:1.3}
    p{margin:12px 0;line-height:1.6;font-size:15px}
    a{color:#1A1A1A;font-weight:500}
    .btn{display:inline-block;margin:24px 0 8px;padding:12px 24px;background:#1A1A1A;color:#FAF7F2;text-decoration:none;border-radius:8px;font-weight:500}
    .footer{padding:24px 32px;border-top:1px solid #E0E0D8;font-size:13px;color:#666}
  </style></head><body>${content}</body></html>`
}

export async function sendWelcome(email, name) {
  const resend = getResend()
  if (!resend) return { error: 'Resend not configured' }
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Welcome to ${BRAND_NAME}`,
    html: base(`<div class="wrap"><div class="top"><div class="logo">${BRAND_NAME.toLowerCase()}</div></div><div class="body">
      <h1>Welcome${name ? `, ${name}` : ''}.</h1>
      <p>You've got 7 days to test everything — full access, no card required.</p>
      <p>If you run into anything that feels broken or weird, just reply to this email. It goes straight to a human (me).</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://marker-silk.vercel.app'}/app" class="btn">Open ${BRAND_NAME}</a>
    </div><div class="footer">${BRAND_NAME} · AI-powered job hunt for senior people who'd quite like their evenings back.</div></div>`),
  })
}

export async function sendTrialEnding(email, name, daysLeft) {
  const resend = getResend()
  if (!resend) return { error: 'Resend not configured' }
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your trial ends in ${daysLeft} days`,
    html: base(`<div class="wrap"><div class="top"><div class="logo">${BRAND_NAME.toLowerCase()}</div></div><div class="body">
      <h1>Your trial ends in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}.</h1>
      <p>If ${BRAND_NAME}'s been useful, pick a plan before ${daysLeft === 1 ? 'tomorrow' : `${daysLeft} days`}. If not, no worries — your data stays safe for 30 days in case you change your mind.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://marker-silk.vercel.app'}/settings" class="btn">Choose a plan</a>
    </div><div class="footer">${BRAND_NAME}</div></div>`),
  })
}

export async function sendTrialExpired(email, name) {
  const resend = getResend()
  if (!resend) return { error: 'Resend not configured' }
  const first = name ? name.split(' ')[0] : null
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your ${BRAND_NAME} trial has ended`,
    html: base(`<div class="wrap"><div class="top"><div class="logo">${BRAND_NAME.toLowerCase()}</div></div><div class="body">
      <h1>${first ? `${first}, your` : 'Your'} trial has ended.</h1>
      <p>Your free trial is now over. To keep using ${BRAND_NAME} — your job feed, pipeline, and CV tools — choose a plan below.</p>
      <p>Your data is saved and waiting for you if you decide to come back within the next 30 days.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://marker-silk.vercel.app'}/settings" class="btn">Choose a plan</a>
    </div><div class="footer">${BRAND_NAME}</div></div>`),
  })
}
