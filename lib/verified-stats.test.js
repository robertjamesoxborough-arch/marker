const { checkVerifiedStats, extractVerifiableNumbers, buildVerifiedPool } = require('./verified-stats')

let passed = 0, failed = 0
function test(label, fn) {
  try { fn(); passed++; console.log('  PASS ', label) }
  catch (e) { console.error('  FAIL ', label, '—', e.message); failed++ }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed') }

const CV = 'Grew pipeline by 42% in 12 months. Budget: £120k. Team of 8. Joined 2019. Generated £2.4m revenue.'
const ACHIEVEMENTS = ['Saved £500k in 2021', 'Reduced attrition by 18%']

console.log('Group 1: Numbers present in CV → not flagged')
test('42% from CV — safe', () => {
  const { safe } = checkVerifiedStats('Pipeline grew 42%', CV, [])
  assert(safe, 'should be safe')
})
test('£120k from CV — safe', () => {
  const { flagged } = checkVerifiedStats('Managed budget of £120k', CV, [])
  assert(!flagged.some(f => f.includes('120')), 'should not flag £120k')
})
test('Year 2019 from CV — safe', () => {
  const { safe } = checkVerifiedStats('Joined in 2019', CV, [])
  assert(safe, 'should be safe')
})
test('£2.4m from CV — safe', () => {
  const { flagged } = checkVerifiedStats('Generated £2.4m revenue', CV, [])
  assert(!flagged.some(f => f.includes('24')), 'should not flag £2.4m')
})

console.log('Group 2: Hallucinated numbers → flagged')
test('300% not in CV — flagged', () => {
  const { flagged } = checkVerifiedStats('Grew revenue by 300%', CV, [])
  assert(flagged.includes('300%'), 'should flag 300%')
})
test('£5m not in CV — flagged', () => {
  const { flagged } = checkVerifiedStats('Generated £5m in ARR', CV, [])
  assert(flagged.length > 0, 'should flag invented £5m')
})
test('Year 2012 not in CV — flagged', () => {
  const { flagged } = checkVerifiedStats('Since 2012 I have been specialising in…', CV, [])
  assert(flagged.includes('2012'), 'should flag 2012')
})
test('250 clients not in CV — flagged', () => {
  const { flagged } = checkVerifiedStats('Managed 250 enterprise accounts', CV, [])
  assert(flagged.includes('250'), 'should flag 250')
})

console.log('Group 3: Numbers from achievements → not flagged')
test('£500k from achievements — safe', () => {
  const { safe } = checkVerifiedStats('Saved £500k', CV, ACHIEVEMENTS)
  assert(safe, 'achievement £500k should be safe')
})
test('18% from achievements — safe', () => {
  const { flagged } = checkVerifiedStats('Reduced attrition by 18%', CV, ACHIEVEMENTS)
  assert(!flagged.includes('18%'), 'achievement 18% should not be flagged')
})
test('2021 year from achievements — safe', () => {
  const { safe } = checkVerifiedStats('In 2021 saved £500k', CV, ACHIEVEMENTS)
  assert(safe, '2021 from achievement should be safe')
})

console.log('Group 4: Edge cases')
test('null text → safe', () => {
  const { safe, flagged } = checkVerifiedStats(null, CV, [])
  assert(safe && flagged.length === 0)
})
test('empty text → safe', () => {
  const { safe } = checkVerifiedStats('', CV, [])
  assert(safe)
})
test('null cvRaw — hallucinated numbers still flagged', () => {
  const { flagged } = checkVerifiedStats('Generated £10m revenue', null, [])
  assert(flagged.length > 0, 'should still flag with null cvRaw')
})
test('no numbers in output → safe', () => {
  const { safe } = checkVerifiedStats('Senior marketing professional with broad B2B experience.', CV, [])
  assert(safe, 'text with no numbers should be safe')
})
test('small numbers under 100 not extracted', () => {
  const nums = extractVerifiableNumbers('Led a team of 8 people over 3 years in the role')
  assert(!nums.has('8') && !nums.has('3'), 'small numbers (<100) should not be extracted')
})
test('null achievements array — no crash', () => {
  const { safe } = checkVerifiedStats('Grew by 42%', CV, null)
  assert(safe)
})

console.log('Group 5: Guardrail invariant — mixed verified + hallucinated')
test('42% (verified) not flagged; 300% (invented) flagged', () => {
  const { flagged } = checkVerifiedStats('Grew pipeline by 42% and generated £10m revenue', CV, [])
  assert(!flagged.includes('42%'), 'should NOT flag verified 42%')
  assert(flagged.some(f => f.includes('10')), 'should flag invented £10m')
})
test('All verified → safe=true', () => {
  const { safe } = checkVerifiedStats('Grew pipeline by 42% with £120k budget since 2019', CV, [])
  assert(safe, 'all-verified text should be safe')
})
test('[UPDATED] marker text not flagged (no numbers)', () => {
  const { safe } = checkVerifiedStats('[UPDATED] Senior Partnerships Manager with broad experience.', CV, [])
  assert(safe)
})

console.log('')
const line = '─'.repeat(50)
console.log(line)
console.log(`  ${passed} passed  |  ${failed} failed  |  ${passed + failed} total`)
console.log(line)
if (failed > 0) process.exit(1)
