// Campaigns drive (spec 2737; ticket 501 creates it — the workspace slices 502–512, 515 and 516
// EXTEND it with a section of their own, below 501's, and leave 501's checks unchanged).
//
// Drives the REAL app in Chromium against STUBS of the rule-campaign doors. No HQ contract exists
// yet (BackOffice 2758/2759 are unwritten), so the stubs serve the PROVISIONAL shapes of
// `src/core/models/rule-campaign.ts`, on the REAL envelope { statusCode, success, message,
// errors: [{ errorCode, internalErrorCode, errorMessage }], data }; ticket 520 re-points them:
//   GET RuleCampaign/Campaigns        → list rows (tools/campaigns-fixtures.mjs `listRow`)
//   GET RuleCampaign/Campaigns/{id}   → the whole campaign; an unknown id is a 404 refusal
//   POST RuleCampaign/Campaigns       → a new draft from { name: {en, ar}, features } (502, `createDraft`)
//   POST RuleCampaign/Campaigns/{id}/Copy → an independent draft "<name> (copy)" (502, `copyOf`)
//   GET RuleCampaign/Catalogue        → the block catalogue (504, `CATALOGUE`)
//   PUT RuleCampaign/Campaigns/{id}/Draft → saves { rules } and answers the whole campaign (505)
// Each browser context has its own copy of the fixtures, so a create or a copy stays in its run.
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
//      only the landed pages (Dashboard, and Rule builder since 504); Back returns to the list as it was left;
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
import { CAMPAIGNS, CATALOGUE, copyOf, createDraft, listRow } from './campaigns-fixtures.mjs'
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
const CATALOGUE_REFUSED = 'The block catalogue is not available. / كتالوج الكتل غير متاح.'
const CREATE_REFUSED = 'A campaign already has this name. / يوجد حملة بهذا الاسم.'
const SAVE_REFUSED = 'This campaign is waiting for approval and cannot be edited. / الحملة بانتظار الموافقة ولا يمكن تعديلها.'
/** The stubbed HQ's local clock for a create or a copy — the drive's EVENING. */
const NOW_LOCAL = '2026-10-16 18:30'

/** 2026-10-16 18:30 in Riyadh — the prototype's simulator moment. */
const EVENING = new Date('2026-10-16T18:30:00+03:00')
/** 2026-10-16 02:30 in Riyadh = 2026-10-15 23:30 UTC: the local day and the UTC day disagree. */
const SMALL_HOURS = new Date('2026-10-16T02:30:00+03:00')

const browser = await chromium.launch()

async function open({ at = EVENING, refuseCreate = false, refuseCatalogue = false, refuseSave = false, edit } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const calls = []
  /** This context's HQ: the fixtures, copied, so a create or a copy (502) stays in its own run. */
  const store = structuredClone(CAMPAIGNS)
  edit?.(store)
  /** 504: the catalogue door refuses until `heal()`. */
  let catalogueDown = refuseCatalogue
  const bodies = []
  /** 505: every draft save's body, in order. */
  const saves = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
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
    if (p === 'RuleCampaign/Catalogue' && req.method() === 'GET')
      return route.fulfill(catalogueDown ? envelope(null, { status: 503, success: false, message: CATALOGUE_REFUSED, errorCode: 'RULE_CATALOGUE_UNAVAILABLE' }) : envelope(CATALOGUE))
    if (p === 'RuleCampaign/Campaigns' && req.method() === 'GET') return route.fulfill(envelope(store.map(listRow)))
    if (p === 'RuleCampaign/Campaigns' && req.method() === 'POST') {
      const body = req.postDataJSON()
      bodies.push(body)
      if (refuseCreate) return route.fulfill(envelope(null, { status: 409, success: false, message: CREATE_REFUSED, errorCode: 'RULE_CAMPAIGN_NAME_TAKEN' }))
      return route.fulfill(envelope(createDraft(store, body, NOW_LOCAL)))
    }
    const one = /^RuleCampaign\/Campaigns\/([^/]+)$/.exec(p)
    if (one && req.method() === 'GET') {
      const c = store.find((x) => x.id === decodeURIComponent(one[1]))
      return route.fulfill(c ? envelope(c) : envelope(null, { status: 404, success: false, message: NOT_FOUND, errorCode: 'RULE_CAMPAIGN_NOT_FOUND' }))
    }
    const draft = /^RuleCampaign\/Campaigns\/([^/]+)\/Draft$/.exec(p)
    if (draft && req.method() === 'PUT') {
      const body = req.postDataJSON()
      saves.push(body)
      const c = store.find((x) => x.id === decodeURIComponent(draft[1]))
      if (!c) return route.fulfill(envelope(null, { status: 404, success: false, message: NOT_FOUND, errorCode: 'RULE_CAMPAIGN_NOT_FOUND' }))
      if (refuseSave) return route.fulfill(envelope(null, { status: 409, success: false, message: SAVE_REFUSED, errorCode: 'RULE_CAMPAIGN_NOT_EDITABLE' }))
      c.rules = structuredClone(body.rules)
      return route.fulfill(envelope(c))
    }
    const copy = /^RuleCampaign\/Campaigns\/([^/]+)\/Copy$/.exec(p)
    if (copy && req.method() === 'POST') {
      const c = store.find((x) => x.id === decodeURIComponent(copy[1]))
      return route.fulfill(c ? envelope(copyOf(store, c, NOW_LOCAL)) : envelope(null, { status: 404, success: false, message: NOT_FOUND, errorCode: 'RULE_CAMPAIGN_NOT_FOUND' }))
    }
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, store, bodies, saves, heal: () => (catalogueDown = false) }
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
  // Let the tile's render COMMIT before typing (the URL changes first, the render follows in a
  // transition): the search writes the tile it was rendered with.
  await page.waitForFunction(() => document.querySelector('[data-tile="all"]')?.getAttribute('aria-pressed') === 'true')
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
  // 504 lands the Rule builder; Coupons still waits for its page (515).
  check('5: the side menu shows Dashboard and Rule builder (coupons is on, but its page has not landed)', JSON.stringify(await page.locator('[data-workspace-menu]').evaluateAll((els) => els.map((e) => e.getAttribute('data-workspace-menu')))) === '["dashboard","rules"]')
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

