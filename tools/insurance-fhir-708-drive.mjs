// A labels-only re-pin, and the labels and package items of the Review list (BackOffice spec 3271, doors 3295, 3296, 3297;
// oms ticket 708). Drives the REAL app in Chromium against STUBS on the real envelope (`tools/fhir-rules-stubs-708.mjs`);
// never a live SIS.Api. `core/i18n.ts` pins `lng` to `en`, so RTL flips direction with English words.
//
// In LTR and RTL, one HQ store per pass shared by two users:
//   1. the review list shows the three kinds, each filterable; a labels-changed item carries its badge;
//   2. a labels-changed item opens its draft: text before and after, both languages, no back-test; the author cannot approve;
//   3. the ruleset on the list wears the badge, still pinned; another user approves; it leaves the list;
//   4. a ruleset with no draft yet: the item goes to the list, a draft is raised, and no back-test is waited for;
//   5. an upload-due item goes to the upload;
//   6. a package item opens its diff; an empty package says so; it clears with a note;
//   7. no raw keys; no page errors.
//
//   1. npx vite --port 5218 --strictPort
//   2. DRIVE_PORT=5218 node tools/insurance-fhir-708-drive.mjs
import { createRequire } from 'node:module'
import { envelope } from './insurance-rules-stubs.mjs'
import { createReviewItemStubs } from './fhir-rules-stubs-702.mjs'
import { REVIEW_ITEMS_708, SYSTEM_RULE, labelRepinStub, newLabelRepinStore } from './fhir-rules-stubs-708.mjs'
import { labelsStub, newLabelsState } from './fhir-rules-stubs-706.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5218}`
const AUTHOR = 'nalharbi'
const APPROVER = 'falotaibi'
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}
const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const browser = await chromium.launch()

