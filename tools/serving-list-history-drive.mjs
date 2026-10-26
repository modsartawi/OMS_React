// Serving list history drive (ticket 571, BackOffice spec 3042) — drives the REAL serving-list detail page's
// History tab in Chromium against STUBBED `ServingListWeb/*` envelopes, shaped from BackOffice
// `ServingListAdminModels.cs` (pricing2). 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 3045 is
// not deployed. Never point this at a real host.
//
// It verifies, in LTR and RTL:
//   1. `?tab=history` opens the tab and reads `Changes?take=200`; the rows come newest first;
//   2. every action in words, an unlisted action raw; a list-level action has no store;
//   3. a create's names, a rename's before → after, each name its own isolate; an Arabic note isolated;
//      when is one ltr isolate;
//   4. the store filter finds one store's add and its removal (exact, case-insensitive), the action filter
//      narrows it, and Clear restores every row;
//   5. "Show more" asks for `take=400`, and disappears when the door does not fill the page;
//   6. the export writes a workbook named serving-list-history-*.xlsx;
//   7. an unknown id (SVL-00001) reads "This serving list does not exist"; a bare 403 reads "You do not have access";
//   8. no raw keys; no page errors.
//
//   1. run the app:  npx vite --port 5211 --strictPort
//   2. DRIVE_PORT=5211 node tools/serving-list-history-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5211}`

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
const NOPE = '01JB8ZZZZZZZZZZZZZZZZZZZZZ'
const DENIED = '01JB8ZDENIEDDENIEDDENIED00'
const LISTS = [
  {
    servingListId: A,
    nameEn: 'Riyadh N',
    nameAr: 'الرياض ش',
    isActive: true,
    memberCount: 3,
    enabledMemberCount: 2,
    pointingTypes: [{ documentType: 'QC', description: 'Quick commerce', isCompeted: true }],
    createdAt: '2026-10-01T09:00:00',
    createdBy: 'msartawi',
    updatedAt: '2026-10-24T14:30:00',
    updatedBy: 'amal',
    warning: null,
  },
]

const change = (changeId, action, changedAt, over = {}) => ({
  changeId,
  servingListId: A,
  action,
  storeCode: '',
  changedAt,
  changedBy: 'amal',
  note: '',
  oldNameEn: '',
  oldNameAr: '',
  newNameEn: '',
  newNameAr: '',
  ...over,
})
const ARABIC_NOTE = 'أُزيل بطلب من مدير المنطقة'
// Newest first, as the door answers: every action, an unlisted one, an Arabic note, P019 added then removed,
// and a P0190 the exact store match must not catch.
const HEAD = [
  change('c12', 'MergeLists', '2026-10-24T16:00:00', { changedBy: 'hq-script' }),
  change('c11', 'RemoveStore', '2026-10-24T14:30:00', { storeCode: 'P019', note: ARABIC_NOTE }),
  change('c10', 'Reactivate', '2026-10-23T09:00:00', { changedBy: 'msartawi' }),
  change('c09', 'Deactivate', '2026-10-22T18:00:00', { changedBy: 'msartawi', note: 'Pilot paused' }),
  change('c08', 'DisableStore', '2026-10-21T12:00:00', { storeCode: 'P001' }),
  change('c07', 'EnableStore', '2026-10-20T12:00:00', { storeCode: 'P001' }),
  change('c06', 'AddStore', '2026-10-05T10:00:00', { storeCode: 'P0190' }),
  change('c05', 'AddStore', '2026-10-05T10:00:00', { storeCode: 'P019' }),
  change('c04', 'AddStore', '2026-10-05T10:00:00', { storeCode: 'P001' }),
  change('c03', 'Rename', '2026-10-02T08:00:00', {
    oldNameEn: 'Riyadh north',
    oldNameAr: 'شمال الرياض',
    newNameEn: 'Riyadh N',
    newNameAr: 'الرياض ش',
  }),
]
const TAIL = [change('c01', 'Create', '2026-10-01T09:00:00', { changedBy: 'msartawi', newNameEn: 'Riyadh north', newNameAr: 'شمال الرياض' })]
// 260 rows in all: the first page of 200 is full (Show more), the second read of 400 is not.
const FILLER = Array.from({ length: 249 }, (_, i) =>
  change(`f${String(i).padStart(3, '0')}`, i % 2 ? 'EnableStore' : 'DisableStore', '2026-10-01T12:00:00', { storeCode: 'P100' }),
)
const CHANGES = [...HEAD, ...FILLER, ...TAIL]

const browser = await chromium.launch()

