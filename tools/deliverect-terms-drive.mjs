// Deliverect platforms and terms drive (ticket 482, BackOffice spec 2615).
//
// Drives the REAL app in Chromium against STUBS of the Deliverect door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2615-deliverect-web-door-contract.md § Platforms and
// terms) — BackOffice 2627 is not built, so there is no live SIS.Api to point at. Every fixture emits
// EXACTLY the contract's fields, on the REAL envelope { statusCode, success, message, errors:
// [{ errorCode, internalErrorCode, errorMessage }], data }, and every refusal's errorMessage is
// "<English> / <Arabic>":
//   GET  DeliverectWeb/Access                → { canManageStores, canManageCatalog, canViewOrders, canManageTerms }
//   GET  DeliverectWeb/Accounts              → [{ accountKey, deliverectAccountId, active }]
//   GET  DeliverectWeb/Platforms             → [{ platformKey, displayName, channelId, creditCustomer, active }]
//   PUT  DeliverectWeb/Platforms/{key}       → body { displayName, channelId, creditCustomer, active, reason }
//   GET  DeliverectWeb/Terms?platform=       → [{ termsId, platformKey, validFrom, validTo, customerDiscountPct,
//                                                commissionPct, deliveryFee, deliveryFeeThreshold, currencyKey }]
//   POST DeliverectWeb/Terms                 → body = the row without termsId / validTo, plus reason; DLV-00008
// The stubs keep state: a PUT changes the platform row, and a POST closes the open row the day before
// the new row's validFrom — so the refetched page shows what the door would.
//
// It asserts:
//   1. the Terms leaf joins the Deliverect group LAST on canManageTerms; without it the leaf is
//      hidden and the URL shows the denied card with no Platforms / Terms call; one probe call;
//   2. the accounts, read only: account, Deliverect account id, active;
//   3. the platforms: display name (bidi), key, channel id, credit customer (or "None"), active;
//      the first platform's terms show by default; picking another lands on the door and the URL;
//   4. the timeline: rows by validFrom, the open row marked current with "Open" for valid-to; money
//      with 3 decimals and its currency; NO edit or delete affordance on any row;
//   5. edit a platform: Save off until a change; the PUT body is exactly the contract's; clearing the
//      credit customer of an active platform says its orders would be refused and blocks Save until
//      Active is unticked; a platform with no credit customer cannot be ticked active;
//   6. add terms: the dialog says the current row closes the day before (with the date); fields
//      start from the open row; the POST body is exactly the contract's; the timeline refreshes;
//   7. the overlap: a validFrom inside a row is flagged client-side and still sent; DLV-00008 shows
//      the server's sentence inline at the date, the dialog stays open;
//   8. under RTL (direction) machine values are isolated, and add terms works.
//
//   1. run the app:  npx vite --port 5196 --strictPort
//   2. DRIVE_PORT=5196 node tools/deliverect-terms-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.deliverect-terms-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope (copied from tools/materials-search-drive.mjs).
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

const REFUSALS = {
  'DLV-00008': [400, 'Valid from overlaps existing terms for this platform. / تاريخ البدء يتداخل مع شروط قائمة لهذه المنصة.'],
}
const refuse = (code) => {
  const [status, message] = REFUSALS[code]
  return envelope(null, { status, success: false, message, errorCode: code })
}

const ACCOUNTS = [
  { accountKey: 'OlaCare', deliverectAccountId: '64fACC01', active: true },
  { accountKey: 'AlDawaa', deliverectAccountId: '64fACC02', active: false },
]
const platformsFixture = () => [
  { platformKey: 'JAHEZ', displayName: 'Jahez', channelId: 0, creditCustomer: '0001100001', active: true },
  { platformKey: 'KEETA', displayName: 'كيتا Keeta', channelId: 7, creditCustomer: '0001100002', active: true },
  { platformKey: 'MRSOOL', displayName: 'Mrsool', channelId: 9, creditCustomer: null, active: false },
]
/** A terms row exactly as the contract has it. */
const terms = (termsId, platformKey, validFrom, validTo, over = {}) => ({
  termsId,
  platformKey,
  validFrom,
  validTo,
  customerDiscountPct: 6.5,
  commissionPct: 2.5,
  deliveryFee: 9,
  deliveryFeeThreshold: 55,
  currencyKey: 'SAR',
  ...over,
})
// Out of order on purpose: the page sorts by validFrom.
const termsFixture = () => [
  terms('01JT3', 'JAHEZ', '2026-11-01', null, { customerDiscountPct: 7, deliveryFee: 10.5 }),
  terms('01JT1', 'JAHEZ', '2026-01-01', '2026-06-30', { customerDiscountPct: 5, commissionPct: 2 }),
  terms('01JT2', 'JAHEZ', '2026-07-01', '2026-10-31'),
  terms('01KT1', 'KEETA', '2026-03-01', null, { commissionPct: 3.25, deliveryFee: 0, deliveryFeeThreshold: 0 }),
]

