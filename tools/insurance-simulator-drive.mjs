// Insurance rules ▸ Simulator drive (BackOffice spec 3126, door 3140; oms ticket 612).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/insurance-rules-stubs.mjs`, section 612):
//   POST InsuranceRules/Guards/Simulate   { request, patientKey } → simulateGuards(body) (G-007 + G-004 over each line)
//   POST InsuranceRules/Guards/Backtests  { days }               → the back-test BT-41, queued
//   GET  InsuranceRules/Guards/Backtests                         → the draft's back-tests, newest first
//   GET  InsuranceRules/Guards/Backtests/{id}                    → running (first read), then backtestReport(days)
//   GET  InsuranceRules/Guards/Draft                             → RULESET (revision 12; the trace's sentences)
// Shapes as BUILT in BackOffice 3140; 🚩 still NOTHING here is driven against a live SIS.Api (ticket 618).
//
// It verifies, in LTR and RTL:
//   1. the Simulator leaf is in the rail; /insurance-rules/simulator opens on Simulate;
//   2. an empty request names what is missing and sends nothing;
//   3. simulate G-007 on a stub patient: the body is the brief's, exactly; the patient key never reaches the address;
//   4. line 1 (a GLP-1 pen, no diabetes code): Refused unless overridden by G-007, its codes ltr, its EN + AR message,
//      the trace laid on G-007's sentences (true / false / unknown, NOT on its node, why as <bdi>); G-004 read, false;
//   5. line 2 (120 days): Refused by G-004 with its suggestion; G-007 short-circuits (a condition shows "Not read");
//   6. back-test: with no ?id= the tab shows the draft's own back-test (GET …/Backtests: none of revision 12 → the
//      old one, out of date); pick 90 days, start, follow the progress, read requests / lines, fires by severity,
//      SAR, distinct patients / stores / pharmacists, overlap, by rule; the stopped lines ("first 3 of 102") with
//      every patient key masked (one sent whole is masked here: first digit + last two);
//   7. the job is in the address: a reload reads it again; an old revision's back-test says the draft changed;
//      without ?id= the draft's finished back-test of revision 12 is the one shown;
//   8. a bare 403 on Simulate / Backtests is "You do not have access";
//   9. no raw keys and no page errors.
//
//   1. run the app:  npx vite --port 5209 --strictPort
//   2. node tools/insurance-simulator-drive.mjs        (DRIVE_PORT overrides 5209)
import { createRequire } from 'node:module'
import { categorySimulateStub, envelope, insuranceRulesStub, newBacktestStore, SIM_PATIENT, simulatorStub } from './insurance-rules-stubs.mjs'
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
    const hit = categorySimulateStub(req.method(), p, body, { store, deny }) ?? simulatorStub(req.method(), p, body, { store, deny }) ?? insuranceRulesStub(req.method(), p, body)
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
      { line: 1, item: '100101', qty: 2, unit: 'PEN', daysSupply: 28, icd: ['E66.9'], price: 450.5 },
      { line: 2, item: '200101', qty: 1, unit: 'TAB', daysSupply: 120, icd: ['E11.9', 'I10'], price: 35 },
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
    check(`${dir} 3. no document is sent: HQ runs the saved draft`, !('document' in (store.simulates.at(-1) ?? {})))
    // 660: the request and HQ's reply open as JSON, exactly as they went over the wire.
    await page.locator('[data-json-open="sim-request"]').click()
    const sentJson = JSON.parse(await page.locator('[data-json-view="sim-request"] [data-json-body]').innerText())
    check(`${dir} 3b. Request shows the body that was POSTed`, JSON.stringify(sentJson) === JSON.stringify(store.simulates.at(-1)), JSON.stringify(sentJson))
    await page.keyboard.press('Escape')
    await page.locator('[data-json-open="sim-reply"]').click()
    const replyJson = JSON.parse(await page.locator('[data-json-view="sim-reply"] [data-json-body]').innerText())
    check(`${dir} 3b. Reply shows HQ's answer as sent, trace values as text`, Array.isArray(replyJson?.lines) && replyJson.lines.length === 2 && replyJson.lines.some((l) => (l.trace ?? []).some((s) => typeof s.value === 'string')), JSON.stringify(replyJson).slice(0, 300))
    await page.keyboard.press('Escape')

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
    check(`${dir} 4. the whole condition ("when") heads G-007's tree, not set aside`, (await g7.locator('[data-trace-whole="true"] [data-trace-value="true"]').count()) === 1 && (await g7.locator('[data-trace-loose]').count()) === 0)
    check(`${dir} 4. a line every rule decided shows no unknowns`, (await l1.locator('[data-unknowns]').count()) === 0)

    // 5. line 2
    const l2 = page.locator('[data-result-line="2"]')
    check(`${dir} 5. line 2: Refused`, (await l2.locator('[data-outcome]').getAttribute('data-outcome')) === 'refuse')
    const rules2 = await l2.locator('[data-traced-rule]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-traced-rule')}:${e.getAttribute('data-fired')}`))
    check(`${dir} 5. G-004 fired, G-007 only read`, JSON.stringify(rules2) === JSON.stringify(['G-004:REFUSE', 'G-007:none']), JSON.stringify(rules2))
    check(`${dir} 5. G-004's suggestion is an ltr value`, (await l2.locator('[data-traced-rule="G-004"] [data-suggestion="maxDaysSupply"] bdi[dir="ltr"]').innerText()) === '90')
    const t72 = await traceOf(page, 2, 'G-007')
    check(`${dir} 5. G-007 short-circuits: the rest is "Not read"`, JSON.stringify(t72.slice(0, 3)) === JSON.stringify(['when[0] = false', 'when[0].conditions[0] = false', 'when[0].conditions[1] NOT = unread']), JSON.stringify(t72))
    await l1.locator('[data-line-category]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 5b. line 1 keeps its default category (Categories/Simulate source: default), its own spelling isolated`, (await l1.locator('[data-line-category="G2"][data-category-source="default"][data-category-rule=""]').count()) === 1 && ['Category Brand from the item master (no category rule matched) Brand-IR', 'الفئة تجاري من بيانات الصنف (لم تنطبق قاعدة فئة) Brand-IR'].includes(strip(await l1.locator('[data-line-category]').innerText())) && (await l1.locator('[data-default-category] bdi[dir="ltr"]').innerText()) === 'Brand-IR', strip(await l1.locator('[data-line-category]').innerText()))
    const cs = store.categorySimulates ?? []
    check(`${dir} 5b. one Categories/Simulate per run: the same request, lines numbered, no patient key`, cs.length === 1 && JSON.stringify(cs[0].request.lines.map((l) => [l.line, l.item])) === JSON.stringify([[1, '100101'], [2, '200101']]) && !('patientKey' in cs[0]) && cs[0].request.store === store.simulates.at(-1)?.request?.store, JSON.stringify(cs))
    check(`${dir} 5b. line 2 names the category rule that set it, linked`, (await l2.locator('[data-line-category="G1"]').count()) === 1 && (await l2.locator('a[data-category-link="K-002"]').getAttribute('href')) === '/insurance-rules/categories?rule=K-002')
    check(
      `${dir} 5b. line 1 names the category rule that could not decide (unknowns) and the reply's version, ltr`,
      (await l1.locator('[data-category-unknowns="K-002"] [data-rule-id] bdi[dir="ltr"]').innerText().catch(() => '')) === 'K-002' &&
        (await l1.locator('[data-category-version="1"] bdi[dir="ltr"]').innerText().catch(() => '')) === '1' &&
        (await l2.locator('[data-category-unknowns]').count()) === 0,
      strip(await l1.locator('[data-category-meta]').innerText().catch(() => '')),
    )
    check(`${dir} 5. no raw keys`, await noRawKeys(page))

    // 5c. a line with no days' supply: G-004 cannot decide, named under the line
    await page.locator('[data-line="2"] input[data-field="daysSupply"]').fill('')
    await page.locator('[data-run]').click()
    await page.locator('[data-result-line="2"] [data-unknowns]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 5c. the body leaves days' supply out of line 2`, !('daysSupply' in (store.simulates.at(-1)?.request?.lines?.[1] ?? { daysSupply: 0 })), JSON.stringify(store.simulates.at(-1)?.request?.lines?.[1]))
    const unk = page.locator('[data-result-line="2"] [data-unknowns]')
    check(`${dir} 5c. line 2 names G-004 as undecided, linked, ltr`, (await unk.locator('a[data-unknown-rule="G-004"]').getAttribute('href').catch(() => null)) === '/insurance-rules/guards/G-004' && (await unk.locator('bdi[dir="ltr"]').innerText().catch(() => '')) === 'G-004')
    check(`${dir} 5c. G-004's whole condition reads Unknown`, (await page.locator('[data-result-line="2"] [data-traced-rule="G-004"] [data-trace-whole="unknown"]').count()) === 1)
    await page.screenshot({ path: `tools/.insurance-simulator-shots/${dir}-simulate.png`, fullPage: true }).catch(() => {})

    // ── 6: Back-test ──────────────────────────────────────────────────────────────────────────
    await page.locator('[data-tab="backtest"]').click()
    await page.locator('[data-backtest-report="BT-OLD"]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 6. Back-test tab in the address, no ?id=`, new URL(page.url()).searchParams.get('tab') === 'backtest' && !new URL(page.url()).searchParams.get('id'))
    check(`${dir} 6. with none of revision 12, the draft's newest back-test shows, out of date`, (await page.locator('[data-backtest-report="BT-OLD"] [data-backtest-revision="stale"]').count()) === 1)
    await page.waitForURL(/tab=backtest/, { timeout: 5000 }).catch(() => {})
    await page.locator('[data-days="90"]').click()
    await page.waitForFunction(() => document.querySelector('[data-days="90"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 5000 }).catch(() => {})
    check(`${dir} 6. 90 days picked, in the address`, (await page.locator('[data-days="90"]').getAttribute('aria-pressed')) === 'true' && new URL(page.url()).searchParams.get('days') === '90')
    await page.locator('[data-start-backtest]').click()
    await page.locator('[data-backtest-running]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 6. the start asks for 90 days`, JSON.stringify(store.starts) === JSON.stringify([{ days: 90 }]), JSON.stringify(store.starts))
    check(`${dir} 6. the job is in the address`, new URL(page.url()).searchParams.get('id') === 'BT-41')
    check(`${dir} 6. its progress is followed`, (await page.locator('[data-backtest-running] [data-progress]').count()) === 1 && /^(0|40)% done$/.test(strip(await page.locator('[data-progress]').innerText())), strip(await page.locator('[data-progress]').innerText().catch(() => '')))
    await page.locator('[data-backtest-report="BT-41"]').waitFor({ timeout: 10000 })
    check(`${dir} 6. it is read again until done`, store.jobs['BT-41'].reads >= 2)
    const tile = async (k) => strip(await page.locator(`[data-tile="${k}"] [data-figure]`).innerText())
    const tiles = await Promise.all(['requests', 'lines', 'fires', 'REFUSE', 'OVERRIDE', 'WARN', 'sar', 'patients', 'stores', 'pharmacists'].map(tile))
    check(`${dir} 6. tiles: 3600 requests, 10200 lines, 120 fires (12 / 90 / 18), 1442.75 SAR, 63 patients, 7 stores, 9 pharmacists`, JSON.stringify(tiles) === JSON.stringify(['3600', '10200', '120', '12', '90', '18', '1442.75', '63', '7', '9']), JSON.stringify(tiles))
    check(`${dir} 6. every tile figure is an ltr isolate`, (await page.locator('[data-tile] [data-figure] bdi[dir="ltr"]').count()) === 10)
    check(`${dir} 6. the severity tiles read heaviest first`, JSON.stringify(await page.locator('[data-tile]').evaluateAll((els) => els.slice(3, 6).map((e) => e.getAttribute('data-tile')))) === JSON.stringify(['REFUSE', 'OVERRIDE', 'WARN']))
    check(`${dir} 6. the overlap with live guards`, strip(await page.locator('[data-overlap]').innerText()) === 'On 36 of the lines it fired on, a live guard fired too.', strip(await page.locator('[data-overlap]').innerText()))
    check(`${dir} 6. the window and who asked`, strip(await page.locator('[data-backtest-window]').innerText()) === 'Replayed 90 days from 2026-07-29. Requested by nalharbi · 2026-10-27 10:00', strip(await page.locator('[data-backtest-window]').innerText()))
    const byRule = await page.locator('[data-by-rule] [data-rule-row]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-rule-row'), e.querySelector('[data-col="fires"]').textContent.replace(/[\u2066-\u2069]/g, ''), e.querySelector('[data-col="stopped"]').textContent.replace(/[\u2066-\u2069]/g, '')].join(':')))
    check(`${dir} 6. by rule: fires and lines stopped`, JSON.stringify(byRule) === JSON.stringify(['G-007:90:90', 'G-004:12:12', 'G-010:18:0']), JSON.stringify(byRule))
    check(`${dir} 6. the stopped list says it is the first of all`, (await page.locator('[data-stopped-truncated="102"]').count()) === 1 && strip(await page.locator('[data-stopped-truncated]').innerText()) === 'Showing the first 3 of 102.')
    check(`${dir} 6. a stopped line names its rules, ltr`, JSON.stringify(await page.locator('[data-stopped-row="1"] [data-col="rules"] bdi[dir="ltr"]').allInnerTexts()) === JSON.stringify(['G-007', 'G-004']))
    check(`${dir} 6. it is the draft's current revision`, (await page.locator('[data-backtest-revision]').getAttribute('data-backtest-revision')) === 'current' && strip(await page.locator('[data-backtest-revision]').innerText()) === "Back-test of draft revision 12. It is the draft's current revision.")
    const keys = await page.locator('[data-stopped] [data-col="patient"] bdi[dir="ltr"]').allInnerTexts()
    check(`${dir} 6. every patient key masked (one sent whole is masked here, as HQ does)`, JSON.stringify(keys) === JSON.stringify(['1*******83', '2*******19', '1*******08']), JSON.stringify(keys))
    check(`${dir} 6. no whole patient key anywhere on screen`, !/\b[12]\d{9}\b/.test(await page.locator('[data-backtest-report]').innerText()))
    const row0 = await Promise.all(['on', 'store', 'item', 'sar'].map(async (c) => strip(await page.locator(`[data-stopped-row="0"] [data-col="${c}"] bdi[dir="ltr"]`).innerText())))
    check(`${dir} 6. a stopped line: local day, store, item, SAR — each ltr`, JSON.stringify(row0) === JSON.stringify(['2026-10-26', 'P019', '100101', '450.50']), JSON.stringify(row0))
    check(`${dir} 6. no raw keys`, await noRawKeys(page))
    await page.screenshot({ path: `tools/.insurance-simulator-shots/${dir}-backtest.png`, fullPage: true }).catch(() => {})

    // 7. reload follows the job; an old revision's back-test
    await page.reload()
    await page.locator('[data-backtest-report="BT-41"]').waitFor({ timeout: 30000 }).catch(() => {})
    check(`${dir} 7. a reload reads the same job, done`, (await page.locator('[data-backtest-report="BT-41"]').count()) === 1 && (await page.locator('[data-tab="backtest"]').getAttribute('aria-selected')) === 'true')
    await page.goto(`${BASE}/insurance-rules/simulator?tab=backtest&id=BT-OLD`)
    await page.locator('[data-backtest-report="BT-OLD"]').waitFor({ timeout: 30000 }).catch(() => {})
    check(`${dir} 7. an old revision's back-test says the draft changed`, (await page.locator('[data-backtest-revision="stale"]').count()) === 1 && strip(await page.locator('[data-backtest-revision]').innerText()) === 'Back-test of draft revision 11. The draft has changed since (now revision 12): run it again before asking for approval.', strip(await page.locator('[data-backtest-revision]').innerText().catch(() => '')))
    await page.goto(`${BASE}/insurance-rules/simulator?tab=backtest`)
    await page.locator('[data-backtest-report="BT-41"]').waitFor({ timeout: 30000 }).catch(() => {})
    check(`${dir} 7. without ?id= the draft's finished back-test of revision 12 shows (GET …/Backtests)`, (await page.locator('[data-backtest-report="BT-41"] [data-backtest-revision="current"]').count()) === 1)

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
