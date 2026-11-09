// Menu access drive (oms 852, BackOffice 3459): every leaf of the five once-ungated areas — Campaigns, the store
// engine switch, Insurance rules, HQ prescription sessions and Send Broadcast — is hidden until its Access probe
// says yes.
//
// Drives the REAL app in Chromium against STUBS of the probes (never a live SIS.Api), on the universal envelope:
//   GET Rules/Access                    → { canAuthor, canApprove, canSupport, canSwitchEngine }
//   GET InsuranceRules/Access           → one flag per leaf (`can` + its `menu.*` key, as 3459 ships them)
//   GET PrescriptionSessionWeb/Access   → { canView, canWriteOff }
//   GET Notifications/Access            → { canBroadcast }, or a 404 where the notification center is off
//   GET Analytics/Access, Copilot/Access → the EXECUTIVE role's two grants
//
// It asserts, in the rail with every group expanded:
//   1. a no-role user (every probe false, Notifications/Access 404) sees none of the five areas' leaves;
//   2. an EXECUTIVE (Analytics + Copilot only) sees Analytics and the copilot button, and nothing from the five;
//   3. Rules/Access canSupport alone shows exactly support's three Campaigns leaves, and no engine switch;
//   4. one insurance flag alone shows exactly its leaf; canView alone shows Prescription sessions;
//   5. canBroadcast shows Send Broadcast, and a 404 hides it;
//   6. each area's probe is asked ONCE however many leaves ride it;
//   7. no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/menu-access-852-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
import { INSURANCE_RULES_FLAGS_852 } from './access-852-grants.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const ok = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }) })
const notFound = { status: 404, contentType: 'text/plain', body: '' }

const RULES_NONE = { canAuthor: false, canApprove: false, canSupport: false, canSwitchEngine: false }
const INS_NONE = Object.fromEntries(INSURANCE_RULES_FLAGS_852.map((f) => [f, false]))
const FIVE = /^\/(campaigns|insurance-rules)(\/|$)|^\/admin\/(engine-switch|broadcast)$|^\/oms\/prescription-sessions$/

const browser = await chromium.launch()

/** One session: `grants` answers each probe path; any other `*\/Access` answers all-false. */
async function session(grants) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const p = decodeURIComponent(new URL(route.request().url()).pathname.split('/api/')[1])
    calls.push(p)
    if (p === 'Auth/Me') return route.fulfill(ok({ authenticated: true, userId: 'exec.user', currentStoreCode: 'HQ01' }))
    if (p in grants) return route.fulfill(grants[p] === 404 ? notFound : ok(grants[p]))
    if (/Access$/.test(p)) return route.fulfill(ok({ canOpen: false, screenAllowed: false, allowed: false, canView: false }))
    return route.fulfill(ok([]))
  })
  await page.goto(`${BASE}/`)
  await page.locator('nav').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(1500)
  // Open every collapsed group so a hidden leaf is hidden by the gate, never by a fold.
  for (let i = 0; i < 40; i++) {
    const shut = page.locator('nav button[aria-expanded="false"]')
    if ((await shut.count()) === 0) break
    await shut.first().click()
  }
  const links = await page.$$eval('nav a[href]', (as) => as.map((a) => a.getAttribute('href')))
  const copilot = await page.locator('[data-copilot-button]').count()
  await context.close()
  return { links, five: links.filter((h) => FIVE.test(h)), copilot, calls, errors }
}

const NO_ROLE = {
  'Rules/Access': RULES_NONE,
  'InsuranceRules/Access': INS_NONE,
  'PrescriptionSessionWeb/Access': { canView: false, canWriteOff: false },
  'Notifications/Access': 404,
}

// ── 1 · a no-role user ──────────────────────────────────────────────────────────────────────────
{
  const s = await session(NO_ROLE)
  check('1: a no-role user sees none of the five areas', s.five.length === 0, s.five.join(', '))
  check('1: …and no Analytics', !s.links.some((h) => h.startsWith('/analytics')))
  for (const probe of ['Rules/Access', 'InsuranceRules/Access', 'PrescriptionSessionWeb/Access', 'Notifications/Access'])
    check(`6: ${probe} is asked once`, s.calls.filter((c) => c === probe).length === 1, String(s.calls.filter((c) => c === probe).length))
  check('7: no page errors (no-role)', s.errors.length === 0, s.errors.join(' | '))
}

// ── 2 · an EXECUTIVE: Analytics + Copilot only ──────────────────────────────────────────────────
{
  const s = await session({
    ...NO_ROLE,
    'Analytics/Access': { canView: true, canAuthor: false, canCurate: false },
    'Copilot/Access': { canAsk: true, canUseMcp: false, canCurate: false },
  })
  check('2: an EXECUTIVE sees Analytics', s.links.some((h) => h.startsWith('/analytics')), s.links.join(', '))
  check('2: …and the copilot button', s.copilot === 1)
  check('2: …and nothing from the five areas', s.five.length === 0, s.five.join(', '))
  check('7: no page errors (executive)', s.errors.length === 0, s.errors.join(' | '))
}

// ── 3 · support alone ───────────────────────────────────────────────────────────────────────────
{
  const s = await session({ ...NO_ROLE, 'Rules/Access': { ...RULES_NONE, canSupport: true } })
  const want = ['/campaigns/coupon-finder', '/campaigns/customers', '/campaigns/sessions']
  check('3: canSupport alone shows support’s three Campaigns leaves, and nothing else of the five', JSON.stringify([...s.five].sort()) === JSON.stringify(want), s.five.join(', '))
  const e = await session({ ...NO_ROLE, 'Rules/Access': { ...RULES_NONE, canSwitchEngine: true } })
  check('3: canSwitchEngine alone shows only the engine switch', JSON.stringify(e.five) === '["/admin/engine-switch"]', e.five.join(', '))
}

// ── 4 · one insurance flag; prescription sessions ───────────────────────────────────────────────
{
  const s = await session({ ...NO_ROLE, 'InsuranceRules/Access': { ...INS_NONE, canEditions: true } })
  check('4: canEditions alone shows only Editions', JSON.stringify(s.five) === '["/insurance-rules/editions"]', s.five.join(', '))
  const all = await session({ ...NO_ROLE, 'InsuranceRules/Access': Object.fromEntries(INSURANCE_RULES_FLAGS_852.map((f) => [f, true])) })
  check('4: every insurance flag shows every leaf of the group, one per flag', all.five.filter((h) => h.startsWith('/insurance-rules')).length === INSURANCE_RULES_FLAGS_852.length, String(all.five.length))
  const p = await session({ ...NO_ROLE, 'PrescriptionSessionWeb/Access': { canView: true, canWriteOff: false } })
  check('4: canView alone shows Prescription sessions', JSON.stringify(p.five) === '["/oms/prescription-sessions"]', p.five.join(', '))
}

// ── 5 · Send Broadcast ──────────────────────────────────────────────────────────────────────────
{
  const s = await session({ ...NO_ROLE, 'Notifications/Access': { canBroadcast: true } })
  check('5: canBroadcast shows Send Broadcast', JSON.stringify(s.five) === '["/admin/broadcast"]', s.five.join(', '))
  const d = await session({ ...NO_ROLE, 'Notifications/Access': { canBroadcast: false } })
  check('5: canBroadcast false hides it', d.five.length === 0, d.five.join(', '))
}

await browser.close()
const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
