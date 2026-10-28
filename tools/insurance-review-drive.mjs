// Insurance rules ▸ Review + Exceptions drive (BackOffice spec 3126; oms ticket 614).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/insurance-rules-stubs.mjs`, section
// 614 — `createReviewStubs()`, stateful per page):
//   GET  InsuranceRules/Review?pharmacist&store&rule&reason&kind  → REVIEW_ROWS, filtered
//   POST InsuranceRules/Review/{id}           { mark, note }
//   GET  InsuranceRules/Exceptions            → EXCEPTIONS            (🚩 guessed list door)
//   POST InsuranceRules/Exceptions            { patientKey, ruleId|null, scope, validUntil, reason, note }
//   POST InsuranceRules/Exceptions/{id}/Revoke {}
//   GET  InsuranceRules/Exceptions/{id}/Log   → EXCEPTION_LOGS
//   GET  Guards/Reasons                        → GUARD_REASONS
//   GET  InsuranceRules/Guards/Draft           → RULESET (rule and list pickers)
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 3134/3135/3141 are unbuilt; 618 swaps in the live doors.
// The browser's clock is fixed at 2026-10-27 10:00 Asia/Riyadh, so "today + 90" is 2027-01-25.
//
// It verifies, in LTR and RTL:
//   1. the rail has Review and Exceptions; the review list shows every kind, with store/pharmacist/patient/rule
//      as ltr isolates, reason as one `code · words` isolate, a free-text note in a <bdi>, and its mark;
//   2. filters: kind, rule, reason (immediate) and pharmacist/store (on Search) reach the door's query and the URL;
//      Clear empties them; nothing matching says so;
//   3. marking: OK with no note posts `{ mark: 'ok', note: '' }`; Questioned refuses an empty note, then posts it
//      and the row shows the mark, note and who; a refusal toasts the server's message;
//   4. exceptions: every row with its rule (or All guards), scope, valid until, reason, status (active / revoked /
//      expired by local day), uses; the log shows issue and uses; Revoke (confirmed) posts and the row turns revoked;
//   5. issue: the form refuses empties and a day past today + 90 (the date input's max is 2027-01-25), then posts
//      the exact body (all guards → ruleId null; scope by kind) and the new exception tops the list;
//   6. a bare 403 on either read is "You do not have access";
//   7. no raw keys and no page errors.
//
//   1. run the app:  npx vite --port 5135 --strictPort
//   2. node tools/insurance-review-drive.mjs        (DRIVE_PORT overrides 5135)
import { createRequire } from 'node:module'
import { createReviewStubs, envelope, insuranceRulesStub } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5135}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, { deny = [], refuse = {} } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  await page.clock.setFixedTime(new Date('2026-10-27T10:00:00+03:00'))
  const errors = []
  const writes = []
  const reads = {}
  const queries = []
  const review = createReviewStubs({ deny, writes, refuse, reads })
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
    if (p === 'InsuranceRules/Review' && req.method() === 'GET') queries.push(url.searchParams.toString())
    const body = req.method() === 'GET' ? null : req.postDataJSON()
    const mine = review(req.method(), p, body, url.searchParams)
    if (mine) return route.fulfill(mine)
    const hit = insuranceRulesStub(req.method(), p, body, {})
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, writes, reads, queries }
}

const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const rowIds = (page, sel, attr) => page.locator(sel).evaluateAll((els, a) => els.map((e) => e.getAttribute(a)), attr)
const reviewIds = (page) => rowIds(page, '[data-review-row]', 'data-review-row')
const noRawKeys = async (page) => !/insurance-(review|rules):|\b(review|filter|kind|mark|exceptions|exceptionColumns|scope|status|issue|problem|log|columns)\.[a-z]/.test(await page.locator('main').innerText())
const waitRows = (page, n) =>
  page.waitForFunction((k) => document.querySelectorAll('[data-review-row]').length === k, n, { timeout: 8000 }).catch(() => {})
const toast = (page) => page.locator('[data-sonner-toast]').last()

