/**
 * lib/message-lint.test.js — run with `node lib/message-lint.test.js`.
 * Covers the Stage 82 additions (corporate-jargon "positioning memo"
 * tells, added for the cover-letter generator) alongside the pre-existing
 * AI-tell phrases and the em-dash check.
 */
const { lintMessage, AI_TELL_PHRASES } = require('./message-lint')

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✅ ' + msg) }
  else { console.log('  ❌ ' + msg); failures++ }
}

console.log('Message lint — self-test\n')

console.log('Em dash')
assert(lintMessage('This is fine — or is it').ok === false, 'an em dash fails the lint')
assert(lintMessage('This is fine, or is it').ok === true, 'no em dash passes')

console.log('\nPre-existing AI-tell phrases still caught')
assert(lintMessage('Let me delve into this').ok === false, '"delve" still fails')
assert(lintMessage('A truly robust solution').ok === false, '"robust" still fails')

console.log('\nStage 82 corporate-jargon additions')
const corporateExamples = [
  'This role plays to our go-to-market discipline.',
  'A strong commercial signal for the category.',
  'Understanding the category narrative here matters.',
  'I bring a clear value proposition to the team.',
  'This is squarely in my core competency.',
  'Addressing this strategic imperative directly.',
  'I track market dynamics closely.',
  'Growth is our north star.',
  'I want to move the needle on this.',
  'A best-in-class approach to the problem.',
  'A world-class team doing this work.',
  'This is a mission-critical initiative.',
  'I have a proven track record in this space.',
  'I bring genuine thought leadership.',
  'This role is squarely in my wheelhouse.',
  'I can hit the ground running.',
  'Sitting at the intersection of product and growth.',
  'I want to drive impact for the team.',
  'I want to drive value for the team.',
]
for (const text of corporateExamples) {
  const result = lintMessage(text)
  assert(result.ok === false, `flags: "${text}"`)
}

console.log('\nA genuinely plain, human sentence passes clean')
const humanExample = "I read your job description twice because the problem you're describing, getting a technical product in front of non-technical buyers, is one I've spent the last three years on. I'd like to help you solve it."
const humanResult = lintMessage(humanExample)
assert(humanResult.ok === true, `plain human writing passes: issues=${JSON.stringify(humanResult.issues)}`)

console.log('\nAI_TELL_PHRASES sanity')
assert(Array.isArray(AI_TELL_PHRASES) && AI_TELL_PHRASES.length > 20, 'the phrase list is a real, sizeable array')
assert(AI_TELL_PHRASES.includes('go-to-market discipline'), 'includes the exact phrase named in the request')
assert(AI_TELL_PHRASES.includes('commercial signal'), 'includes the exact phrase named in the request')
assert(AI_TELL_PHRASES.includes('category narrative'), 'includes the exact phrase named in the request')

console.log(`\n${failures === 0 ? '✅' : '❌'} ${failures} failure(s)\n`)
process.exit(failures === 0 ? 0 : 1)
