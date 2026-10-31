// Review list: monitor and not-evaluated items (BackOffice spec 3271, door 3290; oms ticket 702).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/fhir-rules-stubs-702.mjs`): never a live
// SIS.Api. RTL here is direction only: `lng` stays `en` in the app, so English copy and text show in both, and the
// choice of EN or AR is `saysIn`'s, tested pure. In LTR and RTL it verifies: the new kinds sit in the list beside the
// decisions; a monitor item shows its rule, severity, text (a <bdi>) and (source, id) (an ltr isolate); a not-evaluated item reads as
// a failure, not a fire; an unknown kind renders; the kind filter reaches the door and the URL; opening an item and
// clearing it refuses an empty note, then posts it and the row reads cleared; a refused clear toasts and stays open;
// a decision row keeps its mark actions and none of the item's.
//
//   1. npx vite --port 5212 --strictPort
//   2. DRIVE_PORT=5212 node tools/insurance-fhir-702-drive.mjs
import { createRequire } from 'node:module'
import { envelope, insuranceRulesStub } from './insurance-rules-stubs.mjs'
import { createReviewItemStubs, REVIEW_ITEMS_702 } from './fhir-rules-stubs-702.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5212}`
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}
const browser = await chromium.launch()

async function open(dir, { refuse = {} } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  await page.clock.setFixedTime(new Date('2026-10-27T10:00:00+03:00'))
  const errors = []
  const writes = []
  const queries = []
  const review = createReviewItemStubs(REVIEW_ITEMS_702, { writes, refuse })
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
  return { context, page, errors, writes, queries }
}

const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const ids = (page) => page.locator('[data-review-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-review-row')))
const waitRows = (page, n) => page.waitForFunction((k) => document.querySelectorAll('[data-review-row]').length === k, n, { timeout: 8000 }).catch(() => {})
const noRawKeys = async (page) => !/insurance-review:|\b(item|kind|mark|filter|columns|review)\.[a-z]/.test(await page.locator('main').innerText())