async function open(dir, repins, user, path, { writes = [] } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  const review = createReviewItemStubs(REVIEW_ITEMS_708, { writes, items: [] })
  const labels = newLabelsState()
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: user, currentStoreCode: 'P001' }))
    const body = req.method() === 'GET' || !req.postData() ? null : JSON.parse(req.postData())
    const hit = labelRepinStub(req.method(), p, body, { store: repins, user }) ?? labelsStub(req.method(), p, { state: labels }) ?? (p.startsWith('InsuranceRules/Review') ? review(req.method(), p, body, url.searchParams) : null)
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}${path}`)
  return { context, page, errors, writes }
}
const noRawKeys = async (page) => !/insurance-(review|aliases):|\b(item|kind|repin)\.[a-zA-Z]/.test(await page.locator('body').innerText())

for (const dir of ['ltr', 'rtl']) {
  const tag = (s) => `[${dir}] ${s}`
  const repins = newLabelRepinStore()

  // 1 — the list
  const r = await open(dir, repins, AUTHOR, '/insurance-rules/review')
  await r.page.locator('[data-review-row="L-1"]').waitFor({ timeout: 60000 })
  check(tag('the document direction'), (await r.page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
  const l1 = r.page.locator('[data-review-row="L-1"]')
  check(tag('labels-changed: the kind in words and the badge'), strip(await l1.locator('[data-col="kind"]').innerText()) === 'Labels changed' && (await l1.locator('[data-item-labels-badge]').count()) === 1)
  check(tag('labels-changed: the ruleset, free text in a <bdi>, its version an ltr isolate'), (await l1.locator('bdi[data-item-ruleset]').innerText()) === 'Guards' && (await l1.locator('[data-item-ruleset] + span bdi[dir="ltr"]').innerText()) === '7')
  check(tag('labels-changed: the link names the draft'), (await l1.locator('[data-item-draft-link]').getAttribute('href')) === '/insurance-rules/aliases?repin=D-L1')
  check(tag('no draft yet: the link goes to the list'), (await r.page.locator('[data-review-row="L-2"] [data-item-draft-link]').getAttribute('href')) === '/insurance-rules/aliases')
  check(tag('upload due: why, for a new package'), strip(await r.page.locator('[data-review-row="D-1"] [data-item-due="newPackage"]').innerText()).startsWith('A new Nphies package') && (await r.page.locator('[data-review-row="D-1"] [data-item-due-version] bdi[dir="ltr"]').innerText()) === '5.1.0')
  check(tag('upload due: an unlisted code is one ltr isolate'), (await r.page.locator('[data-review-row="D-2"] [data-item-due-code] bdi[dir="ltr"]').innerText()) === 'benefit-category · 99')
  const p1 = r.page.locator('[data-review-row="P-1"]')
  check(tag('package: the range is one ltr isolate'), (await p1.locator('[data-item-package-version] bdi[dir="ltr"]').innerText()) === '5.0.0–5.1.0')
  check(tag('package: the row counts only the groups that moved'), (await p1.locator('[data-item-package-count]').count()) === 2 && strip(await p1.locator('[data-item-package-count="profiles"]').innerText()) === 'Profiles 2' && strip(await p1.locator('[data-item-package-count="extensions"]').innerText()) === 'Extensions 1')
  check(tag('every row spans the same columns'), await r.page.locator('[data-review-table] tbody tr').evaluateAll((trs) => trs.every((tr) => [...tr.children].reduce((n, td) => n + td.colSpan, 0) === 12)))
  for (const [kind, n] of [['labelsChanged', 2], ['uploadDue', 2], ['package', 2]]) {
    await r.page.locator(`[data-kind-filter="${kind}"]`).click()
    await r.page.waitForFunction(([k, c]) => [...document.querySelectorAll('[data-review-row]')].length === c && [...document.querySelectorAll('[data-review-row]')].every((e) => e.getAttribute('data-kind') === k), [kind, n], { timeout: 8000 }).catch(() => {})
    check(tag(`the filter shows ${kind} items only`), (await r.page.locator(`[data-review-row][data-kind="${kind}"]`).count()) === n && (await r.page.locator('[data-review-row]').count()) === n)
  }
  check(tag('no raw keys on the list'), await noRawKeys(r.page))

  // 6 — the package item (the filter is still on package)
  await p1.locator('[data-item-open]').click()
  const dialog = r.page.locator('[data-item-dialog="P-1"]')
  await dialog.waitFor({ timeout: 5000 })
  check(tag('package: the diff shows the groups that moved'), (await dialog.locator('[data-package-group]').count()) === 2)
  const profiles = dialog.locator('[data-package-group="profiles"]')
  check(tag('package: added and removed are said, each name an ltr isolate'), strip(await profiles.locator('[data-package-line="added"]').innerText()).startsWith('Added') && (await profiles.locator('[data-package-line="added"] [data-package-name] bdi[dir="ltr"]').innerText()) === 'http://nphies.sa/StructureDefinition/claim-new' && strip(await profiles.locator('[data-package-line="removed"]').innerText()).startsWith('Removed'))
  const renamed = dialog.locator('[data-package-group="extensions"] [data-package-line="renamed"]')
  check(tag('package: a rename shows from and to, each its own isolate'), (await renamed.locator('[data-package-name] bdi[dir="ltr"]').innerText()) === 'http://nphies.sa/extension/copay' && (await renamed.locator('[data-package-renamed-to] bdi[dir="ltr"]').innerText()) === 'http://nphies.sa/extension/coPay')
  await r.page.locator('[data-clear-note-input]').fill('Read the release notes')
  await r.page.locator('[data-item-clear]').click()
  await r.page.locator('[data-review-row="P-1"] [data-col="mark"][data-cleared="true"]').waitFor({ timeout: 8000 }).catch(() => {})
  check(tag('package: it clears with a note'), r.writes.at(-1)?.path === 'InsuranceRules/Review/P-1/Clear' && (await p1.locator('bdi[data-clear-note]').innerText()) === 'Read the release notes')
  await r.page.locator('[data-review-row="P-2"] [data-item-open]').click()
  await r.page.locator('[data-package-diff-empty]').waitFor({ timeout: 5000 })
  check(tag('package: an empty diff says so'), (await r.page.locator('[data-package-diff-empty]').innerText()).includes('no profile') && (await r.page.locator('[data-package-group]').count()) === 0)
  await r.page.keyboard.press('Escape')

  // 5 — upload due → the upload
  await r.page.locator('[data-kind-filter="uploadDue"]').click()
  await r.page.locator('[data-review-row="D-1"] [data-item-upload-link]').click()
  await r.page.locator('[data-upload-file]').waitFor({ timeout: 30000 })
  check(tag('upload due: the link reaches the upload'), new URL(r.page.url()).pathname === '/insurance-rules/code-labels')
  check(tag('no page errors on the list'), r.errors.length === 0, r.errors.join(' | '))

  // 2 — labels-changed → the draft, as its author
  await r.page.goBack()
  await r.page.locator('[data-kind-filter="labelsChanged"]').click()
  await r.page.locator('[data-review-row="L-1"] [data-item-draft-link]').click()
  const draft = r.page.locator('[data-repin-draft="D-L1"]')
  await draft.waitFor({ timeout: 30000 })
  check(tag('the item opens its draft'), new URL(r.page.url()).searchParams.get('repin') === 'D-L1')
  check(tag('the label versions, before and after'), strip(await draft.locator('[data-repin-before]').innerText()) === '14' && strip(await draft.locator('[data-repin-after]').innerText()) === '15')
  const en = draft.locator(`[data-repin-text="${SYSTEM_RULE}/en"]`)
  check(tag('the English text before and after, each its own <bdi>'), (await en.locator('[data-repin-text-before] bdi').innerText()).startsWith('Dental (12)') && (await en.locator('[data-repin-text-after] bdi').innerText()).startsWith('Dental care (12)'))
  check(tag('the Arabic text is shown too, whatever the reader reads'), (await draft.locator(`[data-repin-text="${SYSTEM_RULE}/ar"] [data-repin-text-after] bdi`).innerText()).startsWith('عناية الأسنان'))
  check(tag('text that had none says so'), strip(await draft.locator('[data-repin-text="G-005/ar"] [data-repin-text-before]').innerText()) === 'No text')
  check(tag('a rule whose text did not move has no line'), (await draft.locator('[data-repin-text^="G-009"]').count()) === 0 && (await draft.locator('[data-repin-text]').count()) === 3)
  check(tag('no back-test, and none waited for'), (await draft.locator('[data-repin-backtest]').count()) === 0 && !strip(await r.page.getByRole('dialog').innerText()).includes('back-test'))
  check(tag('it says it runs as pinned until approved'), (await draft.locator('[data-repin-pinned]').innerText()).includes('runs as pinned'))
  check(tag('the author is not offered Approve, and is told why'), (await r.page.locator('[data-repin-approve]').count()) === 0 && (await r.page.locator('[data-repin-why]').innerText()).includes('someone else'))
  await r.page.locator('[data-repin-close]').click()
  await draft.waitFor({ state: 'detached', timeout: 5000 })
  check(tag('closing takes the draft out of the address'), !new URL(r.page.url()).searchParams.has('repin'))

  // 3 — the badge; another user approves
  const guards = r.page.locator('[data-repin-row="guards"]')
  check(tag('the published ruleset wears the badge, kind labels, and stays until approved'), (await guards.getAttribute('data-repin-kind')) === 'labels' && (await guards.locator('[data-repin-labels-badge]').count()) === 1 && repins.done.length === 0)
  check(tag('no page errors for the author'), r.errors.length === 0, r.errors.join(' | '))
  await r.context.close()

  const a = await open(dir, repins, APPROVER, '/insurance-rules/aliases?repin=D-L1')
  await a.page.locator('[data-repin-approve]').waitFor({ timeout: 60000 })
  check(tag('another user is offered Approve with no back-test'), (await a.page.locator('[data-repin-draft] [data-repin-backtest]').count()) === 0)
  await a.page.locator('[data-repin-approve]').click()
  await a.page.locator('[data-repin-row="guards"]').waitFor({ state: 'detached', timeout: 15000 })
  check(tag('approving writes as the second user'), repins.writes.at(-1)?.user === APPROVER && repins.writes.at(-1)?.path === 'InsuranceRules/RepinDrafts/D-L1/Approve')
  check(tag('the approved ruleset leaves the list; the other stays'), (await a.page.locator('[data-repin-row="monitors"]').count()) === 1)
  check(tag('the dialog closed and the address has no draft'), (await a.page.locator('[data-repin-draft]').count()) === 0 && !new URL(a.page.url()).searchParams.has('repin'))

  // 4 — no draft yet
  await a.page.locator('[data-repin-raise="monitors"]').click()
  const raised = a.page.locator('[data-repin-draft]')
  await raised.waitFor({ timeout: 15000 })
  check(tag('raising a labels draft POSTs the ruleset and the change'), JSON.stringify(repins.writes.at(-1)?.body) === JSON.stringify({ rulesetId: 'monitors', changeId: 'CH-LABELS-M' }))
  check(tag('a raised labels draft is not told to wait for a back-test'), (await a.page.locator('[data-repin-why]').innerText()).includes('someone else'))
  check(tag('no raw keys in the draft'), await noRawKeys(a.page))
  check(tag('no page errors for the approver'), a.errors.length === 0, a.errors.join(' | '))
  await a.context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
