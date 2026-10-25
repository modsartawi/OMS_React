// Serving list add-stores drive (ticket 569, BackOffice spec 3042) — drives the REAL serving-list detail page's
// "Add stores" dialog in Chromium against STUBBED `ServingListWeb/*` envelopes, shaped from BackOffice
// `ServingListAdminModels.cs` (pricing2). 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 3045 is not
// deployed. Never point this at a real host.
//
// The stubbed add door behaves as 3045 does: it trims and de-dups case-insensitively, refuses unknown codes first
// (`SVL-00002`, `data.badStoreCodes` in the request's spelling), and only then members (`SVL-00003`).
//
// It verifies, in LTR and RTL:
//   1. "Add stores" shows for an Execute holder; the dialog opens with an empty basket and a disabled confirm;
//   2. a blank search answers the door's first page (50) and says to narrow it; a store on the list is checked off
//      and cannot be picked;
//   3. search by name, by city (a closed store is marked and can be picked), by code; the door gets
//      `search` + `servingListId`; "Pick all shown"; picking again takes a store back out;
//   4. pasting a column of codes: de-duplicated case-insensitively against the basket, the counts said;
//   5. Escape clears the search without closing the dialog;
//   6. confirm → SVL-00002 marks exactly the unknown code; "Remove these and retry" → SVL-00003 marks exactly the
//      member; "Remove these and retry" → added in one call with the note; the dialog closes, a toast, and the
//      Members and Lists reads are re-read;
//   7. Clear empties the basket; no raw keys; codes are ltr isolates; no page errors;
//   8. without Execute (canEditServingLists false) there is no "Add stores".
//
//   1. run the app:  npx vite --port 5212 --strictPort
//   2. DRIVE_PORT=5212 node tools/serving-list-add-stores-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5212}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

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

const A = '01JB8Z3K4M5N6P7Q8R9S0T1V2W'
const LIST = {
  servingListId: A,
  nameEn: 'Riyadh north',
  nameAr: 'شمال الرياض',
  isActive: true,
  memberCount: 2,
  enabledMemberCount: 2,
  pointingTypes: [{ documentType: 'QC', description: 'Quick commerce', isCompeted: true }],
  createdAt: '2026-10-20T09:00:00',
  createdBy: 'msartawi',
  updatedAt: '2026-10-24T14:30:00',
  updatedBy: 'amal',
  warning: null,
}
const member = (storeCode, storeName, city) => ({
  storeCode,
  storeName,
  city,
  storeClosed: false,
  isEnabled: true,
  addedAt: '2026-10-21T10:00:00',
  addedBy: 'msartawi',
  updatedAt: '2026-10-23T11:15:00',
  updatedBy: 'amal',
  duty: 'OnDuty',
  onDutyNow: true,
  todayShifts: [{ open: '09:00', close: '17:00', overnight: false }],
})
const MEMBER_CODES = ['1001', '1002']

const store = (storeCode, name, city, closed = false) => ({ storeCode, name, city, closed })
// The store master, by code: four named stores and sixty in Abha (so a blank search fills the door's 50).
const STORES = [
  store('1001', 'Olaya', 'Riyadh'),
  store('1002', 'Malqa', 'Riyadh'),
  store('1003', 'Tahlia', 'Jeddah'),
  store('1009', 'Faisaliah', 'Dammam', true),
  ...Array.from({ length: 60 }, (_, i) => store(String(2001 + i), `Abha branch ${i + 1}`, 'Abha')),
]

/** `GET ServingListWeb/Stores`: inside the code, name or city, case-insensitively; `take` 50 by default. */
function storesAnswer(qs) {
  const s = (qs.get('search') ?? '').trim().toLowerCase()
  const take = Math.min(Math.max(Number(qs.get('take') ?? 50) || 50, 1), 200)
  const marks = qs.get('servingListId') === A
  return STORES.filter((r) => !s || r.storeCode.toLowerCase().includes(s) || r.name.toLowerCase().includes(s) || r.city.toLowerCase().includes(s))
    .slice(0, take)
    .map((r) => ({ ...r, onList: marks && MEMBER_CODES.includes(r.storeCode) }))
}