// ── 502 ── it asserts:
//  10. New campaign opens Create campaign: an English and an Arabic name (the Arabic one dir=rtl),
//      Coupons off and Loyalty points on, each with its line saying what it switches on;
//  11. Create with a name missing says so at the field and sends nothing; Cancel sends nothing;
//      a reopened dialog is a fresh form;
//  12. both names + Coupons, sent with Enter → ONE POST with both names trimmed and the features →
//      the new draft's dashboard (both names, its code, Draft, its features, "No time limit"),
//      toasted; the list counts it;
//  13. a refusal is the door's own message, in the dialog, with the form kept; an edit clears it;
//  14. ⋯ › Copy campaign → an independent draft "<name> (copy)" in both languages, opened on its
//      dashboard as a Draft with no live version; the original is untouched (its name, Running,
//      version 1); the list counts both new drafts; Escape closes the ⋯ menu;
//  15. no page errors.
{
  const { context, page, errors, calls, bodies } = await open()
  const posts = () => calls.filter((c) => c === 'POST RuleCampaign/Campaigns').length
  await page.goto(`${BASE}/campaigns`)
  await waitRows(page, 16)
  await page.locator('[data-new-campaign]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  check('10: New campaign opens Create campaign', (await dialog.locator('#modal-title').innerText()) === 'Create campaign')
  check('10: an English and an Arabic name, the Arabic one right-to-left', (await dialog.locator('[data-create-field="nameEn"]').getAttribute('dir')) === 'ltr' && (await dialog.locator('[data-create-field="nameAr"]').getAttribute('dir')) === 'rtl')
  check('10: Coupons starts off and Loyalty points on', !(await dialog.locator('[data-create-feature="coupons"]').isChecked()) && (await dialog.locator('[data-create-feature="points"]').isChecked()))
  const features = await dialog.locator('[data-create-features]').innerText()
  check('10: each feature says what it switches on', features.includes('Adds the Coupons page and the coupon condition.') && features.includes('Adds the Arbahi earn and burn conditions and effects.'))
  await page.screenshot({ path: `${SHOTS}/create-dialog.png` })

  await dialog.locator('[data-create-submit]').click()
  check('11: with no names, both fields say they are required', (await dialog.locator('[data-create-problem="nameEn"]').innerText()) === 'Enter the campaign’s English name.' && (await dialog.locator('[data-create-problem="nameAr"]').innerText()) === 'Enter the campaign’s Arabic name.')
  await dialog.locator('[data-create-field="nameEn"]').fill('Ramadan nights')
  await dialog.locator('[data-create-submit]').click()
  check('11: with only the English name, the Arabic one is still asked for', (await dialog.locator('[data-create-problem]').count()) === 1 && (await dialog.locator('[data-create-problem="nameAr"]').isVisible()))
  check('11: …and nothing was sent', posts() === 0)
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await page.waitForFunction(() => !document.querySelector('dialog[open]'))
  check('11: Cancel closes the dialog and sends nothing', posts() === 0)

  await page.locator('[data-new-campaign]').click()
  await dialog.waitFor()
  check('11: a reopened dialog is a fresh form', (await dialog.locator('[data-create-field="nameEn"]').inputValue()) === '' && (await dialog.locator('[data-create-problem]').count()) === 0)
  await dialog.locator('[data-create-field="nameEn"]').fill('  Ramadan nights ')
  await dialog.locator('[data-create-field="nameAr"]').fill(' ليالي رمضان ')
  await dialog.locator('[data-create-feature="coupons"]').check()
  await dialog.locator('[data-create-field="nameAr"]').press('Enter')
  await page.waitForURL(`${BASE}/campaigns/RAMADAN-NIGHTS`, { timeout: 10000 })
  await page.locator('[data-dashboard]').waitFor()
  check('12: Enter sends ONE create', posts() === 1, String(posts()))
  check('12: …with both names trimmed and the features chosen', JSON.stringify(bodies[0]) === JSON.stringify({ name: { en: 'Ramadan nights', ar: 'ليالي رمضان' }, features: { coupons: true, points: true } }), JSON.stringify(bodies[0]))
  check('12: it lands on the new draft’s dashboard', page.url() === `${BASE}/campaigns/RAMADAN-NIGHTS`)
  const details = page.locator('[data-dashboard-cell="details"]')
  check('12: the dashboard shows both names', (await details.locator('[data-line="nameEn"] dd').innerText()) === 'Ramadan nights' && (await details.locator('[data-line="nameAr"] dd').innerText()) === 'ليالي رمضان')
  check('12: …the code HQ minted and both features', (await details.locator('[data-line="code"] dd').innerText()) === 'RAMADAN-NIGHTS' && (await details.locator('[data-feature]').allInnerTexts()).join('|') === 'Coupons|Loyalty points (Arbahi)')
  check('12: …a Draft with no time limit', (await page.locator('[data-dashboard-cell="state"] [data-campaign-state]').innerText()) === 'Draft' && (await page.locator('[data-schedule-relative]').innerText()) === 'No time limit')
  check('12: a toast says it was created', (await page.locator('[data-sonner-toast]').allInnerTexts()).some((x) => x.includes('Campaign created as a draft.')))
  check('12: the dialog has closed', (await page.locator('dialog[open]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/created-draft.png` })
  await page.locator('[data-workspace-back]').click()
  await waitRows(page, 17)
  check('12: the list counts the new draft', (await tileCount(page, 'all')) === '17' && (await tileCount(page, 'draft')) === '2')

  // ── 14 ──
  await page.goto(`${BASE}/campaigns/WKND20`)
  await page.locator('[data-dashboard]').waitFor()
  await page.locator('[data-campaign-actions]').click()
  const menu = page.locator('[data-campaign-actions-menu]')
  await menu.waitFor()
  check('14: ⋯ opens a menu with Copy campaign, focused', (await menu.locator('[data-campaign-action="copy"]').innerText()) === 'Copy campaign' && (await page.evaluate(() => document.activeElement?.getAttribute('data-campaign-action'))) === 'copy')
  await page.keyboard.press('Escape')
  await menu.waitFor({ state: 'detached' })
  check('14: Escape closes it, focus back on ⋯', (await page.evaluate(() => document.activeElement?.hasAttribute('data-campaign-actions'))) === true)
  const copies = () => calls.filter((c) => c === 'POST RuleCampaign/Campaigns/WKND20/Copy').length
  check('14: …and copied nothing', copies() === 0)
  await page.locator('[data-campaign-actions]').click()
  await menu.locator('[data-campaign-action="copy"]').click()
  await page.waitForURL(`${BASE}/campaigns/WKND20-COPY`, { timeout: 10000 })
  await page.waitForFunction(() => document.querySelector('[data-line="code"] dd')?.textContent === 'WKND20-COPY', null, { timeout: 10000 })
  check('14: ONE copy was asked for', copies() === 1, String(copies()))
  const cd = page.locator('[data-dashboard-cell="details"]')
  check('14: the copy is "<name> (copy)" in English…', (await cd.locator('[data-line="nameEn"] dd').innerText()) === 'Weekend coupon: 20% off, up to SAR 40 (copy)')
  check('14: …and in Arabic', (await cd.locator('[data-line="nameAr"] dd').innerText()) === 'قسيمة نهاية الأسبوع: خصم 20% حتى 40 ريال (نسخة)')
  check('14: the copy is a Draft with no live version', (await page.locator('[data-dashboard-cell="state"] [data-campaign-state]').innerText()) === 'Draft' && (await page.locator('[data-live-version]').count()) === 0)
  check('14: a toast says it was copied', (await page.locator('[data-sonner-toast]').allInnerTexts()).some((x) => x.includes('Copied as a new draft.')))
  await page.screenshot({ path: `${SHOTS}/copied-draft.png` })
  await page.goto(`${BASE}/campaigns/WKND20`)
  await page.locator('[data-dashboard]').waitFor()
  check('14: the original is untouched — its name, Running, version 1', (await page.locator('[data-line="nameEn"] dd').innerText()) === 'Weekend coupon: 20% off, up to SAR 40' && (await page.locator('[data-dashboard-cell="state"] [data-campaign-state]').innerText()) === 'Running' && (await page.locator('[data-live-version]').innerText()).startsWith('Version 1,'))
  await page.goto(`${BASE}/campaigns`)
  await waitRows(page, 18)
  check('14: the list counts both new drafts', (await tileCount(page, 'all')) === '18' && (await tileCount(page, 'draft')) === '3' && (await tileCount(page, 'running')) === '11')
  check('15: no page errors (10–14)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 13 ──
{
  const { context, page, errors } = await open({ refuseCreate: true })
  await page.goto(`${BASE}/campaigns`)
  await waitRows(page, 16)
  await page.locator('[data-new-campaign]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  await dialog.locator('[data-create-field="nameEn"]').fill('Weekend coupon')
  await dialog.locator('[data-create-field="nameAr"]').fill('قسيمة نهاية الأسبوع')
  await dialog.locator('[data-create-submit]').click()
  const banner = dialog.locator('[role="alert"]')
  await banner.waitFor({ timeout: 10000 })
  check('13: a refused create shows the door’s own message in the dialog', (await banner.innerText()).includes(CREATE_REFUSED), await banner.innerText())
  check('13: …keeps the form and stays on the list', (await dialog.locator('[data-create-field="nameEn"]').inputValue()) === 'Weekend coupon' && page.url() === `${BASE}/campaigns`)
  await dialog.locator('[data-create-field="nameEn"]').fill('Weekend coupon 2')
  check('13: an edit clears the refusal, which was about the name as sent', (await dialog.locator('[role="alert"]').count()) === 0)
  check('15: no page errors (13)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 504 ── it asserts:
//  16. the side menu's Rule builder opens /campaigns/:id/rules; the block catalogue is read ONCE
//      for every builder page of the app's life (two campaigns, in-app navigation);
//  17. SUN-3FOR2 reads as sentences: its filter as a chain, When all, two conditions and one
//      effect in words, values isolated by kind (money and counts in a dir=ltr isolate, the filter's
//      name in a plain <bdi>), and the marketer's EN + AR lines under each block, the Arabic dir=rtl;
//  18. EVERY sample campaign renders every block as a sentence: no unknown block, no raw key, no
//      template brace, no raw type id;
//  19. a rule with no condition reads "Always", and its summary says so;
//  20. a filter renamed on HQ reads by its new name — conditions and effects find it by id;
//  21. a card collapses and expands (aria-expanded, the summary stays); Collapse all / Expand all;
//  22. a refused catalogue is the door's own message, and Try again reads it afresh;
//  23. no page errors.
{
  const { context, page, errors, calls } = await open()
  const catalogueReads = () => calls.filter((c) => c === 'GET RuleCampaign/Catalogue').length
  await page.goto(`${BASE}/campaigns/SUN-3FOR2`)
  await page.locator('[data-dashboard]').waitFor()
  check('16: the catalogue is not read before the builder opens', catalogueReads() === 0)
  await page.locator('[data-workspace-menu="rules"]').click()
  await page.waitForURL(`${BASE}/campaigns/SUN-3FOR2/rules`)
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  check('16: Rule builder opens /campaigns/:id/rules, the current menu item', (await page.locator('[data-workspace-menu="rules"]').getAttribute('aria-current')) === 'page')
  check('16: one card per rule', (await page.locator('[data-rule-card]').count()) === 1)

  const card = page.locator('[data-rule-card]').first()
  check('17: the card is headed by its rule number and name', (await card.locator('[data-rule-name]').inputValue()) === 'Cheapest of every three suncare units free')
  check('17: its summary counts filters, conditions and effects', (await card.locator('[data-rule-summary]').innerText()).replace(/\s+/g, ' ') === '1 cart item filter 2 conditions 1 effect', await card.locator('[data-rule-summary]').innerText())
  const filter = card.locator('[data-filter]').first()
  check('17: the filter reads as a chain, by name', (await filter.locator('[data-filter-name]').innerText()) === 'sun' && JSON.stringify(await filter.locator('[data-filter-link]').allInnerTexts()) === '["cart items","in collection SUNCARE"]', JSON.stringify(await filter.locator('[data-filter-link]').allInnerTexts()))
  check('17: When all', (await card.locator('[data-when]').innerText()) === 'When all of these are true')
  const sentences = await card.locator('[data-condition] [data-block-sentence]').allInnerTexts()
  check('17: the conditions read as sentences', JSON.stringify(sentences) === JSON.stringify(['At least 3 units of sun', 'The value of all merchandise is at least SAR 150.00, before any offer']), JSON.stringify(sentences))
  check('17: the effect reads as a sentence', (await card.locator('[data-effect] [data-block-sentence]').innerText()) === 'For every 3 of sun, the cheapest 1 unit is free')
  check('17: money is one dir=ltr isolate', (await card.locator('[data-condition] [data-value="money"] bdi[dir="ltr"]').innerText()) === 'SAR 150.00')
  check('17: a count is a dir=ltr isolate', (await card.locator('[data-condition] [data-value="number"] bdi[dir="ltr"]').first().innerText()) === '3')
  check('17: the filter’s name is free text in a plain <bdi>', (await card.locator('[data-condition] [data-value="name"] > bdi:not([dir])').first().innerText()) === 'sun')
  const notMet = card.locator('[data-condition]').first().locator('[data-says="notMet"]')
  check('17: a condition’s "not met" line shows the English and the Arabic', (await notMet.locator('[data-says-en]').innerText()) === 'three suncare items' && (await notMet.locator('[data-says-ar]').innerText()) === 'ثلاثة منتجات للعناية بالشمس')
  check('17: …the Arabic one right-to-left', (await notMet.locator('[data-says-ar]').getAttribute('dir')) === 'rtl')
  const label = card.locator('[data-effect] [data-says="receiptLabel"]')
  check('17: the discount’s receipt label shows both languages', (await label.locator('[data-says-en]').innerText()) === 'Suncare 3 for 2' && (await label.locator('[data-says-ar]').innerText()) === 'العناية بالشمس 3 بسعر 2')
  await page.screenshot({ path: `${SHOTS}/rules-sun.png`, fullPage: true })

  // In-app to a second campaign's builder: the catalogue is not read again.
  await page.locator('[data-workspace-back]').click()
  await waitRows(page, 16)
  await page.locator('[data-campaign-link="GP-BEAUTY15"]').click()
  await page.locator('[data-dashboard]').waitFor()
  await page.locator('[data-workspace-menu="rules"]').click()
  await page.locator('[data-rules]').waitFor()
  check('16: the catalogue was read ONCE for two builder pages', catalogueReads() === 1, String(catalogueReads()))
  check('17: a choice reads in words: the tier', (await page.locator('[data-condition] [data-block-sentence]').first().innerText()) === 'The member’s tier is Gold or Platinum')
  check('17: a percent reads as one isolate', (await page.locator('[data-effect] [data-block-sentence]').innerText()) === 'Take 15% off each line of beauty' && (await page.locator('[data-effect] [data-value="percent"] bdi[dir="ltr"]').innerText()) === '15%')
  check('23: no page errors (16–17)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 18, 19 ──
{
  const { context, page, errors } = await open()
  const TYPE_IDS = CATALOGUE.blocks.map((b) => b.type).filter((type) => /[A-Z]/.test(type))
  const leaves = (items) => items.flatMap((c) => (c.type === 'group' ? leaves(c.items) : [c]))
  const bad = []
  let read = 0
  for (const c of CAMPAIGNS.filter((x) => x.rules.length)) {
    await page.goto(`${BASE}/campaigns/${c.id}/rules`)
    await page.locator('[data-rules]').waitFor({ timeout: 10000 })
    const blocks = c.rules.reduce((n, r) => n + leaves(r.when.items).length + r.then.length, 0)
    const shown = await page.locator('[data-condition], [data-effect]').count()
    const unknown = await page.locator('[data-sentence="sentence.unknown"]').count()
    const text = await page.locator('[data-rule-builder]').innerText()
    const leaks = TYPE_IDS.filter((id) => text.includes(id))
    if (shown !== blocks || unknown || /sentence\.|rules\.|\{\{|\}\}/.test(text) || leaks.length)
      bad.push(`${c.id}: ${shown}/${blocks} shown, ${unknown} unknown, leaks ${leaks.join(',')}`)
    read += shown
  }
  check('18: every sample campaign reads every block as a sentence, no raw key, no type id', bad.length === 0 && read > 0, bad.join(' | ') || `${read} blocks`)

  await page.goto(`${BASE}/campaigns/WLCB/rules`)
  await page.locator('[data-rules]').waitFor()
  check('18: a formula is shown as written, in one isolate', (await page.locator('[data-condition] [data-value="formula"] bdi[dir="ltr"]').innerText()) === 'back > 0')
  check('18: named values read with their formula', JSON.stringify(await page.locator('[data-value-id]').allInnerTexts()) === JSON.stringify(['spend is worked out as sum(eligible)', 'back is worked out as round(spend * 0.10, 0, halfUp)']))
  check('18: points read in words, with when they activate and expire', (await page.locator('[data-effect] [data-block-sentence]').innerText()) === 'Award back in SAR of points under the activity WLCB, usable after 7 days, expiring after 30 days')
  check('18: Prescription is named in the chain', (await page.locator('[data-filter-link]').allInnerTexts()).includes('not Prescription A006'))
  await page.screenshot({ path: `${SHOTS}/rules-wlcb.png`, fullPage: true })

  await page.goto(`${BASE}/campaigns/BH-SPEND10/rules`)
  await page.locator('[data-rules]').waitFor()
  check('18: a Bahraini amount reads to the fils', (await page.locator('[data-condition] [data-value="money"]').innerText()) === 'BHD 10.000')

  await page.goto(`${BASE}/campaigns/PCUT-SA01/rules`)
  await page.locator('[data-rules]').waitFor()
  check('19: a rule with no condition reads "Always"', (await page.locator('[data-when]').innerText()) === 'Always' && (await page.locator('[data-when]').getAttribute('data-when')) === 'always')
  check('19: …says what that means', (await page.locator('[data-rule-section="when"]').innerText()).includes('No condition: the effects apply to every sale the campaign reaches.'))
  check('19: …and its summary says always', (await page.locator('[data-rule-summary]').innerText()).includes('always'))
  check('19: a rule with no filter says it looks at all merchandise', (await page.locator('[data-rule-section="filters"]').innerText()).includes('No filter: the rule looks at all merchandise.'))
  check('23: no page errors (18–19)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 20, 21 ──
{
  const { context, page, errors } = await open({
    edit: (store) => {
      const sun = store.find((c) => c.id === 'SUN-3FOR2')
      sun.rules[0].filters[0].name = 'Suncare'
      sun.rules.push({ id: 'r-extra', name: 'Pouch with every suncare basket', filters: [], values: [], when: { mode: 'any', items: [] }, then: [{ id: 'e-extra', type: 'notify', text: { en: 'Ask about the pouch', ar: '' } }], partial: 'refuse' })
    },
  })
  await page.goto(`${BASE}/campaigns/SUN-3FOR2/rules`)
  await page.locator('[data-rules]').waitFor()
  const first = page.locator('[data-rule-card]').first()
  check('20: a renamed filter reads by its new name, found by id', (await first.locator('[data-condition] [data-block-sentence]').first().innerText()) === 'At least 3 units of Suncare' && (await first.locator('[data-effect] [data-block-sentence]').innerText()) === 'For every 3 of Suncare, the cheapest 1 unit is free')
  const second = page.locator('[data-rule-card="r-extra"]')
  check('21: a message with no Arabic yet says so', (await second.locator('[data-says="message"] [data-says-ar]').innerText()) === 'No Arabic yet.')

  const toggle = first.locator('[data-rule-toggle]')
  check('21: a card opens expanded', (await toggle.getAttribute('aria-expanded')) === 'true' && (await first.locator('[data-rule-body]').count()) === 1)
  await toggle.click()
  check('21: its toggle collapses it to the header and the summary', (await toggle.getAttribute('aria-expanded')) === 'false' && (await first.locator('[data-rule-body]').count()) === 0 && (await first.locator('[data-rule-summary]').isVisible()))
  check('21: …the other card stays open', (await second.locator('[data-rule-body]').count()) === 1)
  await toggle.click()
  check('21: and expands it again', (await toggle.getAttribute('aria-expanded')) === 'true' && (await first.locator('[data-rule-body]').count()) === 1)
  await page.locator('[data-rules-collapse-all]').click()
  check('21: Collapse all closes every card', (await page.locator('[data-rule-body]').count()) === 0 && (await page.locator('[data-rule-toggle][aria-expanded="false"]').count()) === 2)
  await page.screenshot({ path: `${SHOTS}/rules-collapsed.png`, fullPage: true })
  await page.locator('[data-rules-expand-all]').click()
  check('21: Expand all opens them again', (await page.locator('[data-rule-body]').count()) === 2)
  check('23: no page errors (20–21)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 22 ──
{
  const { context, page, errors, heal } = await open({ refuseCatalogue: true })
  await page.goto(`${BASE}/campaigns/SUN-3FOR2/rules`)
  const banner = page.locator('[role="alert"]').first()
  await banner.waitFor({ timeout: 10000 })
  check('22: a refused catalogue shows the door’s own message', (await banner.innerText()).includes(CATALOGUE_REFUSED), await banner.innerText())
  check('22: …and no rule is drawn half-read', (await page.locator('[data-rule-card]').count()) === 0)
  heal()
  await page.locator('[data-catalogue-retry]').click()
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  check('22: Try again reads the catalogue afresh and draws the rules', (await page.locator('[data-rule-card]').count()) === 1 && (await page.locator('[role="alert"]').count()) === 0)
  check('23: no page errors (22)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 505 ── it asserts:
//  24. the builder bar: Undo / Redo / Cancel / Save, all disabled on an unedited campaign;
//  25. + Condition opens the palette by group — only blocks the features switch on (points yes,
//      coupons no on SUN-3FOR2, saying where coupon blocks are), never a "not decided" one, and no
//      formula block until 507; a coupons campaign offers the coupon condition; Escape closes it;
//  26. a pick adds the block with its panel open; the panel's typed fields (a count, the rule's
//      filters by id) and the EN + AR "not met" pair (the Arabic dir=rtl) edit it live; Done closes
//      it and the sentence and both lines read the edit;
//  27. "Unsaved changes" shows; Undo steps back one edit (the typed pair is ONE step), Redo
//      forward; Undo to the start is clean again;
//  28. Save sends ONE draft save with the rules as edited (filters by id, the pair, the browser's
//      block id), clears the history, toasts; a reload reads the saved rule back;
//  29. + Effect, a discount filled in its panel, reorder of effects, delete; Cancel goes back to
//      the saved rules;
//  30. Add rule, name it, move it up, delete it; a group with a condition inside it (an empty one
//      leaves the rule "Always"); codes typed with commas, and Undo empties the input too;
//  31. leaving with unsaved changes asks: Stay keeps them, Leave and discard goes;
//  32. a refused save is the door's own message, the edits kept; a formula reads in its panel,
//      not editable;
//  33. no page errors.
{
  const { context, page, errors, saves } = await open()
  const sun = CAMPAIGNS.find((c) => c.id === 'SUN-3FOR2')
  const sunFilter = sun.rules[0].filters[0].id
  await page.goto(`${BASE}/campaigns/SUN-3FOR2/rules`)
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  const bar = page.locator('[data-builder-bar]')
  const disabled = async (sel) => bar.locator(sel).isDisabled()
  check('24: Undo, Redo, Cancel and Save are all disabled on an unedited campaign', (await disabled('[data-undo]')) && (await disabled('[data-redo]')) && (await disabled('[data-cancel]')) && (await disabled('[data-save]')) && (await page.locator('[data-unsaved]').count()) === 0)

  // ── 25 ──
  const card = page.locator('[data-rule-card]').first()
  await card.locator('[data-palette-open="when"]').click()
  const palette = card.locator('[data-palette="when"]')
  await palette.waitFor()
  const offered = await palette.locator('[data-palette-block]').evaluateAll((els) => els.map((e) => e.getAttribute('data-palette-block')))
  const groups = await palette.locator('[data-palette-group]').evaluateAll((els) => els.map((e) => e.getAttribute('data-palette-group')))
  check('25: the palette is grouped by category', JSON.stringify(groups) === JSON.stringify(['basket', 'attribute', 'loyalty', 'sale', 'logic']), JSON.stringify(groups))
  check('25: points blocks with points on, no coupon block with coupons off', offered.includes('minPoints') && !offered.includes('coupon'), offered.join(','))
  check('25: …and it says where the coupon blocks are', (await palette.locator('[data-palette-hidden="coupons"]').count()) === 1 && (await palette.locator('[data-palette-hidden="points"]').count()) === 0)
  check('25: "not decided" blocks and the formula block are left out', !offered.includes('anniversary') && !offered.includes('audience') && !offered.includes('expr'))
  check('25: blocks read in words', (await palette.locator('[data-palette-block="minCount"]').innerText()) === 'Number of items is at least')
  check('25: focus moves into the palette', await palette.locator('[data-palette-block="minSubtotal"]').evaluate((e) => e === document.activeElement))
  await page.keyboard.press('Escape')
  check('25: Escape closes it, focus back on its button', (await card.locator('[data-palette="when"]').count()) === 0 && (await card.locator('[data-palette-open="when"]').evaluate((e) => e === document.activeElement)))

  // ── 26 ──
  await card.locator('[data-palette-open="when"]').click()
  await card.locator('[data-palette="when"] [data-palette-block="minCount"]').click()
  const added = card.locator('[data-condition]').nth(2)
  const panel = added.locator('[data-block-panel]')
  check('26: a pick adds the block at the end of When, its panel open', (await card.locator('[data-condition]').count()) === 3 && (await panel.count()) === 1 && (await card.locator('[data-palette="when"]').count()) === 0)
  check('26: a new block reads with its number not picked yet', (await added.locator('[data-block-sentence]').innerText()) === 'At least not picked yet units of all merchandise', await added.locator('[data-block-sentence]').innerText())
  check('26: …and the summary counts it', (await card.locator('[data-rule-summary]').innerText()).includes('3 conditions'))
  await panel.locator('[data-panel-field="count"]').fill('2')
  await panel.locator('[data-panel-field="of"]').selectOption(sunFilter)
  check('26: the items field offers the rule’s filters by name', JSON.stringify(await panel.locator('[data-panel-field="of"] option').allInnerTexts()).includes('sun'))
  const ar = panel.locator('[data-panel-says="notMet"] [data-panel-says-ar]')
  check('26: the Arabic half is its own right-to-left input', (await ar.getAttribute('dir')) === 'rtl' && (await panel.locator('[data-panel-says="notMet"] [data-panel-says-en]').getAttribute('dir')) === 'ltr')
  await panel.locator('[data-panel-says="notMet"] [data-panel-says-en]').fill('two suncare items')
  await ar.fill('منتجان للعناية بالشمس')
  check('26: the sentence reads the panel live', (await added.locator('[data-block-sentence]').innerText()) === 'At least 2 units of sun', await added.locator('[data-block-sentence]').innerText())
  await page.screenshot({ path: `${SHOTS}/builder-panel.png`, fullPage: true })
  await panel.locator('[data-panel-done]').click()
  check('26: Done closes the panel', (await added.locator('[data-block-panel]').count()) === 0)
  const notMetLine = added.locator('[data-says="notMet"]')
  check('26: both halves of the "not met" pair show, the Arabic dir=rtl', (await notMetLine.locator('[data-says-en]').innerText()) === 'two suncare items' && (await notMetLine.locator('[data-says-ar]').innerText()) === 'منتجان للعناية بالشمس' && (await notMetLine.locator('[data-says-ar]').getAttribute('dir')) === 'rtl')

  // ── 27 ──
  check('27: Unsaved changes shows, Save and Undo are enabled', (await page.locator('[data-unsaved]').count()) === 1 && !(await disabled('[data-save]')) && !(await disabled('[data-undo]')) && (await disabled('[data-redo]')))
  await bar.locator('[data-undo]').click()
  check('27: Undo takes back the typed pair as ONE step', (await added.locator('[data-says="notMet"]').count()) === 0 && (await added.locator('[data-block-sentence]').innerText()) === 'At least 2 units of sun')
  await bar.locator('[data-redo]').click()
  check('27: Redo puts it back', (await added.locator('[data-says="notMet"] [data-says-ar]').innerText()) === 'منتجان للعناية بالشمس')
  for (let i = 0; i < 4; i++) await bar.locator('[data-undo]').click()
  check('27: Undo to the start removes the block and is clean again', (await card.locator('[data-condition]').count()) === 2 && (await page.locator('[data-unsaved]').count()) === 0 && (await disabled('[data-save]')) && (await disabled('[data-undo]')))
  for (let i = 0; i < 4; i++) await bar.locator('[data-redo]').click()
  check('27: Redo all the way brings it back whole', (await card.locator('[data-condition]').count()) === 3 && (await card.locator('[data-condition]').nth(2).locator('[data-block-sentence]').innerText()) === 'At least 2 units of sun' && (await disabled('[data-redo]')))

  // ── 28 ──
  await bar.locator('[data-save]').click()
  await page.locator('[data-unsaved]').waitFor({ state: 'detached', timeout: 10000 })
  const sent = saves[0]?.rules?.[0]?.when?.items?.[2]
  check('28: Save sends ONE draft save', saves.length === 1)
  check('28: …with the block as edited, items by filter id, both languages', sent?.type === 'minCount' && sent.count === 2 && sent.of === sunFilter && sent.says?.en === 'two suncare items' && sent.says?.ar === 'منتجان للعناية بالشمس' && typeof sent.id === 'string' && sent.id.length > 0, JSON.stringify(sent))
  check('28: …and the other blocks untouched', JSON.stringify(saves[0].rules[0].then) === JSON.stringify(sun.rules[0].then))
  check('28: saved: no unsaved pill, Save, Undo and Cancel disabled', (await disabled('[data-save]')) && (await disabled('[data-undo]')) && (await disabled('[data-cancel]')))
  check('28: a toast says so', await page.getByText('The rules are saved.').first().isVisible())
  await page.reload()
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  check('28: a reload reads the saved rule back', (await page.locator('[data-condition]').nth(2).locator('[data-block-sentence]').innerText()) === 'At least 2 units of sun')

  // ── 29 ──
  const card2 = page.locator('[data-rule-card]').first()
  await card2.locator('[data-palette-open="then"]').click()
  const effects = await card2.locator('[data-palette="then"] [data-palette-block]').evaluateAll((els) => els.map((e) => e.getAttribute('data-palette-block')))
  check('29: the effect palette offers points blocks with points on', effects.includes('awardPoints') && effects.includes('discountItems'), effects.join(','))
  await card2.locator('[data-palette="then"] [data-palette-block="discountItems"]').click()
  const effect = card2.locator('[data-effect]').nth(1)
  const ep = effect.locator('[data-block-panel]')
  check('29: the new effect works on the rule’s filter', (await ep.locator('[data-panel-field="on"]').inputValue()) === sunFilter)
  await ep.locator('[data-panel-field="value"]').fill('10')
  await ep.locator('[data-panel-says="receiptLabel"] [data-panel-says-en]').fill('Sun 10%')
  await ep.locator('[data-panel-says="receiptLabel"] [data-panel-says-ar]').fill('خصم الشمس 10%')
  check('29: a discount’s receipt label is an EN + AR pair, the Arabic dir=rtl', (await ep.locator('[data-panel-says="receiptLabel"] [data-panel-says-ar]').getAttribute('dir')) === 'rtl')
  check('29: a percent reads as a percent', (await effect.locator('[data-block-sentence]').innerText()) === 'Take 10% off each unit of sun', await effect.locator('[data-block-sentence]').innerText())
  await ep.locator('[data-panel-field="kind"]').selectOption('amount')
  check('29: a choice changes the wording and the unit', (await effect.locator('[data-block-sentence]').innerText()) === 'Take SAR 10.00 off each unit of sun', await effect.locator('[data-block-sentence]').innerText())
  await ep.locator('[data-panel-done]').click()
  await effect.locator('[data-move-up="block"]').click()
  check('29: an effect moves up', (await card2.locator('[data-effect]').first().locator('[data-block-sentence]').innerText()) === 'Take SAR 10.00 off each unit of sun')
  check('29: …the first cannot move up, the last cannot move down', (await card2.locator('[data-effect]').first().locator('[data-move-up="block"]').isDisabled()) && (await card2.locator('[data-effect]').last().locator('[data-move-down="block"]').isDisabled()))
  await card2.locator('[data-effect]').first().locator('[data-delete="block"]').click()
  check('29: delete removes it', (await card2.locator('[data-effect]').count()) === 1)
  await card2.locator('[data-effect]').first().locator('[data-block-edit]').click()
  check('29: a sentence opens its panel', (await card2.locator('[data-effect] [data-block-panel]').count()) === 1)
  await card2.locator('[data-effect] [data-panel-field="buy"]').fill('4')
  check('29: …which edits the saved block', (await card2.locator('[data-effect] [data-block-sentence]').innerText()) === 'For every 4 of sun, the cheapest 1 unit is free')
  await bar.locator('[data-cancel]').click()
  check('29: Cancel goes back to the saved rules', (await card2.locator('[data-effect]').count()) === 1 && (await card2.locator('[data-effect] [data-block-sentence]').innerText()) === 'For every 3 of sun, the cheapest 1 unit is free' && (await page.locator('[data-unsaved]').count()) === 0 && (await disabled('[data-undo]')))

  // ── 30 ──
  await page.locator('[data-add-rule]').click()
  const fresh = page.locator('[data-rule-card]').nth(1)
  check('30: Add rule adds an empty rule that reads "Always"', (await page.locator('[data-rule-card]').count()) === 2 && (await fresh.locator('[data-when]').innerText()) === 'Always')
  await fresh.locator('[data-rule-name]').fill('Gift for big baskets')
  await fresh.locator('[data-move-up="rule"]').click()
  check('30: a named rule moves up', (await page.locator('[data-rule-card]').first().locator('[data-rule-name]').inputValue()) === 'Gift for big baskets')
  const top = page.locator('[data-rule-card]').first()
  await top.locator('[data-palette-open="when"]').click()
  await top.locator('[data-palette="when"] [data-palette-block="group"]').click()
  const group = top.locator('[data-condition-group]')
  check('30: a group is added, empty, with its own palette', (await group.count()) === 1 && (await group.innerText()).includes('Nothing in this group yet.'))
  check('30: …and an empty group leaves the rule "Always", with no all / any to pick', (await top.locator('[data-when]').innerText()) === 'Always' && (await top.locator('[data-match="when"]').count()) === 0)
  await group.locator('[data-match]').selectOption('any')
  await group.locator('[data-palette-open]').click()
  await group.locator('[data-palette-block="member"]').click()
  check('30: a condition goes into the group, its panel open', (await group.locator('[data-condition]').count()) === 1 && (await group.locator('[data-block-panel]').count()) === 1 && (await group.locator('p').first().innerText()) === 'Any of these is true')
  await group.locator('[data-panel-done]').click()
  check('30: …and reads as a sentence', (await group.locator('[data-condition] [data-block-sentence]').innerText()) === 'The customer is an identified member')
  await top.locator('[data-palette-open="when"]').click()
  await top.locator('[data-palette="when"] [data-palette-block="store"]').click()
  const stores = top.locator('[data-condition][data-sentence="sentence.condition.store"]')
  await stores.locator('[data-panel-field="in"]').fill('P001, P002')
  check('30: codes typed with commas read as a list', (await stores.locator('[data-block-sentence]').innerText()) === 'The store is P001 or P002', await stores.locator('[data-block-sentence]').innerText())
  await bar.locator('[data-undo]').click()
  check('30: Undo empties the codes input too', (await stores.locator('[data-panel-field="in"]').inputValue()) === '' && (await stores.locator('[data-block-sentence]').innerText()) === 'The store is nothing picked yet')
  await stores.locator('[data-panel-done]').click()
  await top.locator('[data-delete="rule"]').click()
  check('30: delete removes the rule', (await page.locator('[data-rule-card]').count()) === 1 && (await page.locator('[data-rule-card]').first().locator('[data-rule-name]').inputValue()) === 'Cheapest of every three suncare units free')

  // ── 31 ──
  await page.locator('[data-rule-card]').first().locator('[data-rule-name]').fill('Suncare 3 for 2')
  await page.locator('[data-workspace-menu="dashboard"]').click()
  const leave = page.locator('[data-leave-dialog]')
  await leave.waitFor({ timeout: 5000 })
  check('31: leaving with unsaved changes asks first', page.url().endsWith('/campaigns/SUN-3FOR2/rules'))
  await page.locator('[data-leave-stay]').click()
  await page.locator('[data-leave-dialog]').waitFor({ state: 'detached', timeout: 5000 })
  check('31: Stay keeps the page and the edit', (await page.locator('[data-leave-dialog]').count()) === 0 && page.url().endsWith('/rules') && (await page.locator('[data-rule-name]').first().inputValue()) === 'Suncare 3 for 2', `${await page.locator('[data-leave-dialog]').count()} ${page.url()} ${await page.locator('[data-rule-name]').first().inputValue()}`)
  await page.locator('[data-workspace-menu="dashboard"]').click()
  await page.locator('[data-leave-go]').click()
  await page.locator('[data-dashboard]').waitFor()
  check('31: Leave and discard goes', page.url().endsWith('/campaigns/SUN-3FOR2'))
  await page.locator('[data-workspace-menu="rules"]').click()
  await page.locator('[data-rules]').waitFor()
  check('31: …and the builder reads the saved rules again', (await page.locator('[data-rule-name]').first().inputValue()) === 'Cheapest of every three suncare units free' && (await page.locator('[data-unsaved]').count()) === 0)
  check('31: a clean builder leaves without asking', await (async () => {
    await page.locator('[data-workspace-menu="dashboard"]').click()
    await page.locator('[data-dashboard]').waitFor()
    return (await page.locator('[data-leave-dialog]').count()) === 0
  })())
  check('33: no page errors (24–31)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 32 ──
{
  const { context, page, errors, saves } = await open({ refuseSave: true })
  await page.goto(`${BASE}/campaigns/WLCB/rules`)
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  const expr = page.locator('[data-condition][data-sentence="sentence.condition.expr"]')
  await expr.locator('[data-block-edit]').click()
  const fp = expr.locator('[data-block-panel]')
  check('32: a formula reads in its panel as written, not editable', (await fp.locator('[data-panel-field="formula"] code').innerText()) === 'back > 0' && (await fp.locator('[data-panel-field="formula"] input, [data-panel-field="formula"] textarea').count()) === 0)
  await fp.locator('[data-panel-says="notMet"] [data-panel-says-en]').fill('something to give back')
  await fp.locator('[data-panel-done]').click()
  const award = page.locator('[data-effect]').first()
  await award.locator('[data-block-edit]').click()
  check('32: a points value names its named value', (await award.locator('[data-panel-value-source="value"] option:checked').innerText()).replace(/[⁨⁩]/g, '') === 'back', (await award.locator('[data-block-panel]').innerHTML()).slice(0, 1500))
  await page.locator('[data-builder-bar] [data-save]').click()
  const banner = page.locator('[role="alert"]').first()
  await banner.waitFor({ timeout: 10000 })
  check('32: a refused save shows the door’s own message', (await banner.innerText()).includes(SAVE_REFUSED) && saves.length === 1, await banner.innerText())
  check('32: …and the edits are kept, still unsaved', (await page.locator('[data-unsaved]').count()) === 1 && (await expr.locator('[data-says="notMet"] [data-says-en]').innerText()) === 'something to give back')
  await page.screenshot({ path: `${SHOTS}/builder-refused.png`, fullPage: true })
  check('33: no page errors (32)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 25 (features) ──
{
  const { context, page, errors } = await open({ edit: (store) => (store.find((c) => c.id === 'WKND20').features = { coupons: true, points: false }) })
  await page.goto(`${BASE}/campaigns/WKND20/rules`)
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  await page.locator('[data-palette-open="when"]').click()
  const cond = await page.locator('[data-palette="when"] [data-palette-block]').evaluateAll((els) => els.map((e) => e.getAttribute('data-palette-block')))
  check('25: a coupons campaign offers the coupon condition; points off hides minPoints', cond.includes('coupon') && !cond.includes('minPoints'), cond.join(','))
  await page.locator('[data-palette-close]').click()
  await page.locator('[data-palette-open="then"]').click()
  const eff = await page.locator('[data-palette="then"] [data-palette-block]').evaluateAll((els) => els.map((e) => e.getAttribute('data-palette-block')))
  check('25: points off hides the earn and burn effects, and says where they are', !eff.includes('awardPoints') && !eff.includes('burnPoints') && (await page.locator('[data-palette="then"] [data-palette-hidden="points"]').count()) === 1, eff.join(','))
  check('33: no page errors (25 features)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