const dayBefore = (d) => {
  const [y, m, dd] = d.split('-').map(Number)
  const x = new Date(y, m - 1, dd - 1)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

const ALL = { canManageStores: true, canManageCatalog: true, canViewOrders: true, canManageTerms: true }

const browser = await chromium.launch()

async function open(dir, { access = ALL } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const reads = []
  const writes = []
  const platforms = platformsFixture()
  const rows = termsFixture()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.split('/api/')[1]
    calls.push(p)
    const body = () => JSON.parse(req.postData() ?? 'null')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'DeliverectWeb/Access') return route.fulfill(envelope(access))
    if (p === 'DeliverectWeb/Accounts') return route.fulfill(envelope(ACCOUNTS))
    if (p === 'DeliverectWeb/Platforms' && req.method() === 'GET') return route.fulfill(envelope(platforms))
    let m = /^DeliverectWeb\/Platforms\/([^/]+)$/.exec(p)
    if (m && req.method() === 'PUT') {
      const key = decodeURIComponent(m[1])
      const b = body()
      writes.push({ door: 'platform', key, body: b })
      const i = platforms.findIndex((x) => x.platformKey === key)
      const { reason: _reason, ...fields } = b
      platforms[i] = { platformKey: key, ...fields }
      return route.fulfill(envelope(null))
    }
    if (p === 'DeliverectWeb/Terms' && req.method() === 'GET') {
      const platform = url.searchParams.get('platform')
      reads.push(platform)
      return route.fulfill(envelope(rows.filter((r) => r.platformKey === platform)))
    }
    if (p === 'DeliverectWeb/Terms' && req.method() === 'POST') {
      const b = body()
      writes.push({ door: 'terms', body: b })
      const mine = rows.filter((r) => r.platformKey === b.platformKey)
      const latest = mine.reduce((a, r) => (r.validFrom > a ? r.validFrom : a), '')
      if (b.validFrom <= latest) return route.fulfill(refuse('DLV-00008'))
      const openRow = mine.find((r) => r.validTo === null)
      if (openRow) openRow.validTo = dayBefore(b.validFrom)
      const { reason: _reason, ...fields } = b
      rows.push({ termsId: `01NEW${rows.length}`, ...fields, validTo: null })
      return route.fulfill(envelope(null))
    }
    if (p === 'MaterialWeb/Access') return route.fulfill(envelope({ canSearchMaterials: true, canCheckStock: true, canCheckGs1: true }))
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, reads, writes }
}

const dialog = (page) => page.locator('dialog[open]')
const closed = (page) => page.locator('dialog[open]').waitFor({ state: 'detached', timeout: 10000 })
const giveReason = async (page, text) => page.locator('dialog[open] [data-reason-input]').fill(text)
const termsCell = (page, id, cell) => page.locator(`[data-terms-row="${id}"] [data-cell="${cell}"]`)
const platformCell = (page, key, cell) => page.locator(`[data-platform-row="${key}"] [data-cell="${cell}"]`)
const termsIds = (page) => page.locator('[data-terms-row]').evaluateAll((els) => els.map((e) => e.dataset.termsRow))
const waitTerms = (page, key) => page.locator(`[data-terms-table="${key}"]`).waitFor({ timeout: 20000 })

