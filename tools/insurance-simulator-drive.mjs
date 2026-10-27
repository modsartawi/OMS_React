// Insurance rules ▸ Simulator drive (BackOffice spec 3126, door 3140; oms ticket 612).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/insurance-rules-stubs.mjs`, section 612):
//   POST InsuranceRules/Guards/Simulate   { request, patientKey } → simulateGuards(body) (G-007 + G-004 over each line)
//   POST InsuranceRules/Guards/Backtests  { days }               → { id: BT-41, … }
//   GET  InsuranceRules/Guards/Backtests/{id}                    → running (first read), then backtestReport(days)
//   GET  InsuranceRules/Guards/Draft                             → RULESET (revision 12; the trace's sentences)
// 🚩 NOTHING here is driven against a live SIS.Api: 3140 is unbuilt. Ticket 618 swaps in the live doors.
//
// It verifies, in LTR and RTL:
//   1. the Simulator leaf is in the rail; /insurance-rules/simulator opens on Simulate;
//   2. an empty request names what is missing and sends nothing;
//   3. simulate G-007 on a stub patient: the body is the brief's, exactly; the patient key never reaches the address;
//   4. line 1 (a GLP-1 pen, no diabetes code): Refused unless overridden by G-007, its codes ltr, its EN + AR message,
//      the trace laid on G-007's sentences (true / false / unknown, NOT on its node, why as <bdi>); G-004 read, false;
//   5. line 2 (120 days): Refused by G-004 with its suggestion; G-007 short-circuits (a condition shows "Not read");
//   6. back-test: pick 90 days, start, follow the progress, read fires by severity, SAR, distinct patients / stores /
//      pharmacists, overlap; the stopped requests with every patient key masked (one sent whole is masked here);
//   7. the job is in the address: a reload reads it again; an old revision's back-test says the draft changed;
//   8. a bare 403 on Simulate / Backtests is "You do not have access";
//   9. no raw keys and no page errors.
//
//   1. run the app:  npx vite --port 5209 --strictPort
//   2. node tools/insurance-simulator-drive.mjs        (DRIVE_PORT overrides 5209)
import { createRequire } from 'node:module'
import { envelope, insuranceRulesStub, newBacktestStore, SIM_PATIENT, simulatorStub } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5209}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, { deny = [] } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const store = newBacktestStore()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    let body = null
    try {
      body = req.postDataJSON()
    } catch {
      body = null
    }
    const hit = simulatorStub(req.method(), p, body, { store, deny }) ?? insuranceRulesStub(req.method(), p, body)
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, store }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|simulator):|\b(tabs|form|result|outcome|trace|backtest|tiles|stopped|sentence)\.\w/.test(await page.locator('main').innerText())
const traceOf = (page, line, rule) =>
  page.locator(`[data-result-line="${line}"] [data-traced-rule="${rule}"] li[data-trace-path]`).evaluateAll((els) =>
    els.map((e) => `${e.getAttribute('data-trace-path')}${e.getAttribute('data-not') === 'true' ? ' NOT' : ''} = ${e.querySelector(':scope > div [data-trace-value]').getAttribute('data-trace-value')}`),
  )

const EXPECTED_BODY = {
  request: {
    channel: 'oms',
    store: 'P019',
    payer: 'BUPA',
    policy: 'POL-77',
    class: 'A',
    lines: [
      { item: '100101', qty: 2, unit: 'PEN', daysSupply: 28, icd: ['E66.9'], price: 450.5 },
      { item: '200101', qty: 1, unit: 'TAB', daysSupply: 120, icd: ['E11.9', 'I10'], price: 35 },
    ],
  },
  patientKey: SIM_PATIENT,
}

