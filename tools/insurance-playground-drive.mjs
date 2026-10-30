// Insurance rules ▸ Playground drive (BackOffice spec 3243, doors 3244 + 3245; oms tickets 677, 678, 679, 680).
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
//   680: 20. category: two rules in either order change Tab B's category (first match), the group picked in the
//            editor; 21. coverage: an in-list rule picks from the document's lists, edits and runs; 22. its reader
//            error on its block; 23. an effect the editors cannot show is JSON-only.
//
// Stub section 678 (`playgroundVerdict`) answers the verdict; 680 evaluates an in-list block; the slow reply is this drive's own route delay.
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

  // ── 679 ── the guard mini ruleset, built with the real editors, the JSON in step both ways, errors on their block
  {
    const { context, page, errors, store } = await open(dir)
    await editAndWait(
      page,
      store,
      async () => {
        await page.goto(`${BASE}/insurance-rules/playground`)
        await page.locator('[data-playground-page]').waitFor({ timeout: 60000 })
      },
      '[data-outcome-line="1"]',
    )
    const seed = await docText(page)
    const slot = (i) => page.locator(`[data-rule-slot="${i}"]`)
    const ids = async () => page.locator('[data-rule-slot]').evaluateAll((els) => els.map((e) => e.getAttribute('data-slot-rule-id')))

    // 13. the seeded rule is drawn with the guard editors and read as words
    check(`${dir} 13. one rule, editable`, (await page.locator('[data-rule-slot]').count()) === 1 && (await slot(0).getAttribute('data-editable')) === 'true')
    check(`${dir} 13. WHEN / IF / THEN editors`, (await slot(0).locator('[data-part="when"], [data-part="if"] [data-condition-root], [data-part="then"]').count()) === 3)
    check(`${dir} 13. its line block shows 90`, (await slot(0).locator('[data-block="0"] [data-input="lineValue"]').inputValue()) === '90')
    check(`${dir} 13. the sentence view under the rule`, (await slot(0).locator('[data-rule-words] [data-sentence]').count()) >= 1)

    // 14. add a second rule, move it first: the JSON follows; the first rule's JSON is unchanged
    const added = await editAndWait(page, store, () => page.locator('[data-add-rule]').click(), '[data-rule-slot="1"]')
    let doc = await docText(page)
    check(`${dir} 14. add: the JSON has two rules, the new one G-002`, doc.rules.length === 2 && doc.rules[1].id === 'G-002', JSON.stringify(doc.rules.map((r) => r.id)))
    check(`${dir} 14. add ran the experiment`, added === 1, String(added))
    await editAndWait(page, store, () => page.locator('[data-move-up="1"]').click(), null)
    doc = await docText(page)
    check(`${dir} 14. move up: the JSON order follows`, JSON.stringify(doc.rules.map((r) => r.id)) === '["G-002","G-1"]', JSON.stringify(doc.rules.map((r) => r.id)))
    check(`${dir} 14. move up: the editors' order follows`, JSON.stringify(await ids()) === '["G-002","G-1"]', JSON.stringify(await ids()))
    check(`${dir} 14. the moved seed rule's JSON is untouched`, JSON.stringify(doc.rules[1]) === JSON.stringify(seed.rules[0]))
    check(`${dir} 14. the first rule cannot move up, the last cannot move down`, (await page.locator('[data-move-up="0"]').isDisabled()) && (await page.locator('[data-move-down="1"]').isDisabled()))

    // 15. an editor edit rewrites the JSON in the engine's spelling
    await editAndWait(page, store, () => slot(1).locator('[data-block="0"] [data-input="lineValue"]').fill('60'), null)
    doc = await docText(page)
    check(`${dir} 15. the editor's 60 is in the JSON`, doc.rules[1].when[0].above === 60, JSON.stringify(doc.rules[1].when))

    // 16. a JSON edit moves the editors
    await editAndWait(page, store, () => setDoc(page, { ...seed, rules: [{ ...seed.rules[0], when: [{ check: 'line', field: 'daysSupply', above: 150 }] }] }), null)
    check(`${dir} 16. the editors follow the JSON: one rule`, JSON.stringify(await ids()) === '["G-1"]', JSON.stringify(await ids()))
    check(`${dir} 16. and its value 150`, (await slot(0).locator('[data-block="0"] [data-input="lineValue"]').inputValue()) === '150')

    // 17. a reader error lands on its block: add a patient block in the editor, the stub refuses it at rules[0].when[1].check
    await editAndWait(page, store, () => slot(0).locator('select[data-add-condition=""]').selectOption('patient'), '[data-rule-slot="0"] [data-issues="1"]')
    doc = await docText(page)
    check(`${dir} 17. the editor's new block is in the JSON`, doc.rules[0].when[1]?.check === 'patient', JSON.stringify(doc.rules[0].when))
    const onBlock = slot(0).locator('[data-block="1"] [data-issues="1"] [data-issue="error"]')
    check(`${dir} 17. the error is on block 1`, (await onBlock.count()) === 1 && strip(await onBlock.innerText()) === 'Unknown check "patient".')
    check(`${dir} 17. the block is marked`, /border-danger/.test((await slot(0).locator('[data-block="1"]').getAttribute('class')) ?? ''))
    check(`${dir} 17. the outcome says it is shown on its block, not in its list`, (await page.locator('[data-errors-on-blocks="1"]').count()) === 1 && (await page.locator('[data-reader-error]').count()) === 0)

    // 18. a rule the editors cannot show is JSON-only and still runs; its error stays in the outcome's list
    const odd = { id: 'G-9', when: [{ check: 'bogus' }], then: [] }
    await editAndWait(page, store, () => setDoc(page, { ...seed, rules: [seed.rules[0], odd] }), '[data-reader-error]')
    check(`${dir} 18. the odd rule is JSON-only, with a note`, (await slot(1).getAttribute('data-editable')) === 'false' && (await slot(1).locator('[data-json-only]').count()) === 1)
    check(`${dir} 18. it was sent as written`, JSON.stringify(store.evaluates.at(-1)?.document?.rules?.[1]) === JSON.stringify(odd))
    check(`${dir} 18. its error stays in the outcome's list`, (await page.locator('[data-reader-error="rules[1].when[0].check"]').count()) === 1 && (await page.locator('[data-errors-on-blocks]').count()) === 0)
    await editAndWait(page, store, () => page.locator('[data-move-up="1"]').click(), null)
    doc = await docText(page)
    check(`${dir} 18. moved by the editors, the JSON-only rule is kept byte-for-byte`, JSON.stringify(doc.rules[0]) === JSON.stringify(odd) && doc.rules[1].id === 'G-1')
    await page.screenshot({ path: `tools/.insurance-playground-shots/${dir}-ruleset.png`, fullPage: true }).catch(() => {})

    // 19. JSON that does not parse: the editors keep the last good rules, disabled
    await box(page, 'document').fill('{ "rules": [')
    await sleep(300)
    check(`${dir} 19. broken JSON: the editors stay, disabled, with a note`, (await page.locator('fieldset[data-ruleset][disabled]').count()) === 1 && (await page.locator('[data-ruleset-stale]').count()) === 1 && (await page.locator('[data-rule-slot]').count()) === 2)
    await setDoc(page, seed)
    await sleep(300)
    check(`${dir} 19. fixed: enabled again`, (await page.locator('fieldset[data-ruleset][disabled]').count()) === 0 && (await page.locator('[data-rule-slot]').count()) === 1)

    // ── 680 ── coverage and category mini rulesets, built with their real editors, the JSON in step
    // 20. category: two rules, the first match sets the category, so the order is what Tab B shows
    await page.locator('[data-tab="live"]').click()
    await editAndWait(page, store, () => page.locator('[data-kind="category"]').click(), '[data-verdict="category"]')
    const cat0 = await docText(page)
    const K1 = { id: 'K-1', name: { en: 'Long supply', ar: 'صرف طويل' }, when: [{ check: 'line', field: 'daysSupply', above: 90 }], then: [{ effect: 'setCategory', group: 'G2' }] }
    const K2 = { id: 'K-2', when: [{ check: 'line', field: 'daysSupply', above: 30 }], then: [{ effect: 'setCategory', group: 'G3' }] }
    const catLine = page.locator('[data-category-line="1"]')
    const catBy = async () => ({
      group: await catLine.locator('[data-group]').first().getAttribute('data-group').catch(() => null),
      rule: strip(await catLine.locator('[data-rule-id]').innerText().catch(() => '')),
    })
    await editAndWait(page, store, () => setDoc(page, { ...cat0, rules: [K1, K2] }), null)
    check(`${dir} 20. category: two rules, both drawn with the category editors`, (await page.locator('[data-rule-slot]').count()) === 2 && (await page.locator('[data-rule-slot][data-editable="true"] [data-rule-kind="category"]').count()) === 2)
    check(`${dir} 20. category: the first-match order is said above the rules`, (await page.locator('[data-ruleset-order="category"]').count()) === 1)
    check(`${dir} 20. category: each rule's group is picked in its editor`, (await slot(0).locator('[data-group-pick="G2"][aria-checked="true"]').count()) === 1 && (await slot(1).locator('[data-group-pick="G3"][aria-checked="true"]').count()) === 1)
    check(`${dir} 20. category: the rule reads as words`, strip(await slot(0).locator('[data-reads-then]').innerText()).includes('G2'))
    let by = await catBy()
    check(`${dir} 20. category: K-1 first → Brand G2 by K-1`, by.group === 'G2' && by.rule.includes('K-1'), JSON.stringify(by))
    await editAndWait(page, store, () => page.locator('[data-move-up="1"]').click(), null)
    doc = await docText(page)
    check(`${dir} 20. category: move K-2 up, the JSON order follows`, JSON.stringify(doc.rules.map((r) => r.id)) === '["K-2","K-1"]', JSON.stringify(doc.rules.map((r) => r.id)))
    check(`${dir} 20. category: both rules kept as written`, JSON.stringify(doc.rules) === JSON.stringify([K2, K1]))
    by = await catBy()
    check(`${dir} 20. category: K-2 first → NonMed G3 by K-2`, by.group === 'G3' && by.rule.includes('K-2'), JSON.stringify(by))
    await editAndWait(page, store, () => slot(0).locator('[data-group-pick="G1"]').click(), null)
    doc = await docText(page)
    check(`${dir} 20. category: picking Generic writes G1 in the JSON`, doc.rules[0].then[0].group === 'G1' && JSON.stringify(doc.rules[1]) === JSON.stringify(K1), JSON.stringify(doc.rules[0].then))
    by = await catBy()
    check(`${dir} 20. category: and Tab B follows: G1 by K-2`, by.group === 'G1' && by.rule.includes('K-2'), JSON.stringify(by))
    await editAndWait(page, store, () => page.locator('[data-add-rule]').click(), '[data-rule-slot="2"]')
    doc = await docText(page)
    check(`${dir} 20. category: a new rule is K-003, last, setting Brand`, doc.rules.length === 3 && doc.rules[2].id === 'K-003' && doc.rules[2].then[0].group === 'G2', JSON.stringify(doc.rules[2]))
    await page.screenshot({ path: `tools/.insurance-playground-shots/${dir}-category-ruleset.png`, fullPage: true }).catch(() => {})

    // 21. coverage: a rule on an in-list condition, the document's lists offered to it; it edits and runs
    await editAndWait(page, store, () => page.locator('[data-kind="coverage"]').click(), '[data-verdict="coverage"]')
    const cov0 = await docText(page)
    const LISTS = [
      { id: 'L-INS', name: { en: 'Insulin', ar: 'إنسولين' }, filters: [{ articles: ['200021'], categories: [], attributes: [] }], include: [], exclude: [] },
      { id: 'L-OTHER', name: { en: 'Other', ar: 'أخرى' }, filters: [{ articles: ['999999'], categories: [], attributes: [] }], include: [], exclude: [] },
    ]
    const C1 = { id: 'C-1', name: { en: 'Insulin cap', ar: 'سقف الإنسولين' }, when: [{ check: 'line', inList: 'L-INS' }], then: [{ effect: 'quantityCap', value: 2 }] }
    const qtyOf = page.locator('[data-coverage="line-1"] [data-coverage-value="quantityCap"]')
    const qty = async () => ({ source: await qtyOf.getAttribute('data-source').catch(() => null), value: strip(await qtyOf.locator('[data-value]').innerText().catch(() => '')) })
    const itemList = () => slot(0).locator('[data-block="0"] select[data-input="itemList"]')
    await editAndWait(page, store, () => setDoc(page, { ...cov0, lists: LISTS, rules: [C1] }), null)
    check(`${dir} 21. coverage: the rule is drawn with the coverage editors`, (await slot(0).getAttribute('data-editable')) === 'true' && (await slot(0).locator('[data-rule-kind="coverage"] [data-coverage-effect]').count()) === 1)
    check(`${dir} 21. coverage: the order rule is said above the rules`, (await page.locator('[data-ruleset-order="coverage"]').count()) === 1)
    check(`${dir} 21. coverage: the in-list block picks from the document's lists`, (await itemList().inputValue()) === 'L-INS' && (await itemList().locator('option').count()) === 2)
    check(`${dir} 21. coverage: the sentence view reads the rule`, (await slot(0).locator('[data-rule-words] [data-sentence]').count()) >= 1)
    let q = await qty()
    check(`${dir} 21. coverage: it runs: quantity cap 2 from C-1`, q.source === 'rule' && q.value === '2', JSON.stringify(q))
    await editAndWait(page, store, () => slot(0).locator('[data-coverage-effect] [data-input="value"]').fill('3'), null)
    doc = await docText(page)
    check(`${dir} 21. coverage: the editor's 3 is in the JSON, the lists kept`, doc.rules[0].then[0].value === 3 && JSON.stringify(doc.lists) === JSON.stringify(LISTS), JSON.stringify(doc.rules[0].then))
    q = await qty()
    check(`${dir} 21. coverage: and Tab B follows: 3`, q.source === 'rule' && q.value === '3', JSON.stringify(q))
    await editAndWait(page, store, () => itemList().selectOption('L-OTHER'), null)
    doc = await docText(page)
    check(`${dir} 21. coverage: picking the other list writes it`, doc.rules[0].when[0].inList === 'L-OTHER', JSON.stringify(doc.rules[0].when))
    q = await qty()
    check(`${dir} 21. coverage: the item is not in it: no cap`, q.source === 'none', JSON.stringify(q))

    // 22. coverage: a reader error lands on its block (the stub refuses a patient block)
    await editAndWait(page, store, () => slot(0).locator('select[data-add-condition=""]').selectOption('patient'), '[data-rule-slot="0"] [data-issues="1"]')
    const covErr = slot(0).locator('[data-block="1"] [data-issues="1"] [data-issue="error"]')
    check(`${dir} 22. coverage: the error is on block 1`, (await covErr.count()) === 1 && strip(await covErr.innerText()) === 'Unknown check "patient".')
    check(`${dir} 22. coverage: the block is marked`, /border-danger/.test((await slot(0).locator('[data-block="1"]').getAttribute('class')) ?? ''))
    check(`${dir} 22. coverage: shown on its block, not in the list`, (await page.locator('[data-errors-on-blocks="1"]').count()) === 1 && (await page.locator('[data-reader-error]').count()) === 0)

    // 23. coverage: an effect the editors cannot show keeps the rule JSON-only, sent as written
    const oddC = { id: 'C-9', when: [], then: [{ effect: 'refund', value: 3 }] }
    await editAndWait(page, store, () => setDoc(page, { ...cov0, lists: LISTS, rules: [C1, oddC] }), null)
    check(`${dir} 23. coverage: the odd rule is JSON-only, with a note`, (await slot(1).getAttribute('data-editable')) === 'false' && (await slot(1).locator('[data-json-only]').count()) === 1)
    check(`${dir} 23. coverage: it was sent as written`, JSON.stringify(store.evaluates.at(-1)?.document?.rules?.[1]) === JSON.stringify(oddC))
    await page.screenshot({ path: `tools/.insurance-playground-shots/${dir}-coverage-ruleset.png`, fullPage: true }).catch(() => {})

    check(`${dir} 13. no raw keys`, await noRawKeys(page))
    check(`${dir} 13. no page errors`, errors.length === 0, errors.join(' | '))
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