// ── 1: the menu and the gate ──────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open('ltr')
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^Deliverect$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  await page.locator('nav a[href="/deliverect/terms"]').first().waitFor({ timeout: 5000 })
  const hrefs = await page.locator('nav a[href^="/deliverect"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check(
    '1: the Terms leaf joins the group LAST',
    JSON.stringify(hrefs) === JSON.stringify(['/deliverect/stores', '/deliverect/orders', '/deliverect/catalog', '/deliverect/terms']),
    hrefs.join(),
  )
  check('1: the leaf reads "Platforms & terms"', (await page.locator('nav a[href="/deliverect/terms"]').first().innerText()).trim() === 'Platforms & terms')
  await page.locator('nav a[href="/deliverect/terms"]').first().click()
  await waitTerms(page, 'JAHEZ')
  check('1: the group, its leaves and the page gate cost ONE probe call', calls.filter((c) => c === 'DeliverectWeb/Access').length === 1)
  check('1: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors, calls } = await open('ltr', { access: { ...ALL, canManageTerms: false } })
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^Deliverect$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  await page.locator('nav a[href="/deliverect/catalog"]').first().waitFor({ timeout: 5000 })
  check('1: 🚩 without canManageTerms the Terms leaf is hidden', (await page.locator('nav a[href="/deliverect/terms"]').count()) === 0)
  await page.goto(`${BASE}/deliverect/terms`)
  await page.getByText('No access to delivery platforms and terms').waitFor({ timeout: 20000 })
  check(
    '1: the URL shows the denied card and asks no Accounts / Platforms / Terms call',
    !calls.some((c) => ['DeliverectWeb/Accounts', 'DeliverectWeb/Platforms', 'DeliverectWeb/Terms'].includes(c)),
    calls.filter((c) => c.startsWith('Deliverect')).join(),
  )
  check('1 (denied): no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page } = await open('ltr', { access: { canManageStores: false, canManageCatalog: false, canViewOrders: false, canManageTerms: true } })
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^Deliverect$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  await page.locator('nav a[href="/deliverect/terms"]').first().waitFor({ timeout: 5000 })
  const hrefs = await page.locator('nav a[href^="/deliverect"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check('1: a session holding only canManageTerms gets a one-leaf group', JSON.stringify(hrefs) === JSON.stringify(['/deliverect/terms']), hrefs.join())
  await context.close()
}

// ── 2–4: accounts, platforms, the timeline ─────────────────────────────────────────────────────
{
  const { context, page, errors, reads } = await open('ltr')
  await page.goto(`${BASE}/deliverect/terms`)
  await waitTerms(page, 'JAHEZ')
  await page.locator('[data-accounts-table]').waitFor()
  const accounts = await page.locator('[data-account-row]').evaluateAll((els) => els.map((e) => e.dataset.accountRow))
  check('2: every account is listed', JSON.stringify(accounts) === JSON.stringify(['OlaCare', 'AlDawaa']), accounts.join())
  check('2: its Deliverect account id', (await page.locator('[data-account-row="OlaCare"] [data-cell="deliverectAccountId"]').innerText()) === '64fACC01')
  check('2: active yes / no', (await page.locator('[data-account-row="OlaCare"] [data-cell="active"]').innerText()) === 'Yes' && (await page.locator('[data-account-row="AlDawaa"] [data-cell="active"]').innerText()) === 'No')
  check('2: 🚩 read only — no button in the accounts', (await page.locator('[data-section="accounts"] button').count()) === 0)

  const keys = await page.locator('[data-platform-row]').evaluateAll((els) => els.map((e) => e.dataset.platformRow))
  check('3: every platform is listed', JSON.stringify(keys) === JSON.stringify(['JAHEZ', 'KEETA', 'MRSOOL']), keys.join())
  check('3: display name as free text', (await platformCell(page, 'KEETA', 'displayName').locator('bdi').innerText()) === 'كيتا Keeta')
  check('3: channel id', (await platformCell(page, 'KEETA', 'channelId').innerText()) === '7')
  check('3: credit customer', (await platformCell(page, 'JAHEZ', 'creditCustomer').innerText()) === '0001100001')
  check('3: no credit customer reads "None"', (await platformCell(page, 'MRSOOL', 'creditCustomer').innerText()) === 'None')
  check('3: active / inactive', (await platformCell(page, 'JAHEZ', 'active').innerText()) === 'Active' && (await platformCell(page, 'MRSOOL', 'active').innerText()) === 'Inactive')
  check('3: the first platform’s terms show by default', reads[0] === 'JAHEZ' && (await page.locator('[data-timeline-title]').innerText()) === 'Terms of Jahez')

  check('4: rows sort by validFrom', JSON.stringify(await termsIds(page)) === JSON.stringify(['01JT1', '01JT2', '01JT3']))
  const current = await page.locator('[data-terms-row][data-current]').evaluateAll((els) => els.map((e) => e.dataset.termsRow))
  check('4: the open row is marked current, and only it', JSON.stringify(current) === JSON.stringify(['01JT3']) && (await page.locator('[data-terms-row="01JT3"]').innerText()).includes('Current'))
  check('4: the open row’s valid-to reads "Open"', (await termsCell(page, '01JT3', 'validTo').innerText()) === 'Open')
  check('4: a closed row’s dates', (await termsCell(page, '01JT2', 'validFrom').innerText()) === '2026-07-01' && (await termsCell(page, '01JT2', 'validTo').innerText()) === '2026-10-31')
  check('4: percentages', (await termsCell(page, '01JT3', 'customerDiscountPct').innerText()) === '7' && (await termsCell(page, '01JT2', 'commissionPct').innerText()) === '2.5')
  check('4: money has 3 decimals and its currency', (await termsCell(page, '01JT3', 'deliveryFee').innerText()) === '10.500 SAR' && (await termsCell(page, '01JT3', 'deliveryFeeThreshold').innerText()) === '55.000 SAR')
  check('4: 🚩 no edit or delete affordance on any terms row', (await page.locator('[data-terms-table] button, [data-terms-table] input').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/ltr-page.png`, fullPage: true })

  await page.locator('[data-platform-terms="KEETA"]').click()
  await waitTerms(page, 'KEETA')
  check('3: picking a platform lands on the door and the URL', reads.at(-1) === 'KEETA' && new URL(page.url()).searchParams.get('platform') === 'KEETA')
  check('3: … and marks it picked', (await page.locator('[data-platform-terms="KEETA"]').getAttribute('aria-pressed')) === 'true')
  check('4: a zero fee is 0.000', (await termsCell(page, '01KT1', 'deliveryFee').innerText()) === '0.000 SAR')
  await page.locator('[data-platform-terms="MRSOOL"]').click()
  await page.locator('[data-empty="timeline"]').waitFor({ timeout: 10000 })
  check('4: a platform with no terms says so', /No terms yet/.test(await page.locator('[data-empty="timeline"]').innerText()))
  await page.goto(`${BASE}/deliverect/terms?platform=KEETA`)
  await waitTerms(page, 'KEETA')
  check('3: a pasted URL picks the platform', reads.at(-1) === 'KEETA')
  check('2–4: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 5: edit a platform ─────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, writes } = await open('ltr')
  await page.goto(`${BASE}/deliverect/terms`)
  await waitTerms(page, 'JAHEZ')
  await page.locator('[data-platform-edit="JAHEZ"]').click()
  await dialog(page).locator('[data-platform-dialog]').waitFor()
  check('5: the fields start from the row', (await page.locator('[data-edit-display-name]').inputValue()) === 'Jahez' && (await page.locator('[data-edit-channel-id]').inputValue()) === '0' && (await page.locator('[data-edit-credit-customer]').inputValue()) === '0001100001' && (await page.locator('[data-edit-active]').isChecked()))
  await giveReason(page, 'New SAP customer')
  check('5: Save is off until something changes', await page.locator('[data-reason-confirm]').isDisabled())
  await page.locator('[data-edit-credit-customer]').fill('')
  await page.locator('[data-edit-active-blocked="problem"]').waitFor()
  check('5: 🚩 clearing the credit customer of an active platform says its orders would be refused', /no credit customer cannot be active: its orders would be refused/i.test(await page.locator('[data-edit-active-blocked]').innerText()))
  check('5: … and blocks Save', await page.locator('[data-reason-confirm]').isDisabled())
  await page.screenshot({ path: `${SHOTS}/ltr-edit-blocked.png` })
  await page.locator('[data-edit-active]').uncheck()
  check('5: unticked, the sentence stays as a note and the box cannot be ticked again', (await page.locator('[data-edit-active-blocked="note"]').count()) === 1 && (await page.locator('[data-edit-active]').isDisabled()))
  await page.locator('[data-edit-credit-customer]').fill(' 0001100099 ')
  check('5: a credit customer frees the box', !(await page.locator('[data-edit-active]').isDisabled()) && (await page.locator('[data-edit-active-blocked]').count()) === 0)
  await page.locator('[data-edit-active]').check()
  await page.locator('[data-edit-display-name]').fill('Jahez KSA')
  await page.locator('[data-edit-channel-id]').fill('1.5')
  check('5: the channel id must be a whole number', (await page.locator('[data-field-problem="channelId"]').count()) === 1 && (await page.locator('[data-reason-confirm]').isDisabled()))
  await page.locator('[data-edit-channel-id]').fill('3')
  await page.locator('[data-reason-confirm]').click()
  await closed(page)
  const w = writes.at(-1)
  check(
    '5: the PUT body is exactly { displayName, channelId, creditCustomer, active, reason }',
    w.door === 'platform' && w.key === 'JAHEZ' && JSON.stringify(w.body) === JSON.stringify({ displayName: 'Jahez KSA', channelId: 3, creditCustomer: '0001100099', active: true, reason: 'New SAP customer' }),
    JSON.stringify(w),
  )
  await page.locator('[data-platform-row="JAHEZ"] [data-cell="creditCustomer"]', { hasText: '0001100099' }).waitFor({ timeout: 10000 })
  check('5: the list is refetched', (await platformCell(page, 'JAHEZ', 'displayName').innerText()) === 'Jahez KSA')

  await page.locator('[data-platform-edit="MRSOOL"]').click()
  await dialog(page).locator('[data-platform-dialog]').waitFor()
  check('5: a platform with no credit customer cannot be ticked active, and says why', (await page.locator('[data-edit-active]').isDisabled()) && (await page.locator('[data-edit-active-blocked="note"]').count()) === 1)
  await page.locator('[data-edit-credit-customer]').fill('0001100003')
  await page.locator('[data-edit-active]').check()
  await giveReason(page, 'Mrsool goes live')
  await page.locator('[data-reason-confirm]').click()
  await closed(page)
  check('5: … and with one it goes active', JSON.stringify(writes.at(-1).body) === JSON.stringify({ displayName: 'Mrsool', channelId: 9, creditCustomer: '0001100003', active: true, reason: 'Mrsool goes live' }), JSON.stringify(writes.at(-1).body))

  await page.locator('[data-platform-edit="KEETA"]').click()
  await dialog(page).locator('[data-platform-dialog]').waitFor()
  await page.locator('[data-edit-credit-customer]').fill('')
  await page.locator('[data-edit-active]').uncheck()
  await giveReason(page, 'Contract ended')
  await page.locator('[data-reason-confirm]').click()
  await closed(page)
  check('5: an empty credit customer is sent as null, inactive', JSON.stringify(writes.at(-1).body) === JSON.stringify({ displayName: 'كيتا Keeta', channelId: 7, creditCustomer: null, active: false, reason: 'Contract ended' }), JSON.stringify(writes.at(-1).body))
  check('5: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6–7: add terms, and the overlap ────────────────────────────────────────────────────────────
{
  const { context, page, errors, writes } = await open('ltr')
  await page.goto(`${BASE}/deliverect/terms`)
  await waitTerms(page, 'JAHEZ')
  await page.locator('[data-terms-add]').click()
  await dialog(page).locator('[data-terms-dialog]').waitFor()
  check('6: the dialog says rows are never edited', /never edited: a correction is a new row/.test(await page.locator('[data-terms-note]').innerText()))
  check('6: before a date, it says the current row closes the day before', /close the day before the new row starts/.test(await page.locator('[data-terms-closes]').innerText()))
  const values = await page.locator('[data-terms-field]').evaluateAll((els) => els.map((e) => `${e.dataset.termsField}=${e.value}`))
  check('6: the numbers start from the open row', values.join() === 'customerDiscountPct=7,commissionPct=2.5,deliveryFee=10.500,deliveryFeeThreshold=55.000', values.join())
  check('6: the currency is the row’s', (await page.locator('[data-terms-currency]').innerText()).includes('SAR'))
  await giveReason(page, 'Renegotiated rate')
  check('6: Add waits for a date', await page.locator('[data-reason-confirm]').isDisabled())

  // 7 — inside a closed row: flagged, still sent, refused inline.
  await page.locator('[data-terms-valid-from]').fill('2026-08-15')
  await page.locator('[data-terms-conflict="inside"]').waitFor()
  check('7: a validFrom inside a row is flagged client-side', /2026-08-15\s*falls inside the terms valid from\s*2026-07-01/.test(await page.locator('[data-terms-conflict]').innerText()))
  check('7: … as a hint: Add stays on', !(await page.locator('[data-reason-confirm]').isDisabled()))
  check('7: … and the note names no closing date for it', /close the day before the new row starts/.test(await page.locator('[data-terms-closes]').innerText()))
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-inline-refusal="DLV-00008"]').waitFor({ timeout: 10000 })
  check('7: DLV-00008 shows the server’s sentence inline at the date', (await page.locator('[data-terms-dialog] [data-inline-refusal="DLV-00008"]').innerText()).includes('overlaps existing terms for this platform. / تاريخ البدء يتداخل'))
  check('7: … not twice (no banner)', (await page.locator('[data-reason-error]').count()) === 0)
  check('7: the dialog stays open', (await dialog(page).count()) === 1)
  await page.screenshot({ path: `${SHOTS}/ltr-overlap.png` })
  await page.locator('[data-terms-valid-from]').fill('2026-11-01')
  check('7: the open row’s own first day is flagged too', /is the day the current terms start/.test(await page.locator('[data-terms-conflict="inside"]').innerText()))
  check('7: editing the date clears the refusal', (await page.locator('[data-inline-refusal]').count()) === 0)
  await page.locator('[data-terms-valid-from]').fill('2025-12-01')
  check('7: a date before every row is flagged', (await page.locator('[data-terms-conflict="before"]').count()) === 1)

  // 6 — a clean date.
  await page.locator('[data-terms-valid-from]').fill('2026-12-01')
  check('6: no hint for a date after the open row starts', (await page.locator('[data-terms-conflict]').count()) === 0)
  check(
    '6: the dialog says the current row (from 2026-11-01) closes on 2026-11-30',
    /valid from\s*2026-11-01\s*, close on\s*2026-11-30\s*, the day before the new row starts/.test(await page.locator('[data-terms-closes]').innerText()),
    await page.locator('[data-terms-closes]').innerText(),
  )
  await page.locator('[data-terms-field="customerDiscountPct"]').fill('8')
  await page.locator('[data-terms-field="deliveryFee"]').fill('1.2345')
  check('6: money takes at most 3 decimals', (await page.locator('[data-field-problem="deliveryFee"]').count()) === 1 && (await page.locator('[data-reason-confirm]').isDisabled()))
  await page.locator('[data-terms-field="deliveryFee"]').fill('12')
  await page.screenshot({ path: `${SHOTS}/ltr-add.png` })
  await page.locator('[data-reason-confirm]').click()
  await closed(page)
  const w = writes.at(-1)
  check(
    '6: the POST body is exactly the row without termsId / validTo, plus reason',
    w.door === 'terms' &&
      JSON.stringify(w.body) ===
        JSON.stringify({ platformKey: 'JAHEZ', validFrom: '2026-12-01', customerDiscountPct: 8, commissionPct: 2.5, deliveryFee: 12, deliveryFeeThreshold: 55, currencyKey: 'SAR', reason: 'Renegotiated rate' }),
    JSON.stringify(w.body),
  )
  await page.locator('[data-terms-row]').nth(3).waitFor({ timeout: 10000 })
  const ids = await termsIds(page)
  check('6: the timeline refreshes: the new row is current, the previous one closed the day before', ids.length === 4 && (await page.locator('[data-terms-row][data-current]').count()) === 1 &&
    (await page.locator('[data-terms-row][data-current] [data-cell="validFrom"]').innerText()) === '2026-12-01' && (await termsCell(page, '01JT3', 'validTo').innerText()) === '2026-11-30', ids.join())
  check('6–7: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  // The first terms of a platform.
  const { context, page, writes } = await open('ltr')
  await page.goto(`${BASE}/deliverect/terms?platform=MRSOOL`)
  await page.locator('[data-empty="timeline"]').waitFor({ timeout: 20000 })
  await page.locator('[data-terms-add]').click()
  await dialog(page).locator('[data-terms-dialog]').waitFor()
  check('6: a platform’s first terms say they stay open', (await page.locator('[data-terms-closes="first"]').count()) === 1)
  check('6: … the fields start empty, the currency SAR', (await page.locator('[data-terms-field="commissionPct"]').inputValue()) === '' && (await page.locator('[data-terms-currency]').innerText()).includes('SAR'))
  await page.locator('[data-terms-valid-from]').fill('2026-11-15')
  for (const [f, v] of [['customerDiscountPct', '5'], ['commissionPct', '101'], ['deliveryFee', '0'], ['deliveryFeeThreshold', '0']]) await page.locator(`[data-terms-field="${f}"]`).fill(v)
  check('6: a percentage is at most 100', (await page.locator('[data-field-problem="commissionPct"]').count()) === 1)
  await page.locator('[data-terms-field="commissionPct"]').fill('3')
  await giveReason(page, 'Mrsool contract')
  await page.locator('[data-reason-confirm]').click()
  await closed(page)
  check('6: the first row is sent', writes.at(-1).body.platformKey === 'MRSOOL' && writes.at(-1).body.validFrom === '2026-11-15' && writes.at(-1).body.commissionPct === 3)
  await context.close()
}

// ── 8: RTL ─────────────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, writes } = await open('rtl')
  await page.goto(`${BASE}/deliverect/terms`)
  await waitTerms(page, 'JAHEZ')
  check('8: dir is rtl', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  check('8: a date is an ltr isolate', (await termsCell(page, '01JT2', 'validFrom').locator('bdi[dir="ltr"]').innerText()) === '2026-07-01')
  check('8: money with its currency is ONE ltr isolate', (await termsCell(page, '01JT3', 'deliveryFee').locator('bdi[dir="ltr"]').allInnerTexts()).join('|') === '10.500 SAR')
  check('8: the platform key and credit customer are ltr isolates', (await platformCell(page, 'JAHEZ', 'platformKey').locator('bdi[dir="ltr"]').innerText()) === 'JAHEZ' && (await platformCell(page, 'JAHEZ', 'creditCustomer').locator('bdi[dir="ltr"]').innerText()) === '0001100001')
  check('8: the display name is free text (dir auto)', (await platformCell(page, 'KEETA', 'displayName').locator('bdi:not([dir])').innerText()) === 'كيتا Keeta')
  check('8: the copy renders (no raw keys)', !/\b(timeline|platforms|accounts|edit|add)\.[a-zA-Z]/.test(await page.locator('main').innerText()))
  await page.screenshot({ path: `${SHOTS}/rtl-page.png`, fullPage: true })
  await page.locator('[data-terms-add]').click()
  await dialog(page).locator('[data-terms-dialog]').waitFor()
  await page.locator('[data-terms-valid-from]').fill('2026-12-01')
  check('8: the close date is one ltr isolate each', (await page.locator('[data-terms-closes] bdi[dir="ltr"]').allInnerTexts()).join('|') === '2026-11-01|2026-11-30')
  for (const f of ['customerDiscountPct', 'deliveryFee']) check(`8: the ${f} box is ltr`, (await page.locator(`[data-terms-field="${f}"]`).getAttribute('dir')) === 'ltr')
  await giveReason(page, 'سعر جديد')
  await page.screenshot({ path: `${SHOTS}/rtl-add.png` })
  await page.locator('[data-reason-confirm]').click()
  await closed(page)
  check('8: add terms works under RTL', writes.at(-1)?.body?.reason === 'سعر جديد' && writes.at(-1).body.validFrom === '2026-12-01')
  check('8: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
