// Campaigns drive (spec 2737; ticket 501 creates it — the workspace slices 502–512, 515 and 516
// EXTEND it with a section of their own, below 501's, and leave 501's checks unchanged).
//
// Drives the REAL app in Chromium against STUBS of the rule-campaign doors. No HQ contract exists
// yet (BackOffice 2758/2759 are unwritten), so the stubs serve the PROVISIONAL shapes of
// `src/core/models/rule-campaign.ts`, on the REAL envelope { statusCode, success, message,
// errors: [{ errorCode, internalErrorCode, errorMessage }], data }; ticket 520 re-points them:
//   GET RuleCampaign/Campaigns        → list rows (tools/campaigns-fixtures.mjs `listRow`)
//   GET RuleCampaign/Campaigns/{id}   → the whole campaign; an unknown id is a 404 refusal
// Never a live SIS.Api. The browser runs in Asia/Riyadh (UTC+3) with its clock fixed, so the local
// day and the UTC day can be made to disagree.
//
// ── 501 ── it asserts:
//   1. the Campaigns group is in the rail with its Campaigns leaf, ungated, and opens /campaigns;
//   2. a tile per state with its count at the local now (all 16 · draft 1 · waiting 1 · scheduled 1
//      · running 11 · expired 1 · disabled 1), every row in the grid, both names shown;
//   3. a tile filters the grid and is pressed, lands in the URL, and All clears it;
//   4. the search matches the English name, the Arabic name and the code, and says "n of m";
//   5. a row opens /campaigns/:id on its Dashboard — Details (both names, code, features), State,
//      Schedule ("Ends in N days", the weekdays) — with ONE read of the campaign; the side menu shows
//      only Dashboard (no other page has landed); Back returns to the list as it was left;
//   6. the name link opens a scheduled campaign: "Starts in 3 days", its daily hours one range;
//      a waiting campaign names who asked and the note; a draft with no schedule says "No time limit";
//   7. at 02:30 local (23:30 UTC the day before) the counts and "Starts in 3 days" are unchanged;
//   8. an unknown campaign shows the door's own refusal and the way back;
//   9. no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/campaigns-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { CAMPAIGNS, listRow } from './campaigns-fixtures.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.campaigns-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope (copied from tools/deliverect-stores-drive.mjs).
const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, errorMessage: message, internalErrorCode: '' }] : [],
    data,
  }),
})

const NOT_FOUND = 'No such campaign. / لا توجد حملة بهذا الرمز.'

/** 2026-10-16 18:30 in Riyadh — the prototype's simulator moment. */
const EVENING = new Date('2026-10-16T18:30:00+03:00')
/** 2026-10-16 02:30 in Riyadh = 2026-10-15 23:30 UTC: the local day and the UTC day disagree. */
const SMALL_HOURS = new Date('2026-10-16T02:30:00+03:00')

const browser = await chromium.launch()

async function open({ at = EVENING } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const calls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.clock.setFixedTime(at)
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.split('/api/')[1]
    calls.push(`${req.method()} ${p}`)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    // PROVISIONAL doors (ticket 520 re-points them).
    if (p === 'RuleCampaign/Campaigns' && req.method() === 'GET') return route.fulfill(envelope(CAMPAIGNS.map(listRow)))
    const one = /^RuleCampaign\/Campaigns\/([^/]+)$/.exec(p)
    if (one && req.method() === 'GET') {
      const c = CAMPAIGNS.find((x) => x.id === decodeURIComponent(one[1]))
      return route.fulfill(c ? envelope(c) : envelope(null, { status: 404, success: false, message: NOT_FOUND, errorCode: 'RULE_CAMPAIGN_NOT_FOUND' }))
    }
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls }
}

const grid = '[data-campaigns-grid]'
/** The row ids the grid shows, in order. */
const rowIds = (page) =>
  page.$$eval(`${grid} .ag-row[row-id]`, (rows) => [
    ...new Map(
      rows.sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index'))).map((r) => [r.getAttribute('row-id'), 1]),
    ).keys(),
  ])