/** `POST ServingListWeb/Lists/{id}/Stores`, as 3045: trim, de-dup (first spelling), unknown first, then members. */
function addAnswer(body) {
  const seen = new Set()
  const codes = (body.storeCodes ?? [])
    .map((c) => String(c).trim())
    .filter((c) => c && !seen.has(c.toUpperCase()) && seen.add(c.toUpperCase()))
  if (codes.length === 0) return envelope(null, { status: 400, success: false, message: 'Name at least one store to add. / …', errorCode: 'SVL-00008' })
  const unknown = codes.filter((c) => !STORES.some((s) => s.storeCode.toUpperCase() === c.toUpperCase()))
  if (unknown.length)
    return envelope({ badStoreCodes: unknown }, { status: 400, success: false, message: `No such store: ${unknown.join(', ')}. Nothing was added. / لا يوجد فرع: ${unknown.join(', ')}.`, errorCode: 'SVL-00002' })
  const already = codes.filter((c) => MEMBER_CODES.includes(c.toUpperCase()))
  if (already.length)
    return envelope({ badStoreCodes: already }, { status: 400, success: false, message: `Already on serving list ${A}: ${already.join(', ')}. Nothing was added. / …`, errorCode: 'SVL-00003' })
  return envelope({ ...LIST, memberCount: 2 + codes.length, enabledMemberCount: 2 + codes.length })
}

const browser = await chromium.launch()

