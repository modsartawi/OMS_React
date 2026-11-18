// Menu access drive (oms 852, BackOffice 3459; oms 914: off the one `Auth/Permissions` answer): every leaf of the five
// once-ungated areas — Campaigns, the store engine switch, Insurance rules, HQ prescription sessions and Send
// Broadcast — is hidden until the answer holds its key.
//
// Drives the REAL app in Chromium against a STUB of `GET Auth/Permissions` (never a live SIS.Api); the keys per area:
//   Campaigns / engine switch → RuleAuthoring:02 / :06, RuleSupport:03, RuleEngineSwitch:02
//   Insurance rules           → one key per leaf (`FLAG_KEYS.InsuranceRules`, brief 3995 row 14)
//   Prescription sessions     → PrescriptionSessionHq:03 (PrescriptionSessionWriteOff:06 for the write-off)
//   Send Broadcast            → NotificationBroadcast:01 AND extras.notificationCenterOn
//   EXECUTIVE                 → Analytics:03, Copilot:01
//
// It asserts, in the rail with every group expanded:
//   1. a no-role user (no keys, notification center off) sees none of the five areas' leaves;
//   2. an EXECUTIVE (Analytics + Copilot only) sees Analytics and the copilot button, and nothing from the five;
//   3. RuleSupport:03 alone shows exactly support's three Campaigns leaves, and no engine switch;
//   4. one insurance key alone shows exactly its leaf; PrescriptionSessionHq:03 alone shows Prescription sessions;
//   5. NotificationBroadcast:01 shows Send Broadcast when the center is on; no key, or the center off, hides it;
//   6. the answer is asked ONCE however many leaves ride it, and no `*/Access` probe is asked;
//   7. no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/menu-access-852-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
import { permissions, FLAG_KEYS } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const ok = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }) })

/** One leaf per insurance flag; the keys those leaves read. */
const INSURANCE_LEAVES = Object.keys(FLAG_KEYS.InsuranceRules).length
const INSURANCE_KEYS = [...new Set(Object.values(FLAG_KEYS.InsuranceRules).flat())]
const FIVE = /^\/(campaigns|insurance-rules)(\/|$)|^\/admin\/(engine-switch|broadcast)$|^\/oms\/prescription-sessions$/

const browser = await chromium.launch()

/** One session: `Auth/Permissions` answers `keys` (and `extras`). */
async function session(keys, extras = {}) {
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
    if (p === 'Auth/Permissions') return route.fulfill(permissions(keys, extras))
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

// ── 1 · a no-role user ──────────────────────────────────────────────────────────────────────────
{
  const s = await session([])
  check('1: a no-role user sees none of the five areas', s.five.length === 0, s.five.join(', '))
  check('1: …and no Analytics', !s.links.some((h) => h.startsWith('/analytics')))
  const asked = s.calls.filter((c) => c === 'Auth/Permissions').length
  check('6: Auth/Permissions is asked once', asked === 1, String(asked))
  const probes = s.calls.filter((c) => /Access$/.test(c))
  check('6: no */Access probe is asked', probes.length === 0, probes.join(', '))
  check('7: no page errors (no-role)', s.errors.length === 0, s.errors.join(' | '))
}

// ── 2 · an EXECUTIVE: Analytics + Copilot only ──────────────────────────────────────────────────
{
  const s = await session(['Analytics:03', 'Copilot:01'])
  check('2: an EXECUTIVE sees Analytics', s.links.some((h) => h.startsWith('/analytics')), s.links.join(', '))
  check('2: …and the copilot button', s.copilot === 1)
  check('2: …and nothing from the five areas', s.five.length === 0, s.five.join(', '))
  check('7: no page errors (executive)', s.errors.length === 0, s.errors.join(' | '))
}

// ── 3 · support alone ───────────────────────────────────────────────────────────────────────────
{
  const s = await session(['RuleSupport:03'])
  const want = ['/campaigns/coupon-finder', '/campaigns/customers', '/campaigns/sessions']
  check('3: RuleSupport:03 alone shows support’s three Campaigns leaves, and nothing else of the five', JSON.stringify([...s.five].sort()) === JSON.stringify(want), s.five.join(', '))
  const e = await session(['RuleEngineSwitch:02'])
  check('3: RuleEngineSwitch:02 alone shows only the engine switch', JSON.stringify(e.five) === '["/admin/engine-switch"]', e.five.join(', '))
}

// ── 4 · one insurance key; prescription sessions ────────────────────────────────────────────────
{
  const s = await session(['InsuranceReferenceEdition:03'])
  check('4: InsuranceReferenceEdition:03 alone shows only Editions', JSON.stringify(s.five) === '["/insurance-rules/editions"]', s.five.join(', '))
  const all = await session(INSURANCE_KEYS)
  check('4: every insurance key shows every leaf of the group, one per flag', all.five.filter((h) => h.startsWith('/insurance-rules')).length === INSURANCE_LEAVES, String(all.five.length))
  const p = await session(['PrescriptionSessionHq:03'])
  check('4: PrescriptionSessionHq:03 alone shows Prescription sessions', JSON.stringify(p.five) === '["/oms/prescription-sessions"]', p.five.join(', '))
}

// ── 5 · Send Broadcast ──────────────────────────────────────────────────────────────────────────
{
  const s = await session(['NotificationBroadcast:01'], { notificationCenterOn: true })
  check('5: NotificationBroadcast:01 with the center on shows Send Broadcast', JSON.stringify(s.five) === '["/admin/broadcast"]', s.five.join(', '))
  const d = await session([], { notificationCenterOn: true })
  check('5: without the key it is hidden', d.five.length === 0, d.five.join(', '))
  const off = await session(['NotificationBroadcast:01'], { notificationCenterOn: false })
  check('5: the notification center off hides it', off.five.length === 0, off.five.join(', '))
}

await browser.close()
const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
