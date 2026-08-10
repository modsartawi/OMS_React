// Retail invoice drive (spec 261) — drives the REAL app in Chromium against
// STUBBED `RetailInvoice/*` envelopes.
//
// ⚠️ Stubbed by CHOICE, not because the server is missing: the rail is built and
// live (BackOffice map 984), but standing it up needs SIS.Api *and* a resident
// render host, which is ticket 266's two-process manual setup. Everything 263–265
// assert is assertable on stubs.
//
// 🚩 ONE drive file for the whole wave — 264 and 265 EXTEND this file rather than
// starting a second one (263's Proof says so). Add scenarios below; keep the
// route table in one place.
//
// Ticket 263 — the area, the nav group, the route and the gate:
//   1. screenAllowed:true  → the Reports group and its Invoices leaf are visible,
//      and the screen renders its title + landing state.
//   2. screenAllowed:false → NO Reports group at all in the menu.
//   3. a hand-typed /reports/invoice on a denied session → the no-access SENTENCE,
//      not an empty screen and not a generic "something went wrong".
//   4. the access probe is called ONCE per visit (nav leaf + screen gate share one
//      key, so a gated area costs one round trip).
//   5. every string on the screen came out of the `reports` namespace — no raw
//      `reports:` keys leaked to the page, which is what an unregistered namespace
//      would render.
//
// Playwright is borrowed from the Angular prototype (as in screen1-smoke.mjs) —
// it is NOT a dependency of this repo.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/invoice-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const URL = BASE + '/reports/invoice'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

