// Ua Users "at scale" drive (spec 147, opened by ticket 148) — proves the people
// list stops being a 50-row wall and becomes the first of N pages. Later slices
// (149 mutations hold the page, 150/151 the CSV export) extend this file.
//
// React Testing Library is not installed in this repo (spec 083's standing
// ruling), so a screen slice is proved by driving the real app against a stubbed
// envelope — the idiom of tools/ua-channel-drive.mjs. The stub serves a
// ~6,000-identity estate and honours
// `skip`/`take` exactly as SIS.Api does (research 140), including `isCapped`
// meaning "more rows exist beyond THIS page".
//
// What it asserts, one per ticket 148's Proof:
//   1. the grid header states the TRUE match count, not the page's row count;
//   2. the footer reads "Page 1 of 120" on All people, and does NOT appear on a
//      result that fits one page;
//   3. Next moves to page 2 with different rows and the right `skip`; Previous
//      comes back;
//   4. Previous is dead on page 1, Next is dead on the last page (isCapped);
//   5. a new search snaps back to page 1;
//   6. no cap note survives anywhere on the screen;
//   7. a revisited page comes back with no dim and no second server read, and the
//      selected person survives the page change (the do-nothing implementation
//      spec 147 records — the pane fetches by employee id).
//
// Ticket 149 adds, against the same estate:
//   8. acting on someone from the pane HOLDS the worklist page — page 2 stays
//      page 2 — with the counts refreshed;
//   9. acting on the last row of the LAST page clamps to the new last page
//      instead of showing an empty grid, with the pane still open.
//
// Ticket 150 adds:
//  10. Export CSV on a narrowed card (Phone gap, 400 people = 8 pages) downloads
//      a file named for the scope and the day, holding EVERY match rather than
//      the 50 on screen, walked from skip 0 in 50s, with the Excel guards intact
//      and the grid undisturbed.
//
//
// Ticket 151 adds, on *All people* (6,000 = 120 pages):
//  11. Export raises a confirm naming the row count and the wait; dismissing it
//      does nothing at all — no read, no toast, no file;
//  12. confirming shows a cancellable progress toast, and cancelling stops the
//      walk, says so, and leaves NO file behind.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/ua-users-scale-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')
const SHOTS = 'tools/.ua-scale-shots'

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`

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

// ---- the estate -------------------------------------------------------------
// 6,000 identities = 120 pages of 50, the real cutover shape. Employee ids run
// 100000.. so page 2 row 1 is unmistakably not page 1 row 1.
const TOTAL = 6000
const row = (n) => ({
  employeeId: String(100000 + n),
  displayName: `Person ${100000 + n}`,
  phone: '0500000000',
  phoneClass: 'usable',
  email: '',
  deliveryChannel: 'sms',
  isActive: true,
  isSeeded: true,
  credentialState: 'active',
  isTotpEnrolled: false,
  lastLoginAt: '2026-07-01T09:00:00',
})
const ESTATE = Array.from({ length: TOTAL }, (_, i) => row(i))

// The *Awaiting activation* worklist is the one with LIVE membership: 152 people
// = 4 pages of 50/50/50/2, and the stub treats Clear TOTP as the fix that takes
// a person off it. That is the shape ticket 149 needs — a worklist an
// administrator works DOWN, whose last page can be emptied by succeeding at the
// last row.
const awaiting = new Set(ESTATE.slice(0, 152).map((r) => r.employeeId))

// Every list read the screen makes, in order — so the drive can assert on the
// `skip` that was actually asked for, not just on what rendered.
const reads = []
// Counts reads and mutations, so "the counts refreshed" is asserted on the wire
// rather than inferred from a number that happened not to move.
let countsReads = 0
const mutations = []
// Ticket 151: an in-memory stub answers 120 pages faster than anyone can reach
// the Cancel button, which would make "cancel mid-walk" untestable. Delaying the
// *All people* pages restores the only property that matters here — that the
// walk is long enough to interrupt.
let allPageDelayMs = 0
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** The server's paging contract: `take` clamps down to 50, `isCapped` says a row
 *  exists past this page. Deterministic order, as every path already guarantees. */
const slice = (pool, skip, take) => {
  const size = Math.min(Number(take) || 50, 50)
  const start = Math.max(0, Number(skip) || 0)
  return {
    rows: pool.slice(start, start + size),
    totalMatches: pool.length,
    rowCap: 50,
    isCapped: pool.length > start + size,
  }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && pageErrors.push(m.text()))

await page.route('**/api/**', async (route) => {
  const req = route.request()
  const url = new URL(req.url())
  const path = url.pathname.split('/api/')[1]
  const q = url.searchParams
  if (path === 'Auth/Me')
    return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
  if (path === 'UaAdminWeb/Access') return route.fulfill(envelope({ canOpen: true }))
  if (path === 'UaAdminWeb/ReportCounts') {
    countsReads += 1
    return route.fulfill(
      envelope({
        allPeople: TOTAL,
        notSeeded: 12,
        phoneGap: 400,
        awaitingActivation: awaiting.size,
        mustChangePassword: 3,
        disabled: 40,
      }),
    )
  }
  // The one mutation this drive fires. The stub takes the person off the
  // *Awaiting activation* worklist, which is what makes "the page holds" and
  // "the emptied last page clamps" observable.
  if (path === 'UaAdminWeb/Employees/ClearTotp' && req.method() === 'POST') {
    const employeeId = String(req.postDataJSON()?.employeeId ?? '')
    awaiting.delete(employeeId)
    mutations.push(employeeId)
    return route.fulfill(envelope({}))
  }
  const card = /^UaAdminWeb\/ReportCards\/([^/]+)$/.exec(path)
  if (card) {
    const which = decodeURIComponent(card[1])
    reads.push({ kind: 'card', card: which, skip: q.get('skip'), take: q.get('take') })
    // `mustChange` is the deliberately small worklist: 3 rows, one page, no footer.
    // `phoneGap` is the narrowed card ticket 150 exports: 400 people = 8 pages,
    // enough that "the whole match set" is visibly not "the visible page".
    const pool =
      which === 'mustChange'
        ? ESTATE.slice(0, 3)
        : which === 'phoneGap'
          ? ESTATE.slice(0, 400)
          : which === 'awaitingActivation'
            ? ESTATE.filter((r) => awaiting.has(r.employeeId))
            : ESTATE
    if (which === 'all' && allPageDelayMs) await sleep(allPageDelayMs)
    return route.fulfill(envelope(slice(pool, q.get('skip'), q.get('take'))))
  }
  if (path === 'UaAdminWeb/Employees' && req.method() === 'GET') {
    const term = q.get('term') || ''
    reads.push({ kind: 'search', term, skip: q.get('skip'), take: q.get('take') })
    // Two named search shapes the drive needs and a plain contains-match for the
    // rest: `twopages` is exactly 60 rows (a last page that is NOT capped),
    // `onepage` is 4 (a result that grows no controls).
    const pool =
      term.startsWith('twopages')
        ? ESTATE.slice(0, 60)
        : term === 'onepage'
          ? ESTATE.slice(0, 4)
          : ESTATE.filter((r) => r.displayName.includes(term))
    return route.fulfill(envelope(slice(pool, q.get('skip'), q.get('take'))))
  }
  const detail = /^UaAdminWeb\/Employees\/([^/]+)$/.exec(path)
  if (detail) {
    const found = ESTATE.find((r) => r.employeeId === decodeURIComponent(detail[1]))
    return route.fulfill(
      found
        ? envelope({
            found: true,
            ...found,
            createdAt: '2026-01-01T08:00:00',
            updatedAt: '2026-07-01T08:00:00',
            disabledAt: null,
            disabledBy: '',
            credentialCreatedAt: '2026-06-01T08:00:00',
          })
        : envelope({ found: false }),
    )
  }
  if (path.endsWith('/Sessions')) return route.fulfill(envelope([]))
  if (path.endsWith('/Audit'))
    return route.fulfill(envelope({ entries: [], totalEntries: 0, rowCap: 50, isCapped: false }))
  return route.fulfill(envelope({}))
})

await page.goto(BASE + '/admin/ua-users')
await page.waitForSelector('main', { timeout: 20000 })

const footer = page.locator('nav[aria-label="Result pages"]')
const prev = footer.getByRole('button', { name: 'Previous' })
const next = footer.getByRole('button', { name: 'Next' })
const readout = () => footer.locator('span').first().textContent()
const firstId = () => page.locator('tbody tr td').first().textContent()
const searchBox = page.locator('input[placeholder*="Search"]')
const searchBtn = page.getByRole('button', { name: 'Search', exact: true })
const runSearch = async (term) => {
  await searchBox.fill(term)
  await searchBtn.click()
  await page.waitForTimeout(700)
}

// ---- 6. no cap note anywhere ------------------------------------------------
const bodyBefore = await page.locator('main').innerText()
check(
  'the "refine to narrow" advice is gone before any query',
  !/refine to narrow/i.test(bodyBefore),
  bodyBefore.slice(0, 120),
)

// ---- open All people --------------------------------------------------------
await page.getByRole('button', { name: /^6,000/ }).click()
await page.waitForSelector('tbody tr', { timeout: 10000 })

// ---- 1. the header states the TRUE total ------------------------------------
const countText = await page.locator('main').getByText(/matches$/).first().textContent()
check('the grid header reads the true match count, not 50', countText.trim() === '6,000 matches', countText)

// ---- 2. the footer reads "Page 1 of 120" ------------------------------------
check('the footer appears on a multi-page worklist', await footer.isVisible())
check('the readout names the page and the page count', (await readout()).trim() === 'Page 1 of 120', await readout())

// ---- 4a. Previous is dead on page 1 -----------------------------------------
check('Previous is disabled on page 1', await prev.isDisabled())
check('Next is live when another page exists', await next.isEnabled())

mkdirSync(SHOTS, { recursive: true })
await page.screenshot({ path: `${SHOTS}/ua-users-page-1.png` })

// ---- 3. Next moves to page 2 with different rows ----------------------------
const page1First = (await firstId()).trim()
await next.click()
await page.waitForFunction(
  (was) => document.querySelector('tbody tr td')?.textContent.trim() !== was,
  page1First,
  { timeout: 10000 },
)
check('Next lands on page 2', (await readout()).trim() === 'Page 2 of 120', await readout())
check('page 2 shows different rows', (await firstId()).trim() === '100050', await firstId())
const pageTwoRead = reads.at(-1)
check('page 2 asked the server for skip=50, take=50', pageTwoRead?.skip === '50' && pageTwoRead?.take === '50', JSON.stringify(pageTwoRead))
check('Previous wakes up off page 1', await prev.isEnabled())

// ---- 7. selection survives the page change ---------------------------------
// Nothing implements this — the pane fetches by employee id and never reads the
// grid row. Asserted so nobody "fixes" it by clearing selection on page change.
await page.locator('tbody tr').first().click()
await page.waitForTimeout(400)
const selectedBefore = await page.locator('#ud-phone').count()
check('a person can be selected on page 2', selectedBefore === 1)

// ---- 3b/7. Previous comes back, instantly, with the selection intact --------
const readsBeforeBack = reads.length
await prev.click()
await page.waitForFunction(() => document.querySelector('tbody tr td')?.textContent.trim() === '100000', null, {
  timeout: 10000,
})
check('Previous returns to page 1', (await readout()).trim() === 'Page 1 of 120', await readout())
check('a revisited page costs no second server read', reads.length === readsBeforeBack, `${reads.length - readsBeforeBack} extra`)
check('the grid does not dim on a cached page', !(await page.locator('[aria-busy="true"]').count()))
check('the selected person survives the page change', (await page.locator('#ud-phone').count()) === 1)

// ---- 2b. a result that fits one page grows no footer ------------------------
await runSearch('onepage')
check('a four-row result grows no controls', (await footer.count()) === 0, String(await footer.count()))
check('the header still states the real total', (await page.locator('main').getByText(/matches$/).first().textContent()).trim() === '4 matches')

// ---- 4b. Next is dead on the last page (isCapped false) ---------------------
await runSearch('twopages')
check('a 60-row result spans two pages', (await readout()).trim() === 'Page 1 of 2', await readout())
await next.click()
await page.waitForTimeout(700)
check('the last page reads Page 2 of 2', (await readout()).trim() === 'Page 2 of 2', await readout())
check('Next is disabled on the last page', await next.isDisabled())
check('Previous is live on the last page', await prev.isEnabled())
check('the last page shows the tail, not a full page', (await page.locator('tbody tr').count()) === 10, String(await page.locator('tbody tr').count()))

// ---- 5. a new search snaps back to page 1 -----------------------------------
// Walk All people to page 3, then search: the page number is a field of the
// query, so a fresh query is page 1 by construction.
await page.getByRole('button', { name: /^6,000/ }).click()
await page.waitForSelector('tbody tr', { timeout: 10000 })
await next.click()
await page.waitForTimeout(500)
await next.click()
await page.waitForTimeout(500)
check('walked to page 3', (await readout()).trim() === 'Page 3 of 120', await readout())
// A term not yet searched, so the skip assertion reads a fresh server call
// rather than a cache hit.
await runSearch('twopagesB')
const afterSearch = reads.at(-1)
check(
  'a new search asks for skip=0 — page is a field of the query',
  afterSearch?.kind === 'search' && afterSearch?.skip === '0',
  JSON.stringify(afterSearch),
)
check('and the readout snaps back to Page 1', (await readout()).trim() === 'Page 1 of 2', await readout())

// ---- 5b. switching cards resets too ----------------------------------------
await page.getByRole('button', { name: /^6,000/ }).click()
await page.waitForSelector('tbody tr', { timeout: 10000 })
await next.click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /^400/ }).click()
await page.waitForTimeout(800)
const afterCard = reads.at(-1)
check(
  'switching cards asks for skip=0',
  afterCard?.kind === 'card' && afterCard?.card === 'phoneGap' && afterCard?.skip === '0',
  JSON.stringify(afterCard),
)

// ---- 6b. and no cap note on a paged screen either ---------------------------
const bodyAfter = await page.locator('main').innerText()
check('no cap note survives on a paged screen', !/refine to narrow|first \d+ of/i.test(bodyAfter))

await page.screenshot({ path: `${SHOTS}/ua-users-paged.png` })

// ---- 8. a fix HOLDS the worklist page (ticket 149) --------------------------
// Awaiting activation: 152 people, 4 pages. Walk to page 2, fix someone, and the
// grid must still be on page 2 — a worklist worked down must not restart.
const clearTotp = page.getByRole('button', { name: 'Clear TOTP' })
const confirmYes = page.getByRole('button', { name: 'Yes' })
const fixSelectedPerson = async () => {
  const before = mutations.length
  await clearTotp.click()
  await confirmYes.click()
  for (let i = 0; i < 40 && mutations.length === before; i++) await page.waitForTimeout(100)
  await page.waitForTimeout(900) // the invalidate-driven refetch of list + counts
}

await page.getByRole('button', { name: /^152/ }).click()
await page.waitForSelector('tbody tr', { timeout: 10000 })
check('the awaiting worklist spans four pages', (await readout()).trim() === 'Page 1 of 4', await readout())
await next.click()
await page.waitForTimeout(700)
check('walked to page 2 of the worklist', (await readout()).trim() === 'Page 2 of 4', await readout())

await page.locator('tbody tr').first().click()
await page.waitForSelector('#ud-phone', { timeout: 10000 })
const countsBeforeFix = countsReads
await fixSelectedPerson()

check('a fix holds the worklist page — page 2 stays page 2', (await readout()).trim().startsWith('Page 2 of'), await readout())
check('the fixed person left the worklist', awaiting.size === 151, String(awaiting.size))
check(
  'the header count refreshed with the worklist',
  (await page.locator('main').getByText(/matches$/).first().textContent()).trim() === '151 matches',
  await page.locator('main').getByText(/matches$/).first().textContent(),
)
check('the report counts were re-read after the fix', countsReads > countsBeforeFix, `${countsReads - countsBeforeFix}`)
check('the pane stayed open through the fix', (await page.locator('#ud-phone').count()) === 1)

// ---- 9. the emptied last page clamps to the new last page -------------------
// 151 left = pages of 50/50/50/1. Fix the single person on page 4 and that page
// is gone; the grid must land on page 3, not on an empty table.
await next.click()
await page.waitForTimeout(600)
await next.click()
await page.waitForTimeout(600)
check('walked to the last page', (await readout()).trim() === 'Page 4 of 4', await readout())
check('the last page holds one row', (await page.locator('tbody tr').count()) === 1, String(await page.locator('tbody tr').count()))

await page.locator('tbody tr').first().click()
await page.waitForSelector('#ud-phone', { timeout: 10000 })
await fixSelectedPerson()

check('an emptied last page clamps to the new last page', (await readout()).trim() === 'Page 3 of 3', await readout())
check(
  'and lands on rows, not on an empty grid',
  (await page.locator('tbody tr').count()) === 50,
  String(await page.locator('tbody tr').count()),
)
check('no "no people match" message after the clamp', !/No people match/i.test(await page.locator('main').innerText()))
check('the pane survives the clamp too', (await page.locator('#ud-phone').count()) === 1)
await page.screenshot({ path: `${SHOTS}/ua-users-clamped.png` })

// ---- 10. exporting a narrowed card downloads the whole match set (ticket 150)
// Phone gap: 400 people = 8 pages. Sitting on page 1, one click must produce all
// 400 — the export is over the QUERY, not over what happens to be on screen.
const exportBtn = page.getByRole('button', { name: 'Export CSV' })
await page.getByRole('button', { name: /^400/ }).click()
await page.waitForSelector('tbody tr', { timeout: 10000 })
const readsBeforeExport = reads.length
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  exportBtn.click(),
])

const fileName = download.suggestedFilename()
check(
  'the file is named for the scope CODE and the day',
  /^ua-users-phonegap-\d{4}-\d{2}-\d{2}\.csv$/.test(fileName),
  fileName,
)

const csv = readFileSync(await download.path(), 'utf8')
const lines = csv.split('\r\n').filter((l) => l !== '')
// sep= + header + 400 people. Not 52 — that would be the visible page.
check('the file holds every match, not the visible page', lines.length === 402, `${lines.length} lines`)

const walk = reads.slice(readsBeforeExport)
check(
  'the walk started at skip 0 and stepped in 50s to the end',
  walk.length === 8 && walk.every((r, i) => r.skip === String(i * 50) && r.take === '50'),
  walk.map((r) => r.skip).join(','),
)

check('the file opens in columns in any locale (BOM + sep=)', csv.startsWith('﻿sep=,'), lines[0])
check(
  'the header names all 13 columns',
  lines[1] === 'Employee,Name,Mobile,Mobile status,Email,Codes via,Reachable,Status,Seeded,Enabled,Credential,TOTP,Last login',
  lines[1],
)
check(
  'employee id and mobile survive Excel as formula text',
  lines[2].startsWith('"=""100000""",Person 100000,"=""0500000000"""'),
  lines[2],
)
check('the row carries labels, not wire codes', /,Usable,,SMS,Yes,Active,Yes,Yes,Active,No,2026-07-01 09:00$/.test(lines[2]), lines[2])
check('exporting did not disturb the grid', (await readout()).trim() === 'Page 1 of 8', await readout())
check('the export button came back live', await exportBtn.isEnabled())

// ---- 11/12. exporting everybody warns first, and cancels with no file --------
// Every download that fires from here on, so "no file at all" is asserted on the
// browser rather than inferred from the absence of a timeout.
const lateDownloads = []
page.on('download', (d) => lateDownloads.push(d.suggestedFilename()))

await page.getByRole('button', { name: /^6,000/ }).click()
await page.waitForSelector('tbody tr', { timeout: 10000 })

// 11a. the confirm names the count and the wait
const readsBeforeDismissed = reads.length
await exportBtn.click()
const dialog = page.locator('dialog[open]')
const progress = page.locator('[data-sonner-toast]').filter({ hasText: 'Building the file' })
await dialog.waitFor({ timeout: 5000 })
const dialogText = (await dialog.innerText()).replace(/\s+/g, ' ')
check('exporting everybody asks first', await dialog.isVisible())
check('the confirm names the row count', /6,000 people/.test(dialogText), dialogText.slice(0, 160))
check('and the rough wait', /about \d+ seconds/.test(dialogText), dialogText.slice(0, 200))

// 11b. dismissing does nothing at all — not a shorter export, nothing
await dialog.getByRole('button', { name: 'No', exact: true }).click()
await page.waitForTimeout(600)
check('dismissing the confirm reads nothing', reads.length === readsBeforeDismissed, `${reads.length - readsBeforeDismissed} reads`)
check('dismissing the confirm downloads nothing', lateDownloads.length === 0, lateDownloads.join(','))
check('dismissing the confirm starts no walk to show progress for', (await progress.count()) === 0)
check('and the export button is live again', await exportBtn.isEnabled())

// 12. confirming shows cancellable progress; cancelling leaves no file
allPageDelayMs = 90 // 120 pages ≈ 11s — long enough to reach the Cancel button
await exportBtn.click()
await dialog.waitFor({ timeout: 5000 })
await confirmYes.click()

await progress.waitFor({ timeout: 10000 })
check('a long export shows progress, not a blocking modal', await progress.isVisible())
check('the screen stays usable behind it', (await page.locator('dialog[open]').count()) === 0)
// A count that has actually MOVED — the toast is reporting the walk, not a
// placeholder painted once when it started.
await page.waitForFunction(
  () => /[1-9][\d,]* of 6,000 people collected/.test(document.body.innerText),
  null,
  { timeout: 15000 },
)
const progressText = (await progress.innerText()).replace(/\s+/g, ' ')
check('the progress counts people against the total', /of 6,000 people collected/.test(progressText), progressText)
await page.screenshot({ path: `${SHOTS}/ua-users-export-progress.png` })

await progress.getByRole('button', { name: 'Cancel' }).click()
// Let the in-flight page land, THEN take the reading: the property is that the
// walk stops, not that it stops inside Playwright's click latency.
await page.waitForTimeout(1200)
const readsAtCancel = reads.length
await page.waitForTimeout(1500)
check('cancelling stops the walk', reads.length === readsAtCancel, `${reads.length - readsAtCancel} pages after it settled`)
check('the walk had not finished — this was a real mid-walk cancel', readsAtCancel - readsBeforeDismissed < 120, `${readsAtCancel - readsBeforeDismissed} of 120 pages`)
check('cancelling produces no file at all', lateDownloads.length === 0, lateDownloads.join(','))
check(
  'and says so',
  /Export stopped/.test(await page.locator('body').innerText()),
  (await page.locator('[data-sonner-toast]').first().innerText().catch(() => '')).replace(/\s+/g, ' '),
)
check('the progress toast is gone', (await progress.count()) === 0)
check('the export button came back live after a cancel', await exportBtn.isEnabled())
check('cancelling left the grid where it was', (await readout()).trim() === 'Page 1 of 120', await readout())
allPageDelayMs = 0

// ---- 13. and letting it finish writes everybody, exactly once ---------------
// The "Export stopped" toast is top-right, over the toolbar — dismiss it rather
// than clicking through it.
await page.locator('[data-sonner-toast] [data-close-button]').first().click()
await page.waitForTimeout(400)
const [bigDownload] = await Promise.all([
  page.waitForEvent('download', { timeout: 120000 }),
  (async () => {
    await exportBtn.click()
    await dialog.waitFor({ timeout: 5000 })
    await confirmYes.click()
  })(),
])
const bigLines = readFileSync(await bigDownload.path(), 'utf8')
  .split('\r\n')
  .filter((l) => l !== '')
// sep= + header + 6,000 people.
check('confirming walks the whole estate into one file', bigLines.length === 6002, `${bigLines.length} lines`)
const exportedIds = bigLines.slice(2).map((l) => l.split(',')[0])
check('every identity lands exactly once', new Set(exportedIds).size === 6000, `${new Set(exportedIds).size} distinct`)
check('the finished export left the grid where it was', (await readout()).trim() === 'Page 1 of 120', await readout())

check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))

await browser.close()
const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