async function open(dir, { canEdit = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
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
    calls.push({ method: req.method(), p, qs: url.searchParams, body: req.postData() })
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'ServingListWeb/Access') return route.fulfill(envelope({ canViewServingLists: true, canEditServingLists: canEdit }))
    if (p === 'ServingListWeb/Lists') return route.fulfill(envelope([LIST]))
    if (p === 'ServingListWeb/Stores') return route.fulfill(envelope(storesAnswer(url.searchParams)))
    if (p === `ServingListWeb/Lists/${A}/Members`) return route.fulfill(envelope(MEMBER_CODES.map((c) => member(c, c === '1001' ? 'Olaya' : 'Malqa', 'Riyadh'))))
    if (p === `ServingListWeb/Lists/${A}/Stores` && req.method() === 'POST') return route.fulfill(addAnswer(JSON.parse(req.postData() ?? '{}')))
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const count = (calls, p, method = 'GET') => calls.filter((c) => c.p === p && c.method === method).length
const basket = (page) =>
  page.locator('[data-add-stores-basket] [data-basket-code]').evaluateAll((els) => els.map((e) => e.getAttribute('data-basket-code')))
const bad = (page) => page.locator('[data-basket-bad]').evaluateAll((els) => els.map((e) => e.getAttribute('data-basket-code')))
const hits = (page) => page.locator('[data-add-stores-hits] [data-hit]').evaluateAll((els) => els.map((e) => e.getAttribute('data-hit')))
const searchFor = async (page, calls, text, firstHit) => {
  await page.locator('[data-add-stores-find]').fill(text)
  await page.waitForFunction(
    ([want]) => document.querySelector('[data-add-stores-hits] [data-hit]')?.getAttribute('data-hit') === want,
    [firstHit],
    { timeout: 8000 },
  ).catch(() => {})
  return calls.filter((c) => c.p === 'ServingListWeb/Stores').at(-1)?.qs
}
const posts = (calls) => calls.filter((c) => c.p === `ServingListWeb/Lists/${A}/Stores` && c.method === 'POST').map((c) => JSON.parse(c.body))

for (const dir of ['ltr', 'rtl']) {
  const { context, page, errors, calls } = await open(dir)
  await page.goto(`${BASE}/oms/serving-lists/${A}`)
  await page.locator('[data-members-grid] [data-duty]').first().waitFor({ timeout: 20000 })
  check(`${dir} dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)

  // 1. the button and an empty dialog
  const button = page.locator('[data-members-toolbar] [data-add-stores]')
  check(`${dir} 1. "Add stores" shows for an Execute holder`, (await button.count()) === 1 && strip(await button.innerText()) === 'Add stores')
  await button.click()
  const dialog = page.locator('[data-add-stores-dialog]')
  await dialog.waitFor({ timeout: 8000 })
  check(`${dir} 1. the dialog is titled with the list's name`, (await page.locator('dialog[open]').innerText()).replace(/[\u2066-\u2069]/g, '').includes('Add stores to Riyadh north'))
  check(`${dir} 1. the basket starts empty`, (await page.locator('[data-basket-empty]').count()) === 1 && (await page.locator('[data-basket-count="0"]').count()) === 1)
  check(`${dir} 1. confirm is disabled on an empty basket (SVL-00008 blocked client-side)`, await page.locator('[data-add-stores-confirm]').isDisabled())

  // 2. a blank search: the door's first page, and the store on the list checked off
  await page.locator('[data-add-stores-hits] [data-hit]').first().waitFor({ timeout: 8000 })
  const first = calls.find((c) => c.p === 'ServingListWeb/Stores')?.qs
  check(`${dir} 2. the search names the list and takes 50`, first?.get('servingListId') === A && first?.get('take') === '50' && !first?.has('search'), first?.toString())
  check(`${dir} 2. a blank search shows the first 50 and says to narrow it`, (await hits(page)).length === 50 && (await page.locator('[data-add-stores-more]').count()) === 1)
  const onList = page.locator('[data-hit="1001"]')
  check(`${dir} 2. a store on the list is checked off and cannot be picked`, (await onList.getAttribute('data-on-list')) === '' && (await onList.isDisabled()) && (await onList.getAttribute('aria-checked')) === 'true' && strip(await onList.innerText()).includes('On the list'))

  // 3. by name, by city (closed), by code
  let qs = await searchFor(page, calls, 'tahl', '1003')
  check(`${dir} 3. the door gets search + servingListId`, qs?.get('search') === 'tahl' && qs?.get('servingListId') === A, qs?.toString())
  check(`${dir} 3. by name finds Tahlia`, JSON.stringify(await hits(page)) === '["1003"]', JSON.stringify(await hits(page)))
  await page.locator('[data-hit="1003"]').click()
  check(`${dir} 3. a pick goes into the basket and reads picked`, JSON.stringify(await basket(page)) === '["1003"]' && (await page.locator('[data-hit="1003"]').getAttribute('aria-checked')) === 'true')

  await searchFor(page, calls, 'dammam', '1009')
  const closed = page.locator('[data-hit="1009"]')
  check(`${dir} 3. by city finds the closed store, marked and pickable`, JSON.stringify(await hits(page)) === '["1009"]' && (await closed.getAttribute('data-closed')) === '' && !(await closed.isDisabled()) && (await closed.locator('[data-hit-closed]').getAttribute('title'))?.includes('never bid'))
  await closed.click()
  check(`${dir} 3. the closed store keeps its mark in the basket`, (await page.locator('[data-basket-code="1009"][data-basket-closed]').count()) === 1)

  await searchFor(page, calls, '200', '2001')
  check(`${dir} 3. by code finds 2001-2009`, (await hits(page)).length === 9, JSON.stringify(await hits(page)))
  await page.locator('[data-hit="2005"]').click()
  await page.locator('[data-add-stores-pick-all]').click()
  check(
    `${dir} 3. "Pick all shown" adds the rest, keeping the order`,
    JSON.stringify(await basket(page)) === JSON.stringify(['1003', '1009', '2005', '2001', '2002', '2003', '2004', '2006', '2007', '2008', '2009']),
    JSON.stringify(await basket(page)),
  )
  check(`${dir} 3. nothing left to pick disables "Pick all shown"`, await page.locator('[data-add-stores-pick-all]').isDisabled())
  await page.locator('[data-hit="2009"]').click()
  check(`${dir} 3. picking again takes it out`, !(await basket(page)).includes('2009') && (await basket(page)).length === 10)

  // 5. Escape clears the search only
  await page.locator('[data-add-stores-find]').press('Escape')
  check(`${dir} 5. Escape clears the search and the dialog stays open`, (await page.locator('[data-add-stores-find]').inputValue()) === '' && (await dialog.isVisible()))

  // 4. paste
  await page.locator('[data-add-stores-paste-text]').fill('2001\nZZ9, zz9 1001\r\n2030\n')
  await page.locator('[data-add-stores-paste-add]').click()
  check(`${dir} 4. pasted codes join the basket, de-duplicated`, JSON.stringify((await basket(page)).slice(-3)) === '["ZZ9","1001","2030"]' && (await basket(page)).length === 13, JSON.stringify(await basket(page)))
  check(`${dir} 4. the counts are said (3 added, 1 already in it)`, (await page.locator('[data-add-stores-paste-result="3/1"]').count()) === 1 && strip(await page.locator('[data-add-stores-paste-result]').innerText()) === 'Added to the basket: 3. Already in it: 1.')
  check(`${dir} 4. the basket count`, strip(await page.locator('[data-basket-count]').innerText()) === '13 stores in the basket')
  check(`${dir} 4. the paste box empties`, (await page.locator('[data-add-stores-paste-text]').inputValue()) === '')

  // 6. round 1: SVL-00002
  await page.locator('[data-add-stores-note]').fill('  contract 7  ')
  await page.locator('[data-add-stores-confirm]').click()
  await page.locator('[data-add-stores-refusal]').waitFor({ timeout: 8000 })
  check(`${dir} 6. SVL-00002 stays in the dialog`, (await dialog.isVisible()) && (await page.locator('[data-add-stores-refusal="SVL-00002"]').count()) === 1)
  check(`${dir} 6. exactly the unknown code is marked in the basket`, JSON.stringify(await bad(page)) === '["ZZ9"]', JSON.stringify(await bad(page)))
  check(`${dir} 6. the screen's words and the server's text`, strip(await page.locator('[data-add-stores-refusal-label]').innerText()) === 'These codes are not stores:' && (await page.locator('dialog[open] [role="alert"]').innerText()).includes('No such store: ZZ9'))
  check(`${dir} 6. the whole basket was sent once`, posts(calls).length === 1 && posts(calls)[0].storeCodes.length === 13 && posts(calls)[0].note === 'contract 7', JSON.stringify(posts(calls)))

  // round 2: remove and retry → SVL-00003
  await page.locator('[data-add-stores-remove-retry]').click()
  await page.locator('[data-add-stores-refusal="SVL-00003"]').waitFor({ timeout: 8000 })
  check(`${dir} 6. remove-and-retry drops the unknown code and sends again`, posts(calls).length === 2 && !posts(calls)[1].storeCodes.includes('ZZ9') && posts(calls)[1].storeCodes.length === 12)
  check(`${dir} 6. SVL-00003 marks exactly the member`, JSON.stringify(await bad(page)) === '["1001"]' && strip(await page.locator('[data-add-stores-refusal-label]').innerText()) === 'These stores are already on the list:', JSON.stringify(await bad(page)))

  // round 3: added
  const membersBefore = count(calls, `ServingListWeb/Lists/${A}/Members`)
  const listsBefore = count(calls, 'ServingListWeb/Lists')
  await page.locator('[data-add-stores-remove-retry]').click()
  await dialog.waitFor({ state: 'detached', timeout: 8000 })
  const last = posts(calls).at(-1)
  check(`${dir} 6. added in one call with the note`, posts(calls).length === 3 && last.storeCodes.length === 11 && !last.storeCodes.includes('1001') && last.note === 'contract 7', JSON.stringify(last))
  await page.locator('[data-sonner-toast]').first().waitFor({ timeout: 5000 }).catch(() => {})
  check(`${dir} 6. a toast names the count and the list`, (await page.locator('[data-sonner-toast]').allInnerTexts()).some((x) => strip(x).includes('Added 11 stores to Riyadh north.')))
  await page.waitForTimeout(400)
  check(`${dir} 6. Members and Lists are re-read`, count(calls, `ServingListWeb/Lists/${A}/Members`) > membersBefore && count(calls, 'ServingListWeb/Lists') > listsBefore)

  // 7. reopen: empty again; Clear; raw keys; isolates
  await button.click()
  await dialog.waitFor({ timeout: 8000 })
  check(`${dir} 7. reopening starts with an empty basket`, (await page.locator('[data-basket-count="0"]').count()) === 1)
  await page.locator('[data-add-stores-paste-text]').fill('2040 2041')
  await page.locator('[data-add-stores-paste-add]').click()
  await page.locator('[data-basket-remove="2041"]').click()
  check(`${dir} 7. a chip's remove takes it out`, JSON.stringify(await basket(page)) === '["2040"]' && strip(await page.locator('[data-basket-count]').innerText()) === '1 store in the basket')
  await page.locator('[data-basket-clear]').click()
  check(`${dir} 7. Clear empties the basket`, (await page.locator('[data-basket-count="0"]').count()) === 1)
  await page.locator('[data-add-stores-hits] [data-hit]').first().waitFor({ timeout: 8000 })
  check(`${dir} 7. codes are ltr isolates`, (await page.locator('[data-hit="1003"] bdi[dir="ltr"]').count()) === 1)
  const text = await page.locator('dialog[open]').innerText()
  check(`${dir} 7. no raw keys in the dialog`, !/addStores\.|serving-lists:/.test(text), text.match(/addStores\.[\w.]+/)?.[0])
  await page.locator('[data-add-stores-cancel]').click()
  check(`${dir} 7. Cancel closes the dialog`, (await dialog.count()) === 0)
  check(`${dir} no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()

  // 8. without Execute
  {
    const { context, page, errors } = await open(dir, { canEdit: false })
    await page.goto(`${BASE}/oms/serving-lists/${A}`)
    await page.locator('[data-members-grid] [data-duty]').first().waitFor({ timeout: 20000 })
    check(`${dir} 8. without Execute there is no "Add stores"`, (await page.locator('[data-add-stores]').count()) === 0 && (await page.locator('[data-add-stores-dialog]').count()) === 0)
    check(`${dir} 8. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