for (const dir of ['ltr', 'rtl']) {
  // ── the list ──────────────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, writes, queries } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/review`)
    await page.locator('[data-review-row]').first().waitFor({ timeout: 30000 })
    check(`${dir} dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    const all = await ids(page)
    check(`${dir} one list: items and decisions together, newest first`, all.length === 10 && all[0] === 'M-1' && all.includes('D-9001') && all.indexOf('M-1') < all.indexOf('N-1'), JSON.stringify(all))

    const m1 = page.locator('[data-review-row="M-1"]')
    check(`${dir} monitor: the kind in words`, strip(await m1.locator('[data-col="kind"]').innerText()) === 'Monitor')
    check(`${dir} monitor: its rule is an ltr isolate`, (await m1.locator('[data-rule-id] bdi[dir="ltr"]').innerText()) === 'MON-04')
    check(`${dir} monitor: action severity`, strip(await m1.locator('[data-item-severity="action"]').innerText()) === 'Action')
    check(`${dir} monitor: info severity`, (await page.locator('[data-review-row="M-2"] [data-item-severity="info"]').count()) === 1)
    check(`${dir} monitor: the text in a <bdi>`, (await m1.locator('bdi[data-item-text]').innerText()) === 'Pre-auth denied after an approval')
    check(`${dir} monitor: English stands in when there is no Arabic`, (await page.locator('[data-review-row="M-2"] bdi[data-item-text]').innerText()) === 'Approved quantity was reduced')
    check(`${dir} monitor: (source, id) is one ltr isolate`, (await m1.locator('[data-item-message] bdi[dir="ltr"]').innerText()) === 'nphies · CR-778')
    check(`${dir} monitor: reads as a fire`, (await m1.locator('[data-item-detail]').getAttribute('data-reads')) === 'fire')

    const n1 = page.locator('[data-review-row="N-1"]')
    check(`${dir} not evaluated: reads as a failure, with no severity`, (await n1.locator('[data-item-detail]').getAttribute('data-reads')) === 'failure' && (await n1.locator('[data-item-severity]').count()) === 0)
    check(`${dir} not evaluated: says the watcher failed`, strip(await n1.locator('[data-item-failure="watcher"]').innerText()) === 'The answers watcher failed, so this answer was left unread.')
    check(`${dir} not evaluated: names the unread answer`, (await n1.locator('[data-item-message] bdi[dir="ltr"]').innerText()) === 'nphies · CR-901')
    const n2 = page.locator('[data-review-row="N-2"]')
    check(`${dir} not evaluated: a monitor failure names its rule`, (await n2.locator('[data-item-failure="monitor"]').count()) === 1 && (await n2.locator('[data-rule-id]').count()) === 1)

    const u1 = page.locator('[data-review-row="U-1"]')
    check(`${dir} an unknown kind renders, with its code and no raw key`, (await u1.locator('[data-unknown-kind="somethingNew"] bdi[dir="ltr"]').innerText()) === 'somethingNew' && (await u1.locator('bdi[data-item-text]').innerText()) === 'A kind from a newer server' && (await u1.locator('[data-item-open]').count()) === 1)
    check(`${dir} an unknown kind is not a filter`, (await page.locator('[data-kind-filter="somethingNew"]').count()) === 0)

    const d1 = page.locator('[data-review-row="D-9001"]')
    check(`${dir} a decision keeps its marks and has no Open`, (await d1.locator('[data-mark-action]').count()) === 2 && (await d1.locator('[data-item-open]').count()) === 0)
    check(`${dir} an item has no marks`, (await m1.locator('[data-mark-action]').count()) === 0)
    check(`${dir} every row spans the same columns`, await page.locator('[data-review-table] tbody tr').evaluateAll((trs) => trs.every((tr) => [...tr.children].reduce((n, td) => n + td.colSpan, 0) === 12)))
    check(`${dir} no raw keys`, await noRawKeys(page))

    // filter, open, clear
    await page.locator('[data-kind-filter="monitor"]').click()
    await waitRows(page, 2)
    check(`${dir} filter: monitor items only, in the door's query and the URL`, JSON.stringify(await ids(page)) === JSON.stringify(['M-1', 'M-2']) && queries.at(-1) === 'kind=monitor' && new URL(page.url()).searchParams.get('kind') === 'monitor', JSON.stringify(queries.at(-1)))
    await m1.locator('[data-item-open]').click()
    await page.locator('[data-item-dialog="M-1"]').waitFor({ timeout: 5000 })
    check(`${dir} open: the dialog says what the row says`, (await page.locator('[data-item-dialog="M-1"] [data-item-message] bdi[dir="ltr"]').innerText()) === 'nphies · CR-778' && (await page.locator('[data-item-dialog="M-1"] bdi[data-item-text]').count()) === 1)
    const n = writes.length
    await page.locator('[data-item-clear]').click()
    check(`${dir} clear: an empty note is refused, nothing posted`, (await page.locator('[data-clear-problem]').count()) === 1 && writes.length === n)
    await page.locator('[data-clear-note-input]').fill('اتصلنا بالجهة الدافعة')
    await page.locator('[data-item-clear]').click()
    await page.locator('[data-review-row="M-1"] [data-col="mark"][data-cleared="true"]').waitFor({ timeout: 8000 }).catch(() => {})
    check(`${dir} clear: posts the note to the item's door`, JSON.stringify(writes.at(-1)) === JSON.stringify({ method: 'POST', path: 'InsuranceRules/Review/M-1/Clear', body: { note: 'اتصلنا بالجهة الدافعة' } }), JSON.stringify(writes.at(-1)))
    check(`${dir} clear: the row reads cleared, the note in a <bdi>, and who`, (await m1.locator('bdi[data-clear-note]').innerText()) === 'اتصلنا بالجهة الدافعة' && strip(await m1.locator('[data-cleared-by]').innerText()).includes('msartawi'))
    check(`${dir} clear: the dialog closed`, (await page.locator('[data-item-dialog]').count()) === 0)
    await m1.locator('[data-item-open]').click()
    await page.locator('[data-item-dialog="M-1"]').waitFor({ timeout: 5000 })
    check(`${dir} a cleared item opens to read, and clears no further`, (await page.locator('[data-item-clear]').count()) === 0 && (await page.locator('[data-item-dialog-cleared]').count()) === 1)
    await page.keyboard.press('Escape')

    await page.locator('[data-kind-filter="notEvaluated"]').click()
    await page.locator('[data-review-row="N-1"]').waitFor({ timeout: 8000 }).catch(() => {})
    await page.locator('[data-review-row="M-1"]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {})
    check(`${dir} filter: not-evaluated items only`, JSON.stringify(await ids(page)) === JSON.stringify(['N-1', 'N-2']) && queries.at(-1) === 'kind=notEvaluated', queries.at(-1))
    await n1.locator('[data-item-open]').click()
    await page.locator('[data-item-dialog="N-1"]').waitFor({ timeout: 5000 })
    await page.locator('[data-clear-note-input]').fill('Answer re-read by hand')
    await page.locator('[data-item-clear]').click()
    await page.locator('[data-review-row="N-1"] [data-col="mark"][data-cleared="true"]').waitFor({ timeout: 8000 }).catch(() => {})
    check(`${dir} a not-evaluated item clears with a note too`, JSON.stringify(writes.at(-1)?.body) === JSON.stringify({ note: 'Answer re-read by hand' }) && (await n1.locator('bdi[data-clear-note]').innerText()) === 'Answer re-read by hand')
    check(`${dir} no raw keys after clearing`, await noRawKeys(page))
    check(`${dir} no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // ── a refused clear ───────────────────────────────────────────────────────────────────────────
  {
    const { context, page } = await open(dir, { refuse: { clear: { status: 409, message: 'Someone else cleared this item.', errorCode: 'STALE' } } })
    await page.goto(`${BASE}/insurance-rules/review?kind=monitor`)
    await page.locator('[data-review-row="M-1"]').waitFor({ timeout: 30000 })
    await page.locator('[data-review-row="M-1"] [data-item-open]').click()
    await page.locator('[data-clear-note-input]').fill('done')
    await page.locator('[data-item-clear]').click()
    const toast = page.locator('[data-sonner-toast]').last()
    await toast.waitFor({ timeout: 8000 }).catch(() => {})
    check(`${dir} a refused clear toasts the server's message; the dialog stays`, strip(await toast.innerText()).includes('Someone else cleared this item.') && (await page.locator('[data-item-dialog]').count()) === 1)
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