const waitRows = async (page, n) => {
  await page.waitForFunction(
    ([sel, count]) =>
      new Set([...document.querySelectorAll(`${sel} .ag-row[row-id]`)].map((r) => r.getAttribute('row-id'))).size === count &&
      !document.querySelector(`${sel} .ag-overlay-loading-center`),
    [grid, n],
    { timeout: 15000 },
  )
  await page.waitForTimeout(100)
}
const cell = (page, id, col) => page.locator(`${grid} .ag-row[row-id="${id}"] .ag-cell[col-id="${col}"]`).innerText()
const tileCount = async (page, tile) => (await page.locator(`[data-tile="${tile}"] [data-tile-count]`).innerText()).trim()
const COUNTS = { all: '16', draft: '1', waitingForApproval: '1', scheduled: '1', running: '11', expired: '1', disabled: '1' }
const readCounts = async (page) => Object.fromEntries(await Promise.all(Object.keys(COUNTS).map(async (k) => [k, await tileCount(page, k)])))

// ── 1–5 ──
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/`)
  const leaf = page.locator('a[href="/campaigns"]:not([data-workspace-back])').first()
  await leaf.waitFor({ timeout: 15000 })
  check('1: the Campaigns leaf is in the rail', await leaf.isVisible())
  await leaf.click()
  await page.waitForURL(`${BASE}/campaigns`)
  await waitRows(page, 16)
  check('1: the leaf opens /campaigns', page.url() === `${BASE}/campaigns`)
  check('1: ungated — no probe call was made for the group', !calls.some((c) => /RuleCampaign\/Access/.test(c)))

  const counts = await readCounts(page)
  check('2: a tile per state with its count at the local now', JSON.stringify(counts) === JSON.stringify(COUNTS), JSON.stringify(counts))
  check('2: every campaign is a row', (await rowIds(page)).length === 16)
  check('2: the English and the Arabic name are both shown', (await cell(page, 'BABY-BUNDLE', 'name')) === 'Diapers + two packs of wipes for SAR 85' && (await cell(page, 'BABY-BUNDLE', 'nameAr')) === 'حفاضات مع عبوتي مناديل بـ 85 ريال')
  check('2: the state column reads the derived state', (await cell(page, 'PRCB-AUG26', 'state')) === 'Expired' && (await cell(page, 'NATDAY-15', 'state')) === 'Scheduled' && (await cell(page, 'BDAY-BEAUTY', 'state')) === 'Waiting for approval')
  check('2: start and end are the local days; no end reads Open-ended', (await cell(page, 'WKND20', 'start')) === '2026-10-01' && (await cell(page, 'BASE-EARN', 'end')) === 'Open-ended')
  await page.screenshot({ path: `${SHOTS}/list.png` })

  await page.locator('[data-tile="expired"]').click()
  await waitRows(page, 1)
  check('3: the Expired tile shows only the expired campaign', JSON.stringify(await rowIds(page)) === '["PRCB-AUG26"]')
  check('3: the tile is pressed and lands in the URL', (await page.locator('[data-tile="expired"]').getAttribute('aria-pressed')) === 'true' && page.url().endsWith('?state=expired'))
  await page.locator('[data-tile="running"]').click()
  await waitRows(page, 11)
  check('3: the Running tile shows its eleven', (await rowIds(page)).length === 11 && !(await rowIds(page)).includes('NATDAY-15'))
  await page.locator('[data-tile="all"]').click()
  await waitRows(page, 16)
  check('3: All clears the filter', page.url() === `${BASE}/campaigns`)

  await page.locator('[data-campaign-search]').fill('حفاضات')
  await waitRows(page, 1)
  check('4: the Arabic name is searched', JSON.stringify(await rowIds(page)) === '["BABY-BUNDLE"]')
  await page.locator('[data-campaign-search]').fill('weekend')
  await waitRows(page, 2)
  check('4: the English name is searched', JSON.stringify((await rowIds(page)).sort()) === '["NEXT-VISIT","WKND20"]')
  check('4: the status bar says n of m', (await page.locator('[data-status-count]').innerText()) === 'Showing 2 of 16 campaigns', await page.locator('[data-status-count]').innerText())
  await page.locator('[data-campaign-search]').fill('gp-beauty')
  await waitRows(page, 1)
  check('4: the code is searched', JSON.stringify(await rowIds(page)) === '["GP-BEAUTY15"]')
  await page.locator('[data-tile="disabled"]').click()
  await page.waitForFunction(() => document.querySelector('[data-campaigns-grid] .ag-overlay-no-rows-center, [data-campaigns-grid] .ag-overlay')?.textContent?.includes('No campaign matches.'), null, { timeout: 5000 }).catch(() => {})
  check('4: a tile and the search together can match nothing, and say so', (await page.locator(grid).innerText()).includes('No campaign matches.'))
  await page.locator('[data-tile="all"]').click()
  await page.locator('[data-campaign-search]').fill('weekend')
  await waitRows(page, 2)

  const reads = () => calls.filter((c) => c === 'GET RuleCampaign/Campaigns/WKND20').length
  await page.locator(`${grid} .ag-row[row-id="WKND20"] .ag-cell[col-id="code"]`).click()
  await page.waitForURL(`${BASE}/campaigns/WKND20`)
  await page.locator('[data-dashboard]').waitFor({ timeout: 10000 })
  check('5: a row click opens the campaign at /campaigns/:id on its Dashboard', page.url() === `${BASE}/campaigns/WKND20`)
  const details = page.locator('[data-dashboard-cell="details"]')
  check('5: Details shows the English name', (await details.locator('[data-line="nameEn"] dd').innerText()) === 'Weekend coupon: 20% off, up to SAR 40')
  check('5: Details shows the Arabic name, isolated as free text', (await details.locator('[data-line="nameAr"] dd > bdi:not([dir])').innerText()) === 'قسيمة نهاية الأسبوع: خصم 20% حتى 40 ريال')
  check('5: Details shows the code and the features', (await details.locator('[data-line="code"] dd').innerText()) === 'WKND20' && (await details.locator('[data-feature]').allInnerTexts()).join('|') === 'Coupons|Loyalty points (Arbahi)')
  check('5: Details shows who created it, in local time', (await details.locator('[data-line="created"] dd').innerText()) === '2026-09-28 11:30 by Sara (CRM)', await details.locator('[data-line="created"] dd').innerText())
  const state = page.locator('[data-dashboard-cell="state"]')
  check('5: State reads Running with its live version', (await state.locator('[data-campaign-state]').innerText()) === 'Running' && (await state.locator('[data-live-version]').innerText()).startsWith('Version 1, activated 2026-09-28 11:30'))
  const sched = page.locator('[data-dashboard-cell="schedule"]')
  check('5: Schedule says "Ends in 76 days"', (await sched.locator('[data-schedule-relative]').innerText()) === 'Ends in 76 days', await sched.locator('[data-schedule-relative]').innerText())
  check('5: Schedule shows the local days and the weekdays', (await sched.locator('[data-line="start"] dd').innerText()) === '2026-10-01' && (await sched.locator('[data-line="end"] dd').innerText()) === '2026-12-31' && (await sched.locator('[data-line="days"] dd').innerText()) === 'Thursday, Friday, Saturday')
  check('5: the campaign was read ONCE for the shell and the dashboard', reads() === 1, String(reads()))
  check('5: the side menu shows only Dashboard (coupons is on, but its page has not landed)', JSON.stringify(await page.locator('[data-workspace-menu]').evaluateAll((els) => els.map((e) => e.getAttribute('data-workspace-menu')))) === '["dashboard"]')
  check('5: Dashboard is the current menu item', (await page.locator('[data-workspace-menu="dashboard"]').getAttribute('aria-current')) === 'page')
  check('5: the rail still lights the Campaigns leaf', (await page.locator('a[href="/campaigns"]:not([data-workspace-back])').first().getAttribute('aria-current')) === 'page')
  await page.screenshot({ path: `${SHOTS}/dashboard-wknd20.png` })
  await page.goBack()
  await waitRows(page, 2)
  check('5: Back returns to the list as it was left', page.url() === `${BASE}/campaigns?q=weekend`, page.url())
  check('9: no page errors (1–5)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6 ──
{
  const { context, page, errors } = await open()
  await page.goto(`${BASE}/campaigns`)
  await waitRows(page, 16)
  await page.locator('[data-campaign-link="NATDAY-15"]').click()
  await page.waitForURL(`${BASE}/campaigns/NATDAY-15`)
  await page.locator('[data-dashboard]').waitFor()
  check('6: the name link opens the campaign', page.url() === `${BASE}/campaigns/NATDAY-15`)
  check('6: a scheduled campaign "Starts in 3 days"', (await page.locator('[data-schedule-relative]').innerText()) === 'Starts in 3 days', await page.locator('[data-schedule-relative]').innerText())
  check('6: …reads Scheduled', (await page.locator('[data-dashboard-cell="state"] [data-campaign-state]').innerText()) === 'Scheduled')
  check('6: its daily hours are one isolated range', (await page.locator('[data-line="hours"] dd bdi[dir="ltr"]').innerText()) === '16:00–23:00')
  await page.screenshot({ path: `${SHOTS}/dashboard-natday.png` })

  await page.locator('[data-workspace-back]').click()
  await waitRows(page, 16)
  await page.locator('[data-campaign-link="BDAY-BEAUTY"]').click()
  await page.locator('[data-dashboard]').waitFor()
  check('6: a waiting campaign names who asked, and when', (await page.locator('[data-state-sentence="waitingForApproval"]').innerText()) === 'Omar (marketing) asked for approval on 2026-10-15 16:20.')
  check('6: …and shows the note', (await page.locator('[data-approval-note]').innerText()) === 'Ready for the November CRM push.')

  await page.goto(`${BASE}/campaigns/SPRING-DRAFT`)
  await page.locator('[data-dashboard]').waitFor()
  check('6: a draft with no schedule says "No time limit"', (await page.locator('[data-schedule-relative]').innerText()) === 'No time limit')
  check('6: …reads Draft', (await page.locator('[data-dashboard-cell="state"] [data-campaign-state]').innerText()) === 'Draft')
  check('6: …and says it has no Arabic name yet', (await page.locator('[data-line="nameAr"] dd').innerText()) === 'No Arabic name yet.')
  check('9: no page errors (6)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 7 ──
{
  const { context, page, errors } = await open({ at: SMALL_HOURS })
  await page.goto(`${BASE}/campaigns`)
  await waitRows(page, 16)
  const counts = await readCounts(page)
  check('7: at 02:30 local (23:30 UTC the day before) the counts are the local day’s', JSON.stringify(counts) === JSON.stringify(COUNTS), JSON.stringify(counts))
  await page.goto(`${BASE}/campaigns/NATDAY-15`)
  await page.locator('[data-dashboard]').waitFor()
  check('7: …and the scheduled campaign still "Starts in 3 days"', (await page.locator('[data-schedule-relative]').innerText()) === 'Starts in 3 days', await page.locator('[data-schedule-relative]').innerText())
  check('9: no page errors (7)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 8 ──
{
  const { context, page, errors } = await open()
  await page.goto(`${BASE}/campaigns/NOPE`)
  const banner = page.locator('[role="alert"]').first()
  await banner.waitFor({ timeout: 10000 })
  check('8: an unknown campaign shows the door’s own refusal', (await banner.innerText()).includes(NOT_FOUND), await banner.innerText())
  await page.locator('[data-workspace-back]').click()
  await page.waitForURL(`${BASE}/campaigns`)
  check('8: …and the way back to the list', page.url() === `${BASE}/campaigns`)
  check('9: no page errors (8)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
