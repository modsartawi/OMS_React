// Insurance rules ▸ Playground drive (BackOffice spec 3243, doors 3244 + 3245; oms tickets 677, 678).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/insurance-rules-stubs.mjs`, section 677):
//   POST InsuranceRules/Playground/Evaluate { kind, data, document, asOf } → evaluatePlayground(body)
// Shapes as the BRIEF draws them; 🚩 nothing here is driven against a live SIS.Api (ticket 691).
//
// It verifies, in LTR and RTL:
//   1. the Playground leaf is in the rail; /insurance-rules/playground opens on Data | Rule | Outcome, seeded;
//   2. the experiment runs by itself (678: no Run button) and sends the brief's body (kind guard, the seeded data and document, asOf local with no Z) and shows line 1
//      matched, its trace row G-1 · when[0] True, why in a <bdi>;
//   3. edit the rule so nothing matches: "nothing matched", the trace row False;
//   4. JSON that does not parse is said in words and never sent;
//   5. a reader error shows alone (path ltr + message), nothing else;
//   6. a PLAYGROUND_* refusal shows its message and code, never "unexpected";
//   7. a bare 403 is the no-access words;
//   8. no raw keys and no page errors.
//   678: 9. edits inside the window make one request, and the outcome refreshes with no Run;
//       10. a stubbed slow older reply arriving after a newer one is dropped; "running…" shows over the last outcome;
//       11. "as of" is sent as typed, local with no Z, and shown isolated;
//       12. Tab B per kind: guard outcome + fired rules; switch to category → each line's category, group, who set
//           it; switch to coverage → the data carries the payer, each value with its source, money as 0.00.
//
// Stub section 678 (`playgroundVerdict`) answers the verdict; the slow reply is this drive's own route delay.
//
//   1. run the app:  npx vite --port 5377 --strictPort
//   2. node tools/insurance-playground-drive.mjs        (DRIVE_PORT overrides 5377)
import { createRequire } from 'node:module'
import { envelope, insuranceRulesStub, newPlaygroundStore, playgroundStub } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5377}`

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
  const store = newPlaygroundStore()
  /** Per Evaluate call in order: how long its answer waits (ms). */
  const slow = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    let body = null
    try {
      body = req.postDataJSON()
    } catch {
      body = null
    }
    const evaluate = p === 'InsuranceRules/Playground/Evaluate'
    const hit = playgroundStub(req.method(), p, body, { store, deny }) ?? insuranceRulesStub(req.method(), p, body)
    if (evaluate && slow.length) {
      const ms = slow.shift()
      if (ms) await new Promise((r) => setTimeout(r, ms))
    }
    if (hit) return route.fulfill(hit).catch(() => {})
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, store, slow }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|playground):|\b(run|data|rule|json|outcome|trace|access)\.\w/.test(await page.locator('main').innerText())
const box = (page, b) => page.locator(`textarea[data-json-box="${b}"]`)
const docText = async (page) => JSON.parse(await box(page, 'document').inputValue())
const setDoc = async (page, doc) => box(page, 'document').fill(JSON.stringify(doc, null, 2))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** After an edit: wait for the auto-run to send (or 3 s), then for `sel`; how many requests the edit made. */
const editAndWait = async (page, store, edit, sel) => {
  const before = store.evaluates.length
  await edit()
  for (let i = 0; i < 30 && store.evaluates.length === before; i++) await sleep(100)
  if (sel) await page.locator(sel).first().waitFor({ timeout: 10000 }).catch(() => {})
  await sleep(700)
  return store.evaluates.length - before
}
// The app's words stay English under RTL (the drives' convention: `rtl` flips the direction, not the language).
const WORDS = {
  en: { title: 'Playground', nothing: 'Nothing matched: no line met a rule\'s whole condition.', denied: 'You do not have access to the playground', true: 'True', false: 'False' },
}

for (const dir of ['ltr', 'rtl']) {
  const w = WORDS.en
  {
    const { context, page, errors, store, slow } = await open(dir)
    const opened = await editAndWait(
      page,
      store,
      async () => {
        await page.goto(`${BASE}/insurance-rules/playground`)
        await page.locator('[data-playground-page]').waitFor({ timeout: 60000 })
      },
      '[data-outcome-line="1"]',
    )

    // 1. the leaf, the panes, the seed
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} 1. the rail has the Playground leaf`, (await page.locator('a[href="/insurance-rules/playground"]').count()) >= 1)
    check(`${dir} 1. the title`, strip(await page.locator('h1').first().innerText()) === w.title, strip(await page.locator('h1').first().innerText()))
    const panes = await page.locator('[data-pane]').evaluateAll((els) => els.map((e) => e.getAttribute('data-pane')))
    check(`${dir} 1. three panes: Data | Rule | Outcome`, JSON.stringify(panes) === JSON.stringify(['data', 'document', 'outcome']), JSON.stringify(panes))
    const seed = await docText(page)
    check(`${dir} 1. the rule box is seeded with one guard rule`, seed.schema === 1 && seed.kind === 'guard' && seed.revision === 0 && seed.rules.length === 1)
    check(`${dir} 1. the JSON boxes are typed left to right`, (await box(page, 'data').getAttribute('dir')) === 'ltr' && (await box(page, 'document').getAttribute('dir')) === 'ltr')
    check(`${dir} 2. no Run button`, (await page.locator('[data-run]').count()) === 0)
    check(`${dir} 2. the seed ran by itself, once`, opened === 1, String(opened))
    const sent = store.evaluates.at(-1)
    check(`${dir} 2. the body is { kind, data, document, asOf }`, JSON.stringify(Object.keys(sent ?? {})) === JSON.stringify(['kind', 'data', 'document', 'asOf']), JSON.stringify(Object.keys(sent ?? {})))
    check(`${dir} 2. kind is guard`, sent?.kind === 'guard')
    check(`${dir} 2. asOf is local yyyy-MM-ddTHH:mm:ss, no Z`, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(sent?.asOf ?? ''), sent?.asOf)
    check(`${dir} 2. the document is the box's`, JSON.stringify(sent?.document) === JSON.stringify(seed))
    check(`${dir} 2. the data is the box's`, JSON.stringify(sent?.data) === JSON.stringify(JSON.parse(await box(page, 'data').inputValue())))
    check(`${dir} 2. line 1 is matched`, (await page.locator('[data-matched-lines="1"]').count()) === 1 && (await page.locator('[data-outcome-line="1"][data-matched="true"]').count()) === 1)
    check(`${dir} 2. "nothing matched" is not shown`, (await page.locator('[data-nothing-matched]').count()) === 0)
    const row = page.locator('[data-outcome-line="1"] [data-trace-row="G-1:when[0]"]')
    check(`${dir} 2. the trace row G-1 · when[0] is True`, (await row.locator('[data-trace-value="true"]').count()) === 1 && strip(await row.locator('[data-trace-value]').innerText()) === w.true)
    check(`${dir} 2. rule and block are ltr isolates`, (await row.locator('td bdi[dir="ltr"]').count()) === 2)
    check(`${dir} 2. why is free text in a <bdi>`, strip(await row.locator('[data-why] bdi').innerText()) === 'daysSupply 120 > 90')
    check(`${dir} 2. no raw keys`, await noRawKeys(page))
    await page.screenshot({ path: `tools/.insurance-playground-shots/${dir}-matched.png`, fullPage: true }).catch(() => {})

    // 3. nothing matches
    await editAndWait(page, store, () => setDoc(page, { ...seed, rules: [{ ...seed.rules[0], when: [{ check: 'line', field: 'daysSupply', above: 200 }] }] }), '[data-nothing-matched]')
    check(`${dir} 3. "nothing matched"`, (await page.locator('[data-nothing-matched]').count()) === 1 && strip(await page.locator('[data-nothing-matched]').innerText()) === w.nothing)
    check(`${dir} 3. the line's trace still shows why: False`, (await page.locator('[data-outcome-line="1"][data-matched="false"] [data-trace-row="G-1:when[0]"] [data-trace-value="false"]').count()) === 1)

    // 4. JSON that does not parse
    const sentBad = await editAndWait(page, store, () => box(page, 'data').fill('{ "lines": ['), '[data-json-problem="data"]')
    check(`${dir} 4. bad JSON is said in words`, (await page.locator('[data-json-problem="data"]').count()) === 1 && (await box(page, 'data').getAttribute('aria-invalid')) === 'true')
    check(`${dir} 4. and never sent`, sentBad === 0)
    check(`${dir} 4. the last good outcome stays`, (await page.locator('[data-nothing-matched]').count()) === 1)

    // 5. a reader error shows alone (two edits inside the window: one request)
    const twoEdits = await editAndWait(
      page,
      store,
      async () => {
        await box(page, 'data').fill(JSON.stringify(sent.data))
        await setDoc(page, { ...seed, rules: [{ ...seed.rules[0], when: [{ check: 'bogus' }] }] })
      },
      '[data-reader-errors]',
    )
    check(`${dir} 9. two quick edits make one request`, twoEdits === 1, String(twoEdits))
    check(`${dir} 5. the reader error, path ltr`, (await page.locator('[data-reader-error="rules[0].when[0].check"] bdi[dir="ltr"]').count()) === 1)
    check(`${dir} 5. its message`, strip(await page.locator('[data-reader-error] [data-error-message]').innerText()) === 'Unknown check "bogus".')
    check(`${dir} 5. nothing else: no lines, no "nothing matched"`, (await page.locator('[data-outcome-line], [data-nothing-matched], [data-matched-lines]').count()) === 0)
    check(`${dir} 4. the data problem cleared once it parses`, (await page.locator('[data-json-problem]').count()) === 0)

    // 6. a PLAYGROUND_* refusal
    await editAndWait(
      page,
      store,
      async () => {
        await setDoc(page, seed)
        await box(page, 'data').fill('{}')
      },
      '[data-refusal-code]',
    )
    check(`${dir} 6. a refusal shows its code`, (await page.locator('[data-refusal-code="PLAYGROUND_DATA_INVALID"]').count()) === 1)
    const banner = strip(await page.locator('[data-pane="outcome"] [role="alert"]').innerText())
    check(`${dir} 6. and its message, never "unexpected"`, banner.includes('The data has no lines to evaluate.') && !/unexpected/i.test(banner), banner)

    // ── 678 ──
    // 9. typing many keys inside the window: one request, and the outcome refreshes with no Run
    await editAndWait(page, store, () => box(page, 'data').fill(JSON.stringify(sent.data)), '[data-outcome-line="1"]')
    await box(page, 'data').focus()
    await box(page, 'data').press('Control+End')
    const typed = await editAndWait(page, store, () => box(page, 'data').pressSequentially('    ', { delay: 80 }), '[data-outcome-line="1"]')
    check(`${dir} 9. typing makes one request`, typed === 1, String(typed))
    check(`${dir} 9. the outcome refreshed by itself`, (await page.locator('[data-matched-lines="1"]').count()) === 1 && (await page.locator('[data-refusal-code]').count()) === 0)

    // 10. a slow older reply is dropped: edit A (nothing matches) answers slowly, edit B (matches) answers first
    slow.push(2500, 0)
    const nothingDoc = { ...seed, rules: [{ ...seed.rules[0], when: [{ check: 'line', field: 'daysSupply', above: 200 }] }] }
    const beforeAB = store.evaluates.length
    await setDoc(page, nothingDoc)
    for (let i = 0; i < 30 && store.evaluates.length === beforeAB; i++) await sleep(100)
    await page.locator('[data-running]').waitFor({ timeout: 3000 }).catch(() => {})
    check(`${dir} 10. "running…" shows while A is in flight`, (await page.locator('[data-running]').count()) === 1)
    check(`${dir} 10. and the last good outcome stays meanwhile`, (await page.locator('[data-matched-lines="1"]').count()) === 1)
    await setDoc(page, seed)
    for (let i = 0; i < 30 && store.evaluates.length < beforeAB + 2; i++) await sleep(100)
    check(`${dir} 10. A and B were both sent`, store.evaluates.length === beforeAB + 2, String(store.evaluates.length - beforeAB))
    await sleep(3200)
    check(`${dir} 10. A's late answer is dropped: B's outcome stays`, (await page.locator('[data-matched-lines="1"]').count()) === 1 && (await page.locator('[data-nothing-matched]').count()) === 0)
    check(`${dir} 10. nothing is running once B answered`, (await page.locator('[data-running]').count()) === 0)

    // 11. as of
    const asOfDefault = await page.locator('[data-as-of]').inputValue()
    check(`${dir} 11. as of defaults to local now`, /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?$/.test(asOfDefault) && sent.asOf.startsWith(asOfDefault.slice(0, 13)), asOfDefault)
    await editAndWait(page, store, () => page.locator('[data-as-of]').fill('2026-01-02T03:04:05'), '[data-as-of-sent="2026-01-02T03:04:05"]')
    check(`${dir} 11. as of is sent as typed, no Z`, store.evaluates.at(-1)?.asOf === '2026-01-02T03:04:05', store.evaluates.at(-1)?.asOf)
    check(`${dir} 11. and shown isolated`, (await page.locator('[data-as-of-sent="2026-01-02T03:04:05"] bdi[dir="ltr"]').count()) === 1)
    check(`${dir} 11. the input is typed left to right`, (await page.locator('[data-as-of]').getAttribute('dir')) === 'ltr')

    // 12. Tab B — guard
    await page.locator('[data-tab="live"]').click()
    const gLine = page.locator('[data-verdict="guard"] [data-verdict-line="1"]')
    check(`${dir} 12. guard: line 1 warns`, (await gLine.getAttribute('data-outcome').catch(() => null)) === 'warn')
    check(
      `${dir} 12. guard: G-1 fired, its message in a <bdi>`,
      (await gLine.locator('[data-fired="G-1"] [data-rule-id] bdi[dir="ltr"]').count()) === 1 && strip(await gLine.locator('[data-fired-message]').innerText()) === 'More than 90 days of supply',
    )
    check(`${dir} 12. guard: the severity`, (await gLine.locator('[data-fired="G-1"] [data-severity="WARN"]').count()) === 1)

    // 12. switch to category: the kind's rule and data, Tab B's categories
    await editAndWait(page, store, () => page.locator('[data-kind="category"]').click(), '[data-verdict="category"]')
    const cSent = store.evaluates.at(-1)
    check(`${dir} 12. category: kind picked`, (await page.locator('[data-kind="category"][aria-pressed="true"]').count()) === 1)
    check(`${dir} 12. category: the body and the seeded document are category`, cSent?.kind === 'category' && cSent?.document?.kind === 'category' && (await docText(page)).kind === 'category')
    check(`${dir} 12. category: still Tab B`, (await page.locator('[data-tab="live"][aria-selected="true"]').count()) === 1)
    const cRow = page.locator('[data-category-line="1"]')
    check(
      `${dir} 12. category: line 1 is Brand · G2, set by rule K-1`,
      (await cRow.getAttribute('data-source').catch(() => null)) === 'rule' &&
        (await cRow.locator('[data-category="Brand"] bdi[dir="ltr"]').count()) === 1 &&
        (await cRow.locator('[data-group="G2"]').count()) === 1 &&
        (await cRow.locator('[data-rule-id]').innerText().catch(() => '')).includes('K-1'),
    )
    check(`${dir} 12. category: who set it in words`, strip(await cRow.locator('td').nth(3).innerText()) === 'A category rule')

    // 12. switch to coverage: the data carries the payer; each value and its source
    await editAndWait(page, store, () => page.locator('[data-kind="coverage"]').click(), '[data-verdict="coverage"]')
    const vSent = store.evaluates.at(-1)
    check(`${dir} 12. coverage: the data carries the payer`, vSent?.kind === 'coverage' && typeof vSent?.data?.payer === 'object' && vSent.data.payer !== null)
    const qty = page.locator('[data-coverage="line-1"] [data-coverage-value="quantityCap"]')
    check(
      `${dir} 12. coverage: the quantity cap 1, filled by rule C-1`,
      (await qty.getAttribute('data-source').catch(() => null)) === 'rule' && strip(await qty.locator('[data-value]').innerText()) === '1' && (await qty.locator('[data-rule-id]').innerText()).includes('C-1'),
    )
    const dmax = page.locator('[data-coverage="line-1"] [data-coverage-value="deductibleMax"]')
    check(
      `${dir} 12. coverage: the payer's deductible maximum as money, isolated`,
      (await dmax.getAttribute('data-source').catch(() => null)) === 'payer' && strip(await dmax.locator('[data-value]').innerText()) === '50.00' && (await dmax.locator('[data-value] bdi[dir="ltr"]').count()) === 1,
    )
    check(`${dir} 12. coverage: the invoice rows`, (await page.locator('[data-coverage="invoice"] [data-coverage-value]').count()) === 2)
    await page.screenshot({ path: `tools/.insurance-playground-shots/${dir}-coverage-live.png`, fullPage: true }).catch(() => {})

    check(`${dir} 8. no raw keys`, await noRawKeys(page))
    check(`${dir} 8. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 7. a bare 403
  {
    const { context, page, errors, store } = await open(dir, { deny: ['evaluate'] })
    await editAndWait(
      page,
      store,
      async () => {
        await page.goto(`${BASE}/insurance-rules/playground`)
        await page.locator('[data-playground-page]').waitFor({ timeout: 60000 })
      },
      '[data-playground-denied]',
    )
    check(`${dir} 7. a bare 403 is the no-access words`, (await page.locator('[data-playground-denied]').count()) === 1 && strip(await page.locator('[data-playground-denied]').innerText()).startsWith(w.denied))
    check(`${dir} 8. no page errors (403 pass)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