for (const dir of ['ltr', 'rtl']) {
  // ── 1–3: the review list ────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, writes, queries } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/review`)
    await page.locator('[data-review-row]').first().waitFor({ timeout: 30000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} 1. the rail has Review and Exceptions`, (await page.locator('a[href="/insurance-rules/review"]').count()) >= 1 && (await page.locator('a[href="/insurance-rules/exceptions"]').count()) >= 1)
    check(`${dir} 1. the title`, strip(await page.locator('h1').first().innerText()) === 'Review')
    check(`${dir} 1. every row, in the door's order`, JSON.stringify(await reviewIds(page)) === JSON.stringify(['D-9001', 'D-9002', 'D-9003', 'D-9004', 'D-9005']), JSON.stringify(await reviewIds(page)))
    check(`${dir} 1. the first read sends no filter`, queries[0] === '', JSON.stringify(queries))
    const r1 = page.locator('[data-review-row="D-9001"]')
    check(
      `${dir} 1. store, pharmacist, masked patient and rule are ltr isolates`,
      (await r1.locator('[data-store] bdi[dir="ltr"]').innerText()) === 'P107' &&
        (await r1.locator('[data-pharmacist] bdi[dir="ltr"]').innerText()) === 'PH-1107-03' &&
        (await r1.locator('[data-patient] bdi[dir="ltr"]').innerText()) === '10••••••83' &&
        (await r1.locator('[data-rule-id] bdi[dir="ltr"]').innerText()) === 'G-002',
    )
    check(`${dir} 1. the reason is one "code · words" isolate`, (await r1.locator('[data-reason="05"] bdi[dir="ltr"]').innerText()) === '05 · Therapy change')
    // 618: as built a review row's `item` is the item code (a request's items comma-separated) — HQ sends no name.
    check(`${dir} 1. the item is the code, an ltr isolate`, strip(await r1.locator('[data-col="item"] bdi[dir="ltr"]').innerText()) === '100234', strip(await r1.locator('[data-col="item"]').innerText()))
    check(`${dir} 1. an Arabic note sits in a <bdi>`, (await page.locator('[data-review-row="D-9002"] [data-col="note"] bdi').innerText()) === 'تلف القلم أثناء النقل')
    check(`${dir} 1. kind words; the exception row names its exception`, strip(await page.locator('[data-review-row="D-9003"] [data-col="kind"]').innerText()) === 'Exception used#X-101' && (await page.locator('[data-review-row="D-9003"] [data-exception-id="X-101"] bdi[dir="ltr"]').innerText()) === '#X-101' && strip(await page.locator('[data-review-row="D-9004"] [data-col="kind"]').innerText()) === 'Unchecked', strip(await page.locator('[data-review-row="D-9003"] [data-col="kind"]').innerText()))
    check(`${dir} 1. an unchecked row ran no rule`, strip(await page.locator('[data-review-row="D-9004"] [data-col="rule"]').innerText()) === 'No rule ran')
    check(
      `${dir} 1. marks: Not reviewed, Questioned with note and who, OK`,
      strip(await r1.locator('[data-col="mark"]').innerText()) === 'Not reviewed' &&
        strip(await page.locator('[data-review-row="D-9002"] [data-col="mark"]').innerText()) === 'Questioned Third lost pen this month by rev.salem 2026-10-27 08:30' &&
        (await page.locator('[data-review-row="D-9005"] [data-col="mark"]').getAttribute('data-mark')) === 'ok',
      strip(await page.locator('[data-review-row="D-9002"] [data-col="mark"]').innerText()),
    )
    check(`${dir} 1. "5 rows"`, strip(await page.locator('[data-review-count]').innerText()) === '5 rows')
    check(`${dir} 1. no raw keys`, await noRawKeys(page))

    // 2. filters
    await page.locator('[data-kind-filter="override"]').click()
    await waitRows(page, 3)
    check(`${dir} 2. kind Override keeps the overrides`, JSON.stringify(await reviewIds(page)) === JSON.stringify(['D-9001', 'D-9002', 'D-9005']) && new URL(page.url()).searchParams.get('kind') === 'override' && (await page.locator('[data-kind-filter="override"]').getAttribute('aria-pressed')) === 'true')
    await page.locator('[data-filter="rule"]').selectOption('G-002')
    await waitRows(page, 2)
    check(`${dir} 2. rule G-002 narrows it`, JSON.stringify(await reviewIds(page)) === JSON.stringify(['D-9001', 'D-9005']), JSON.stringify(await reviewIds(page)))
    await page.locator('[data-filter="reason"]').selectOption('03')
    await waitRows(page, 1)
    check(`${dir} 2. reason 03 narrows it again; the door got all three`, JSON.stringify(await reviewIds(page)) === JSON.stringify(['D-9005']) && queries.at(-1) === 'rule=G-002&reason=03&kind=override', queries.at(-1))
    await page.locator('[data-review-clear]').click()
    await waitRows(page, 5)
    check(`${dir} 2. Clear empties every filter`, (await reviewIds(page)).length === 5 && new URL(page.url()).search === '' && (await page.locator('[data-filter="rule"]').inputValue()) === '')
    await page.locator('[data-filter="store"]').fill('P107')
    await page.locator('[data-filter="pharmacist"]').fill('PH-1107-03')
    check(`${dir} 2. typing alone does not search`, (await reviewIds(page)).length === 5)
    await page.locator('[data-review-search]').click()
    await waitRows(page, 2)
    check(`${dir} 2. Search sends pharmacist and store`, JSON.stringify(await reviewIds(page)) === JSON.stringify(['D-9001', 'D-9005']) && queries.at(-1) === 'pharmacist=PH-1107-03&store=P107', queries.at(-1))
    await page.locator('[data-kind-filter="unchecked"]').click()
    await page.locator('[data-review-empty]').waitFor({ timeout: 8000 }).catch(() => {})
    check(`${dir} 2. nothing matching says so`, strip(await page.locator('[data-review-empty]').innerText()) === 'Nothing to review for these filters.')
    await page.locator('[data-review-clear]').click()
    await waitRows(page, 5)

    // 3. marking
    await r1.locator('[data-mark-action="ok"]').click()
    await page.locator('[data-mark-dialog="ok"]').waitFor({ timeout: 5000 })
    await page.locator('[data-mark-save]').click()
    await page.locator('[data-review-row="D-9001"] [data-col="mark"][data-mark="ok"]').waitFor({ timeout: 8000 }).catch(() => {})
    check(`${dir} 3. OK with no note posts { mark: ok, note: "" }`, JSON.stringify(writes.at(-1)) === JSON.stringify({ method: 'POST', path: 'InsuranceRules/Review/D-9001', body: { mark: 'ok', note: '' } }), JSON.stringify(writes.at(-1)))
    check(`${dir} 3. the row reads OK by the reviewer`, strip(await r1.locator('[data-col="mark"]').innerText()) === 'OK by msartawi 2026-10-27 10:05', strip(await r1.locator('[data-col="mark"]').innerText()))
    const n = writes.length
    await page.locator('[data-review-row="D-9004"] [data-mark-action="questioned"]').click()
    await page.locator('[data-mark-dialog="questioned"]').waitFor({ timeout: 5000 })
    await page.locator('[data-mark-save]').click()
    check(`${dir} 3. Questioned with no note is refused, nothing posted`, strip(await page.locator('[data-mark-problem]').innerText()) === 'Say what is questioned.' && writes.length === n)
    await page.locator('[data-mark-note-input]').fill('Sent unchecked during the outage?')
    await page.locator('[data-mark-save]').click()
    await page.locator('[data-review-row="D-9004"] [data-col="mark"][data-mark="questioned"]').waitFor({ timeout: 8000 }).catch(() => {})
    check(`${dir} 3. Questioned posts its note`, JSON.stringify(writes.at(-1)?.body) === JSON.stringify({ mark: 'questioned', note: 'Sent unchecked during the outage?' }))
    check(`${dir} 3. the row shows the note in a <bdi>`, (await page.locator('[data-review-row="D-9004"] [data-mark-note]').innerText()) === 'Sent unchecked during the outage?')
    check(`${dir} 3. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 3. a refused mark
  {
    const { context, page } = await open(dir, { refuse: { mark: { status: 409, message: 'This row was marked by someone else.', errorCode: 'STALE' } } })
    await page.goto(`${BASE}/insurance-rules/review`)
    await page.locator('[data-review-row]').first().waitFor({ timeout: 30000 })
    await page.locator('[data-review-row="D-9001"] [data-mark-action="ok"]').click()
    await page.locator('[data-mark-save]').click()
    await toast(page).waitFor({ timeout: 8000 }).catch(() => {})
    check(`${dir} 3. a refusal toasts the server's message; the dialog stays`, strip(await toast(page).innerText()).includes('This row was marked by someone else.') && (await page.locator('[data-mark-dialog]').count()) === 1)
    await context.close()
  }

  // ── 4–5: exceptions ─────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, writes } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/exceptions`)
    // 618: HQ lists one patient's exceptions — the page asks for the key first.
    await page.locator('[data-exceptions-ask]').waitFor({ timeout: 30000 })
    check(`${dir} 4. no list until a patient key is typed`, (await page.locator('[data-exception-row]').count()) === 0)
    await page.locator('[data-field="exceptions-patient"]').fill('1023456777')
    await page.locator('[data-exception-row]').first().waitFor({ timeout: 30000 })
    check(`${dir} 4. the title`, strip(await page.locator('h1').first().innerText()) === 'Exceptions')
    const status = await rowIds(page, '[data-exception-row]', 'data-status')
    check(`${dir} 4. statuses: active, revoked, expired (valid until yesterday)`, JSON.stringify(status) === JSON.stringify(['active', 'revoked', 'expired']), JSON.stringify(status))
    const x1 = page.locator('[data-exception-row="X-101"]')
    check(`${dir} 4. id and patient key are ltr isolates`, (await x1.locator('[data-id] bdi[dir="ltr"]').innerText()) === 'X-101' && (await x1.locator('[data-patient] bdi[dir="ltr"]').innerText()) === '1023456777')
    check(`${dir} 4. one rule, item scope, valid until, reason, uses`, strip(await x1.locator('[data-col="rule"]').innerText()) === 'G-007' && strip(await x1.locator('[data-col="scope"]').innerText()) === 'This item 200871' && strip(await x1.locator('[data-col="validUntil"]').innerText()) === '2026-12-31' && strip(await x1.locator('[data-reason]').innerText()) === '07 · Medically necessary' && strip(await x1.locator('[data-col="uses"]').innerText()) === '')
    const x2 = page.locator('[data-exception-row="X-102"]')
    check(`${dir} 4. all guards; a list scope names its list`, strip(await x2.locator('[data-col="rule"]').innerText()) === 'All guards' && (await x2.locator('[data-scope-value] bdi[dir="ltr"]').innerText()) === 'glp1' && (await x2.locator('bdi[data-scope-name]').innerText()) === 'GLP-1 and biologics')
    check(`${dir} 4. same kind scope`, strip(await page.locator('[data-exception-row="X-099"] [data-col="scope"]').innerText()) === 'Same kind as 100234')
    check(`${dir} 4. only an active exception can be revoked`, (await x1.locator('[data-revoke]').count()) === 1 && (await x2.locator('[data-revoke]').count()) === 0 && (await page.locator('[data-exception-row="X-099"] [data-revoke]').count()) === 0)
    await x1.locator('[data-log-open]').click()
    await page.locator('[data-log-entry]').first().waitFor({ timeout: 8000 })
    const log = await page.locator('[data-log-entry]').evaluateAll((els) => els.map((e) => e.textContent.replace(/[\u2066-\u2069]/g, '')))
    check(
      `${dir} 4. the log: issue then two uses with store, rule and request`,
      JSON.stringify(log) === JSON.stringify(['2026-10-20 10:00Issuedins.huda', '2026-10-22 17:45UsedPH-3040-01P040G-007NPH-55120', '2026-10-25 12:11UsedPH-3040-01P040G-007NPH-55871']),
      JSON.stringify(log),
    )
    check(`${dir} 4. the log's title names the exception`, strip(await page.locator('dialog[open] h2').innerText()) === 'Log of exception X-101')
    await page.keyboard.press('Escape')
    await x1.locator('[data-revoke]').click()
    await page.locator('[data-revoke-dialog]').waitFor({ timeout: 5000 })
    check(`${dir} 4. Revoke waits for a note (HQ requires one)`, await page.locator('[data-revoke-confirm]').isDisabled())
    await page.locator('[data-revoke-note]').fill('Insurer withdrew the approval')
    await page.locator('[data-revoke-confirm]').click()
    await page.locator('[data-exception-row="X-101"][data-status="revoked"]').waitFor({ timeout: 8000 }).catch(() => {})
    check(`${dir} 4. Revoke posts its note and the row turns revoked`, JSON.stringify(writes.at(-1)) === JSON.stringify({ method: 'POST', path: 'InsuranceRules/Exceptions/X-101/Revoke', body: { note: 'Insurer withdrew the approval' } }) && (await x1.getAttribute('data-status')) === 'revoked')

    // 5. issue
    await page.locator('[data-issue-open]').click()
    await page.locator('[data-issue-dialog]').waitFor({ timeout: 5000 })
    check(`${dir} 5. the date input runs today → today + 90`, (await page.locator('[data-field="validUntil"]').getAttribute('min')) === '2026-10-27' && (await page.locator('[data-field="validUntil"]').getAttribute('max')) === '2027-01-25')
    check(`${dir} 5. the hint names the last day`, strip(await page.locator('[data-valid-until-hint]').innerText()) === 'At most 90 days: until 2027-01-25 at the latest.')
    check(`${dir} 5. a retired reason is not offered`, (await page.locator('[data-field="reason"] option[value="13"]').count()) === 0 && (await page.locator('[data-field="reason"] option[value="07"]').count()) === 1)
    const before = writes.length
    await page.locator('[data-issue-submit]').click()
    const problems = await rowIds(page, '[data-problem]', 'data-problem')
    check(`${dir} 5. empties are refused, nothing posted`, JSON.stringify(problems) === JSON.stringify(['patientKey', 'scopeValue', 'validUntil', 'reason']) && writes.length === before, JSON.stringify(problems))
    await page.locator('[data-field="patientKey"]').fill('2398765455')
    await page.locator('[data-scope-kind="list"]').check()
    await page.locator('[data-field="scopeValue"]').selectOption('glp1')
    await page.locator('[data-field="validUntil"]').fill('2027-01-26')
    await page.locator('[data-field="reason"]').selectOption('07')
    await page.locator('[data-issue-submit]').click()
    check(`${dir} 5. a day past today + 90 is refused`, strip(await page.locator('[data-problem="validUntil"]').innerText()) === 'At most 90 days from today.' && writes.length === before)
    await page.locator('[data-field="validUntil"]').fill('2027-01-25')
    await page.locator('[data-field="note"]').fill('مريض سكري مؤكد')
    await page.locator('[data-issue-submit]').click()
    await page.locator('[data-exception-row="X-103"]').waitFor({ timeout: 8000 }).catch(() => {})
    check(
      `${dir} 5. the exact body: all guards → null, a list scope, the last allowed day`,
      JSON.stringify(writes.at(-1)) ===
        JSON.stringify({ method: 'POST', path: 'InsuranceRules/Exceptions', body: { patientKey: '2398765455', ruleId: null, scope: { list: 'glp1' }, validUntil: '2027-01-25', reason: '07', note: 'مريض سكري مؤكد' } }),
      JSON.stringify(writes.at(-1)),
    )
    check(`${dir} 5. the list moves to the patient it was issued to`, (await page.locator('[data-field="exceptions-patient"]').inputValue()) === '2398765455')
    check(`${dir} 5. the new exception tops the list, active`, (await rowIds(page, '[data-exception-row]', 'data-exception-row'))[0] === 'X-103' && (await page.locator('[data-exception-row="X-103"]').getAttribute('data-status')) === 'active' && (await page.locator('[data-issue-dialog]').count()) === 0)
    await page.locator('[data-issue-open]').click()
    await page.locator('[data-field="patientKey"]').fill('1023456777')
    await page.locator('[data-field="ruleId"]').selectOption('G-002')
    await page.locator('[data-scope-kind="sameKind"]').check()
    await page.locator('[data-field="scopeValue"]').fill('100234')
    await page.locator('[data-field="validUntil"]').fill('2026-10-27')
    await page.locator('[data-field="reason"]').selectOption('03')
    await page.locator('[data-issue-submit]').click()
    await page.locator('[data-exception-row="X-104"]').waitFor({ timeout: 8000 }).catch(() => {})
    check(`${dir} 5. …and back to the first patient, X-104 on top`, (await rowIds(page, '[data-exception-row]', 'data-exception-row'))[0] === 'X-104')
    check(`${dir} 5. one rule and same kind; today itself is allowed`, JSON.stringify(writes.at(-1)?.body) === JSON.stringify({ patientKey: '1023456777', ruleId: 'G-002', scope: { sameKind: '100234' }, validUntil: '2026-10-27', reason: '03', note: '' }), JSON.stringify(writes.at(-1)?.body))
    check(`${dir} 7. no raw keys on exceptions`, await noRawKeys(page))
    check(`${dir} 7. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 6: a bare 403 ───────────────────────────────────────────────────────────────────────────
  {
    const { context, page } = await open(dir, { deny: ['review', 'exceptions'] })
    await page.goto(`${BASE}/insurance-rules/review`)
    await page.locator('[data-review-denied]').waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 6. a bare 403 on the review list → "You do not have access"`, strip(await page.locator('[data-review-denied]').innerText()).startsWith('You do not have access') && (await page.locator('[data-review-table], [data-review-empty]').count()) === 0)
    await page.goto(`${BASE}/insurance-rules/exceptions`)
    await page.locator('[data-field="exceptions-patient"]').fill('1023456777')
    await page.locator('[data-exceptions-denied]').waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 6. a bare 403 on the exceptions → "You do not have access"`, (await page.locator('[data-exceptions-denied]').count()) === 1 && (await page.locator('[data-exceptions-table], [data-exceptions-empty]').count()) === 0)
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