// Scenario state, mutated between reloads. `accessBody` is the probe's 200 answer;
// `accessStatus` lets a scenario refuse the probe itself (an unmarked route, or a
// cookie branch that said no — issue 802), which is a different arm from a 200
// denial.
let scenario = { accessBody: { screenAllowed: true }, accessStatus: 200 }
// How many times `RetailInvoice/Access` was asked, per visit.
let accessCalls = 0

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const path = url.split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }),
      )
    if (path === 'RetailInvoice/Access') {
      accessCalls++
      if (scenario.accessStatus !== 200)
        return route.fulfill(
          envelope(null, {
            status: scenario.accessStatus,
            success: false,
            message: 'Forbidden.',
            errors: [],
          }),
        )
      return route.fulfill(envelope(scenario.accessBody))
    }
    // Any other probe/endpoint → benign empty success so no other leaf crashes.
    return route.fulfill(envelope({}))
  })

  const visit = async (url) => {
    accessCalls = 0
    await page.goto(url)
    await page.waitForLoadState('networkidle')
  }

  // ---- Scenario 1: granted ------------------------------------------------
  scenario = { accessBody: { screenAllowed: true }, accessStatus: 200 }
  await visit(URL)

  const groupBtn = page.getByRole('button', { name: /^Reports$/i })
  check('granted → the Reports group appears in the menu', (await groupBtn.count()) === 1)
  const leaf = page.getByRole('link', { name: /^Invoices$/i })
  check('granted → the Invoices leaf appears under it', (await leaf.count()) === 1)
  // Guarded on the count rather than awaiting the attribute blind: a missing leaf
  // is a FAILING check, not a 30-second timeout that aborts the run before the
  // later assertions (the raw-key one especially) get to say anything.
  const leafHref = (await leaf.count()) ? await leaf.first().getAttribute('href') : null
  check('granted → the leaf points at /reports/invoice', leafHref === '/reports/invoice', leafHref ?? 'no leaf')

  const main = await page.locator('main').innerText()
  check('granted → the screen renders its title', /Invoices/.test(main), main.split('\n')[0] || '')
  check(
    'granted → the screen renders its subtitle',
    /transaction number/i.test(main),
    main.slice(0, 120).replace(/\n/g, ' '),
  )
  check(
    '🚩 the screen LANDS EMPTY — the landing state, not a grid',
    /Nothing to show yet/i.test(main) && (await page.locator('.ag-row').count()) === 0,
    main.replace(/\n/g, ' ').slice(0, 140),
  )
  check(
    '🚩 no search box and no grid yet (263 owns the area, 264 owns the screen)',
    (await page.locator('input').count()) === 0 &&
      (await page.locator('[role="grid"], [role="treegrid"]').count()) === 0,
  )
  check(
    '🚩 the access probe is called ONCE per visit (nav leaf + gate share one key)',
    accessCalls === 1,
    `${accessCalls} call(s)`,
  )

  // 🚩 The namespace registration is load-bearing and nothing else catches it: an
  // unregistered `reports` namespace renders the RAW KEY to the user.
  //
  // ⚠️ The tell is the KEY PATH, not the `reports:` prefix — i18next's missing-key
  // fallback drops the namespace and renders `invoice.title`, so a check that only
  // looked for `reports:` would pass on a screen showing raw keys. Measured, with
  // the registration removed: `main` read `invoice.title / invoice.subtitle /
  // invoice.landing.title / invoice.landing.hint` and the nav read `menu.invoices`.
  const shellText = await page.locator('body').innerText()
  const rawKey = shellText.match(/(?:^|\s)(?:reports:)?(?:invoice|menu|access)\.[a-zA-Z.]+/)
  check(
    '🚩 no raw i18n keys on the page — the `reports` namespace is registered',
    rawKey === null,
    (rawKey || [''])[0],
  )

  // ---- Scenario 2: denied, arriving from elsewhere ------------------------
  // The probe answers a denial with 200 — a boolean to read, never an error to
  // catch — so this is the ORDINARY refusal, not an outage.
  scenario = { accessBody: { screenAllowed: false }, accessStatus: 200 }
  await visit(BASE + '/')
  check(
    '🚩 denied → NO Reports group at all in the menu',
    (await page.getByRole('button', { name: /^Reports$/i }).count()) === 0,
  )
  check(
    'denied → no Invoices leaf either',
    (await page.getByRole('link', { name: /^Invoices$/i }).count()) === 0,
  )

  // ---- Scenario 3: denied, hand-typed URL ---------------------------------
  // 🚩 The probe only HIDES the menu. A user who pastes the URL reaches the screen
  // and must be told, in words, that they have no access.
  await visit(URL)
  const deniedText = await page.locator('main').innerText()
  check(
    '🚩 hand-typed URL on a denied session → the no-access SENTENCE',
    /No access to invoices/i.test(deniedText),
    deniedText.replace(/\n/g, ' ').slice(0, 120),
  )
  check(
    'denied screen names the remedy (ask an administrator), not a retry',
    /administrator/i.test(deniedText) && !/Try again/i.test(deniedText),
    deniedText.replace(/\n/g, ' ').slice(0, 160),
  )
  check(
    '🚩 denied → NOT an empty screen and NOT a generic error',
    !/Nothing to show yet/i.test(deniedText) && !/unexpected/i.test(deniedText),
    deniedText.replace(/\n/g, ' ').slice(0, 120),
  )
  check(
    'denied → the group stays hidden while standing on the screen',
    (await page.getByRole('button', { name: /^Reports$/i }).count()) === 0,
  )

  // ---- Scenario 4: the probe itself refuses (403) -------------------------
  // A different arm from a 200 denial: the route is unmarked, or the cookie branch
  // said no (issue 802). Still a REFUSAL rather than an outage, so it must not
  // invite a retry loop against a permanently shut door.
  scenario = { accessBody: null, accessStatus: 403 }
  await visit(URL)
  const refusedText = await page.locator('main').innerText()
  check(
    'a 403 on the probe reads as a refusal, not as "try again in a moment"',
    /No access to invoices/i.test(refusedText) && !/Try again/i.test(refusedText),
    refusedText.replace(/\n/g, ' ').slice(0, 120),
  )
  check(
    '🚩 a refused probe is not retried (retry:false travels with the key)',
    accessCalls === 1,
    `${accessCalls} call(s)`,
  )

  // ---- Scenario 5: the probe is unreachable (500) -------------------------
  // The other sentence: an outage the user can retry, distinct from a refusal
  // they cannot.
  scenario = { accessBody: null, accessStatus: 500 }
  await visit(URL)
  const downText = await page.locator('main').innerText()
  check(
    'an unreachable probe reads as unavailable (a retry), not as a refusal',
    /unavailable/i.test(downText) && !/No access to invoices/i.test(downText),
    downText.replace(/\n/g, ' ').slice(0, 120),
  )

  // The denied/refused scenarios intentionally answer 403/500, which the browser
  // logs as a resource-load failure — expected, not an app fault.
  const realErrors = errors.filter((e) => !/status of (403|500)/.test(e))
  check('no uncaught page errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