for (const dir of ['ltr', 'rtl']) {
  // ── 1–5: Simulate ──────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, store } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/simulator`)
    await page.locator('[data-sim-form]').waitFor({ timeout: 60000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} 1. the rail has the Simulator leaf`, (await page.locator('a[href="/insurance-rules/simulator"]').count()) >= 1)
    check(`${dir} 1. the title`, strip(await page.locator('h1').first().innerText()) === 'Simulator')
    check(`${dir} 1. Simulate is the open tab`, (await page.locator('[data-tab="simulate"]').getAttribute('aria-selected')) === 'true')
    await page.locator('[data-draft-revision="12"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 1. it runs the draft, revision 12`, strip(await page.locator('[data-draft-revision]').innerText()) === 'Runs the guard draft, revision 12.')

    // 2. empty
    await page.locator('[data-run]').click()
    await page.waitForTimeout(300)
    const problems = await page.locator('[data-problem]').evaluateAll((els) => els.map((e) => e.getAttribute('data-problem')))
    check(`${dir} 2. an empty request names what is missing`, JSON.stringify(problems) === JSON.stringify(['store', 'patientKey', 'item:1', 'price:1']), JSON.stringify(problems))
    check(`${dir} 2. and sends nothing`, store.simulates.length === 0)

    // 3. simulate G-007 on the stub patient
    await page.locator('select[data-field="channel"]').selectOption('oms')
    const req = { store: 'P019', payer: 'BUPA', policy: 'POL-77', class: 'A', patientKey: SIM_PATIENT }
    for (const [f, v] of Object.entries(req)) await page.locator(`[data-sim-form] > div input[data-field="${f}"]`).fill(v)
    const fillLine = async (n, l) => {
      for (const [f, v] of Object.entries(l)) await page.locator(`[data-line="${n}"] input[data-field="${f}"]`).fill(v)
    }
    await fillLine(1, { item: '100101', qty: '2', unit: 'PEN', daysSupply: '28', icd: 'e66.9', price: '450.5' })
    await page.locator('[data-add-line]').click()
    await fillLine(2, { item: '200101', qty: '1', unit: 'TAB', daysSupply: '120', icd: 'E11.9, I10', price: '35' })
    check(`${dir} 3. the patient key is typed left to right`, (await page.locator('input[data-field="patientKey"]').getAttribute('dir')) === 'ltr')
    await page.locator('[data-run]').click()
    await page.locator('[data-result-line="2"]').waitFor({ timeout: 10000 })
    check(`${dir} 3. the body is the brief's, exactly`, JSON.stringify(store.simulates.at(-1)) === JSON.stringify(EXPECTED_BODY), JSON.stringify(store.simulates.at(-1)))
    check(`${dir} 3. the patient key never reaches the address`, !page.url().includes(SIM_PATIENT))

    // 4. line 1
    const l1 = page.locator('[data-result-line="1"]')
    check(`${dir} 4. line 1: the item ltr, Refused unless overridden`, (await l1.locator('[data-result-item] bdi[dir="ltr"]').innerText()) === '100101' && (await l1.locator('[data-outcome]').getAttribute('data-outcome')) === 'override' && strip(await l1.locator('[data-outcome]').innerText()) === 'Refused unless overridden')
    const rules1 = await l1.locator('[data-traced-rule]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-traced-rule')}:${e.getAttribute('data-fired')}`))
    check(`${dir} 4. G-007 fired, G-004 only read`, JSON.stringify(rules1) === JSON.stringify(['G-007:OVERRIDE', 'G-004:none']), JSON.stringify(rules1))
    const g7 = l1.locator('[data-traced-rule="G-007"]')
    check(`${dir} 4. G-007's id links to the rule, its name a <bdi>`, (await g7.locator('a[data-rule-link]').getAttribute('href')) === '/insurance-rules/guards/G-007' && strip(await g7.locator('[data-rule-name]').innerText()) === 'GLP-1 without a diabetes diagnosis')
    check(`${dir} 4. its codes are ltr isolates`, (await g7.locator('[data-code="conflict"] bdi[dir="ltr"]').innerText()) === 'DC' && (await g7.locator('[data-code="nphies"] bdi[dir="ltr"]').innerText()) === 'CV-4-5')
    check(`${dir} 4. its message in English and Arabic`, strip(await g7.locator('[data-says-en]').innerText()) === 'GLP-1 without a diabetes diagnosis' && (await g7.locator('[data-says-ar]').getAttribute('dir')) === 'rtl')
    const t7 = await traceOf(page, 1, 'G-007')
    check(
      `${dir} 4. the trace on G-007's own tree`,
      JSON.stringify(t7) ===
        JSON.stringify([
          'when[0] = true',
          'when[0].conditions[0] = true',
          'when[0].conditions[1] NOT = true',
          'when[0].conditions[2] NOT = true',
          'when[0].conditions[2].conditions[0] = false',
          'when[0].conditions[2].conditions[1] = unknown',
        ]),
      JSON.stringify(t7),
    )
    check(`${dir} 4. the trace reads the rule's sentences`, strip(await g7.locator('li[data-trace-path="when[0].conditions[0]"] > div [data-sentence]').innerText()) === 'the item is in GLP-1 and biologics')
    check(`${dir} 4. why is free text in a <bdi>`, strip(await g7.locator('li[data-trace-path="when[0].conditions[2].conditions[1]"] [data-why] bdi').innerText()) === 'The policy is not known to HQ')
    check(`${dir} 4. G-004 read, false`, JSON.stringify(await traceOf(page, 1, 'G-004')) === JSON.stringify(['when[0] = false']))

    // 5. line 2
    const l2 = page.locator('[data-result-line="2"]')
    check(`${dir} 5. line 2: Refused`, (await l2.locator('[data-outcome]').getAttribute('data-outcome')) === 'refuse')
    const rules2 = await l2.locator('[data-traced-rule]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-traced-rule')}:${e.getAttribute('data-fired')}`))
    check(`${dir} 5. G-004 fired, G-007 only read`, JSON.stringify(rules2) === JSON.stringify(['G-004:REFUSE', 'G-007:none']), JSON.stringify(rules2))
    check(`${dir} 5. G-004's suggestion is an ltr value`, (await l2.locator('[data-traced-rule="G-004"] [data-suggestion="maxDaysSupply"] bdi[dir="ltr"]').innerText()) === '90')
    const t72 = await traceOf(page, 2, 'G-007')
    check(`${dir} 5. G-007 short-circuits: the rest is "Not read"`, JSON.stringify(t72.slice(0, 3)) === JSON.stringify(['when[0] = false', 'when[0].conditions[0] = false', 'when[0].conditions[1] NOT = unread']), JSON.stringify(t72))
    check(`${dir} 5. no raw keys`, await noRawKeys(page))
    await page.screenshot({ path: `tools/.insurance-simulator-shots/${dir}-simulate.png`, fullPage: true }).catch(() => {})

    // ── 6: Back-test ──────────────────────────────────────────────────────────────────────────
    await page.locator('[data-tab="backtest"]').click()
    await page.locator('[data-backtest-none]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 6. Back-test tab in the address, none started yet`, new URL(page.url()).searchParams.get('tab') === 'backtest' && (await page.locator('[data-backtest-none]').isVisible()))
    await page.waitForURL(/tab=backtest/, { timeout: 5000 }).catch(() => {})
    await page.locator('[data-days="90"]').click()
    await page.waitForFunction(() => document.querySelector('[data-days="90"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 5000 }).catch(() => {})
    check(`${dir} 6. 90 days picked, in the address`, (await page.locator('[data-days="90"]').getAttribute('aria-pressed')) === 'true' && new URL(page.url()).searchParams.get('days') === '90')
    await page.locator('[data-start-backtest]').click()
    await page.locator('[data-backtest-running]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 6. the start asks for 90 days`, JSON.stringify(store.starts) === JSON.stringify([{ days: 90 }]), JSON.stringify(store.starts))
    check(`${dir} 6. the job is in the address`, new URL(page.url()).searchParams.get('id') === 'BT-41')
    check(`${dir} 6. its progress is followed`, (await page.locator('[data-backtest-running="running"] [data-progress="40"]').count()) === 1 && strip(await page.locator('[data-progress]').innerText()) === '40% done')
    await page.locator('[data-backtest-report="BT-41"]').waitFor({ timeout: 10000 })
    check(`${dir} 6. it is read again until done`, store.jobs['BT-41'].reads >= 2)
    const tile = async (k) => strip(await page.locator(`[data-tile="${k}"] [data-figure]`).innerText())
    const tiles = await Promise.all(['fires', 'REFUSE', 'OVERRIDE', 'WARN', 'sar', 'patients', 'stores', 'pharmacists'].map(tile))
    check(`${dir} 6. tiles: 120 fires (12 / 90 / 18), 1442.75 SAR, 63 patients, 7 stores, 9 pharmacists`, JSON.stringify(tiles) === JSON.stringify(['120', '12', '90', '18', '1442.75', '63', '7', '9']), JSON.stringify(tiles))
    check(`${dir} 6. every tile figure is an ltr isolate`, (await page.locator('[data-tile] [data-figure] bdi[dir="ltr"]').count()) === 8)
    check(`${dir} 6. the severity tiles read heaviest first`, JSON.stringify(await page.locator('[data-tile]').evaluateAll((els) => els.slice(1, 4).map((e) => e.getAttribute('data-tile')))) === JSON.stringify(['REFUSE', 'OVERRIDE', 'WARN']))
    check(`${dir} 6. the overlap with live guards`, strip(await page.locator('[data-overlap]').innerText()) === '36 of 120 fires are on requests a live guard already fires on.')
    check(`${dir} 6. it is the draft's current revision`, (await page.locator('[data-backtest-revision]').getAttribute('data-backtest-revision')) === 'current' && strip(await page.locator('[data-backtest-revision]').innerText()) === "Back-test of draft revision 12. It is the draft's current revision.")
    const keys = await page.locator('[data-stopped] [data-col="patient"] bdi[dir="ltr"]').allInnerTexts()
    check(`${dir} 6. every patient key masked (one sent whole is masked here)`, JSON.stringify(keys) === JSON.stringify(['10••••••83', '24••••••19', '11••••••08']), JSON.stringify(keys))
    check(`${dir} 6. no whole patient key anywhere on screen`, !/\b[12]\d{9}\b/.test(await page.locator('[data-backtest-report]').innerText()))
    const row0 = await Promise.all(['on', 'store', 'item', 'sar'].map(async (c) => strip(await page.locator(`[data-stopped-row="0"] [data-col="${c}"] bdi[dir="ltr"]`).innerText())))
    check(`${dir} 6. a stopped request: local moment, store, item, SAR — each ltr`, JSON.stringify(row0) === JSON.stringify(['2026-10-26 18:42', 'P019', '100101', '450.50']), JSON.stringify(row0))
    check(`${dir} 6. a day-only stopped request reads as a day`, strip(await page.locator('[data-stopped-row="1"] [data-col="on"]').innerText()) === '2026-10-25')
    check(`${dir} 6. no raw keys`, await noRawKeys(page))
    await page.screenshot({ path: `tools/.insurance-simulator-shots/${dir}-backtest.png`, fullPage: true }).catch(() => {})

    // 7. reload follows the job; an old revision's back-test
    await page.reload()
    await page.locator('[data-backtest-report="BT-41"]').waitFor({ timeout: 30000 }).catch(() => {})
    check(`${dir} 7. a reload reads the same job, done`, (await page.locator('[data-backtest-report="BT-41"]').count()) === 1 && (await page.locator('[data-tab="backtest"]').getAttribute('aria-selected')) === 'true')
    await page.goto(`${BASE}/insurance-rules/simulator?tab=backtest&id=BT-OLD`)
    await page.locator('[data-backtest-report="BT-OLD"]').waitFor({ timeout: 30000 }).catch(() => {})
    check(`${dir} 7. an old revision's back-test says the draft changed`, (await page.locator('[data-backtest-revision="stale"]').count()) === 1 && strip(await page.locator('[data-backtest-revision]').innerText()) === 'Back-test of draft revision 11. The draft has changed since (now revision 12): run it again before asking for approval.', strip(await page.locator('[data-backtest-revision]').innerText().catch(() => '')))

    check(`${dir} 9. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 8: bare 403s ─────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir, { deny: ['simulate', 'startBacktest'] })
    await page.goto(`${BASE}/insurance-rules/simulator`)
    await page.locator('[data-sim-form]').waitFor({ timeout: 60000 })
    await page.locator('[data-sim-form] > div input[data-field="store"]').fill('P001')
    await page.locator('input[data-field="patientKey"]').fill(SIM_PATIENT)
    await page.locator('[data-line="1"] input[data-field="item"]').fill('100101')
    await page.locator('[data-line="1"] input[data-field="price"]').fill('10')
    await page.locator('[data-run]').click()
    await page.locator('[data-sim-denied]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 8. a bare 403 on Simulate is "You do not have access"`, (await page.locator('[data-sim-denied]').count()) === 1 && strip(await page.locator('[data-sim-denied]').innerText()).startsWith('You do not have access'))
    await page.locator('[data-tab="backtest"]').click()
    await page.locator('[data-start-backtest]').click()
    await page.locator('[data-backtest-denied]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 8. a bare 403 on Backtests is "You do not have access"`, (await page.locator('[data-backtest-denied]').count()) === 1)
    check(`${dir} 9. no page errors (403 pass)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