async function open(dir) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 }, acceptDownloads: true })
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
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'ServingListWeb/Access') return route.fulfill(envelope({ canViewServingLists: true, canEditServingLists: false }))
    if (p === 'ServingListWeb/Lists') return route.fulfill(envelope(LISTS))
    let m
    if ((m = p.match(/^ServingListWeb\/Lists\/([^/]+)\/Changes$/))) {
      const id = decodeURIComponent(m[1])
      calls.push({ id, qs: url.searchParams.toString() })
      if (id === NOPE)
        return route.fulfill(envelope(null, { status: 400, success: false, message: `Serving list ${id} does not exist. / قائمة الخدمة ${id} غير موجودة.`, errorCode: 'SVL-00001' }))
      if (id === DENIED) return route.fulfill({ status: 403, body: '' })
      // The door's own clamp: take defaults to 200, 1..1000.
      const take = Math.min(1000, Math.max(1, Number(url.searchParams.get('take') ?? 200) || 200))
      return route.fulfill(envelope(CHANGES.slice(0, take)))
    }
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const grid = (page) => page.locator('[data-history-grid]')
// AG Grid renders a pinned/centre split; take the centre row (it has the names column).
const rowOf = (page, id) => page.locator(`[data-history-grid] .ag-row[row-id="${id}"]:has([col-id="names"])`)
const cell = (page, id, col) => rowOf(page, id).locator(`[col-id="${col}"]`)
const rowIds = (page) =>
  page
    .locator('[data-history-grid] .ag-row:has([col-id="names"])')
    .evaluateAll((els) => els.sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index'))).map((e) => e.getAttribute('row-id')))
const settle = async (page, want) => {
  await page
    .waitForFunction(
      (w) => {
        const ids = [...document.querySelectorAll('[data-history-grid] .ag-row:has([col-id="names"])')]
          .sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index')))
          .map((e) => e.getAttribute('row-id'))
        return JSON.stringify(ids.slice(0, w.length)) === JSON.stringify(w) && (w.length >= 50 || ids.length === w.length)
      },
      want,
      { timeout: 8000 },
    )
    .catch(() => {})
}

for (const dir of ['ltr', 'rtl']) {
  {
    const { context, page, errors, calls } = await open(dir)
    await page.goto(`${BASE}/oms/serving-lists/${A}?tab=history`)
    await grid(page).locator('.ag-row').first().waitFor({ timeout: 20000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)

    // 1. the tab and the first read
    check(`${dir} 1. History is the open tab`, (await page.locator('[role="tab"][data-tab="history"]').getAttribute('aria-selected')) === 'true')
    check(`${dir} 1. the first read asks take=200`, calls.length >= 1 && calls[0].id === A && calls[0].qs === 'take=200', JSON.stringify(calls))
    check(`${dir} 1. the count reads 200 changes, newest first`, strip(await page.locator('[data-history-count]').innerText()) === '200 changes, newest first')
    if (dir === 'rtl') check('rtl 1. the count is an ltr isolate', (await page.locator('[data-history-count] bdi[dir="ltr"]').innerText()) === '200')
    const first = (await rowIds(page)).slice(0, HEAD.length)
    check(`${dir} 1. rows newest first, as the door sent them`, JSON.stringify(first) === JSON.stringify(HEAD.map((c) => c.changeId)), JSON.stringify(first))

    // 2. actions in words; store blank on list-level rows
    const action = async (id) => strip(await cell(page, id, 'action').innerText())
    const actions = await Promise.all(HEAD.map((c) => action(c.changeId)))
    check(
      `${dir} 2. every action in words, an unlisted one raw`,
      JSON.stringify(actions) ===
        JSON.stringify(['MergeLists', 'Store removed', 'Reactivated', 'Deactivated', 'Store disabled', 'Store enabled', 'Store added', 'Store added', 'Store added', 'Renamed']),
      JSON.stringify(actions),
    )
    const store = async (id) => strip(await cell(page, id, 'storeCode').innerText())
    check(`${dir} 2. a list-level row has no store`, (await store('c10')) === '' && (await store('c09')) === '' && (await store('c03')) === '')
    check(`${dir} 2. a store row shows its code, one ltr isolate`, (await cell(page, 'c11', 'storeCode').locator('bdi[dir="ltr"]').innerText()) === 'P019')

    // 3. names, note, when
    const renameText = strip(await cell(page, 'c03', 'names').innerText())
    check(`${dir} 3. a rename reads before → after`, renameText === 'From Riyadh north (شمال الرياض) to Riyadh N (الرياض ش)', renameText)
    check(`${dir} 3. each name is its own isolate`, (await cell(page, 'c03', 'names').locator('bdi').count()) === 4)
    check(`${dir} 3. a store row has no names`, strip(await cell(page, 'c11', 'names').innerText()) === '')
    check(`${dir} 3. the Arabic note, isolated`, strip(await cell(page, 'c11', 'note').innerText()) === ARABIC_NOTE && (await cell(page, 'c11', 'note').locator('bdi').count()) >= 1)
    check(`${dir} 3. when is one ltr isolate`, (await cell(page, 'c11', 'changedAt').locator('bdi[dir="ltr"]').innerText()) === '2026-10-24 14:30')

    // 4. filters
    await page.locator('[data-filter="store"]').fill(' p019 ')
    await settle(page, ['c11', 'c05'])
    check(`${dir} 4. the store filter finds P019's add and removal (not P0190)`, JSON.stringify(await rowIds(page)) === JSON.stringify(['c11', 'c05']), JSON.stringify(await rowIds(page)))
    check(`${dir} 4. the count reads 2 of 200 match`, strip(await page.locator('[data-history-count]').innerText()) === '2 of 200 changes match')
    check(`${dir} 4. filtering asks the door nothing`, calls.length === 1, JSON.stringify(calls))
    await page.locator('[data-filter="action"]').selectOption('RemoveStore')
    await settle(page, ['c11'])
    check(`${dir} 4. action + store combine: who took P019 off, and when`, JSON.stringify(await rowIds(page)) === JSON.stringify(['c11']) && strip(await cell(page, 'c11', 'changedBy').innerText()) === 'amal')
    const opts = await page.locator('[data-filter="action"] option').evaluateAll((els) => els.map((e) => e.value))
    check(`${dir} 4. the action filter offers the eight actions and the unlisted one`, opts.length === 10 && opts.at(-1) === 'MergeLists', JSON.stringify(opts))
    await page.locator('[data-filter="store"]').fill('NOSUCH')
    await page.locator('[data-history-empty="filtered"]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 4. no match reads its own sentence`, strip(await page.locator('[data-history-empty="filtered"]').innerText().catch(() => '')) === 'No change matches these filters.')
    await page.locator('[data-filter-clear]').click()
    await settle(page, HEAD.map((c) => c.changeId))
    check(`${dir} 4. Clear restores every row`, strip(await page.locator('[data-history-count]').innerText()) === '200 changes, newest first' && (await page.locator('[data-filter="store"]').inputValue()) === '')

    // 6. export (before Show more: the grid is full)
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }).catch(() => null), page.locator('[data-history-export]').click()])
    const fileName = download?.suggestedFilename() ?? '(none)'
    check(`${dir} 6. the export writes serving-list-history-*.xlsx`, /^serving-list-history-\d{8}-\d{4}\.xlsx$/.test(fileName), fileName)

    // 5. show more
    check(`${dir} 5. Show more is offered on a full page`, (await page.locator('[data-history-more]').count()) === 1)
    await page.locator('[data-history-more]').click()
    await page.waitForFunction(() => document.querySelector('[data-history-count]')?.getAttribute('data-history-total') === '260', null, { timeout: 8000 }).catch(() => {})
    check(`${dir} 5. Show more asks take=400`, calls.at(-1)?.qs === 'take=400', JSON.stringify(calls))
    check(`${dir} 5. the larger read shows every row`, strip(await page.locator('[data-history-count]').innerText()) === '260 changes, newest first')
    check(`${dir} 5. Show more goes when the door does not fill the page`, (await page.locator('[data-history-more]').count()) === 0)

    // 8.
    const body = await page.locator('main').innerText()
    check(`${dir} 8. no raw keys`, !/\bhistory\.[a-z]/i.test(body) && !/serving-lists:/.test(body))
    check(`${dir} 8. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 7. unknown list and bare 403
  {
    const { context, page, errors } = await open(dir)
    await page.goto(`${BASE}/oms/serving-lists/${NOPE}?tab=history`)
    await page.locator('[data-list-not-found]').waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 7. an unknown id reads "does not exist"`, (await page.locator('[data-history-tab] [data-list-not-found]').count()) === 1 && (await grid(page).count()) === 0)
    await page.goto(`${BASE}/oms/serving-lists/${DENIED}?tab=history`)
    await page.locator('[data-history-denied]').waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 7. a bare 403 reads "You do not have access"`, strip(await page.locator('[data-history-denied]').innerText().catch(() => '')).startsWith('You do not have access'))
    check(`${dir} 7. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
