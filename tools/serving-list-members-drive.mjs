// Serving list members drive (ticket 568, BackOffice spec 3042) — drives the REAL serving-list detail page in
// Chromium against STUBBED `ServingListWeb/*` envelopes, shaped from BackOffice `ServingListAdminModels.cs`
// (pricing2). 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 3045 / 3046 are not deployed.
// Never point this at a real host.
//
// It verifies, in LTR and RTL:
//   1. the header: EN + AR names, Active, enabled / all members, the pointing-type chips; Members is the open tab;
//   2. the duty column: On duty now / Off duty now / Closed today / No roster (a warning) / an unknown state raw;
//      one shift, two shifts, an overnight shift marked next morning, each range one ltr isolate;
//   3. a closed store, a disabled member, added / updated at · by;
//   4. the filters: city, enabled and duty go to the URL and to the door, combine, and Clear empties both;
//   5. an unlisted duty / enabled in the URL is never sent (SVL-00009) and reads as Any;
//   6. a deep link with filters reads them into the bar and the door;
//   7. a deactivated list says its deliveries are not competed, and still lists its members;
//   8. an unknown id (SVL-00001) reads "This serving list does not exist" in place of the grid;
//   9. the History tab is held in the URL (571's tab), and Members writes no tab key;
//  10. the back link; no raw keys; no page errors.
//
//   1. run the app:  npx vite --port 5208 --strictPort
//   2. DRIVE_PORT=5208 node tools/serving-list-members-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5208}`

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

const list = (id, nameEn, nameAr, over = {}) => ({
  servingListId: id,
  nameEn,
  nameAr,
  isActive: true,
  memberCount: 8,
  enabledMemberCount: 7,
  pointingTypes: [],
  createdAt: '2026-10-20T09:00:00',
  createdBy: 'msartawi',
  updatedAt: '2026-10-24T14:30:00',
  updatedBy: 'amal',
  warning: null,
  ...over,
})
const QC = { documentType: 'QC', description: 'Quick commerce', isCompeted: true }
const HD = { documentType: 'HD', description: 'Home delivery', isCompeted: false }
const A = '01JB8Z3K4M5N6P7Q8R9S0T1V2W'
const D = '01JB8Z3K4M5N6P7Q8R9S0T1V2X'
const NOPE = '01JB8ZZZZZZZZZZZZZZZZZZZZZ'
/** A list whose Members door answers SVL-00009 whatever is asked (server and screen disagreeing on duty states). */
const DUTY9 = '01JB8Z9999999999999999999D'
const LISTS = [
  list(D, 'Jeddah (old)', 'جدة (قديمة)', { isActive: false, memberCount: 1, enabledMemberCount: 1, pointingTypes: [HD] }),
  list(A, 'Riyadh north', 'شمال الرياض', { pointingTypes: [QC, HD] }),
]

const shift = (open, close, overnight = false) => ({ open, close, overnight })
const member = (storeCode, storeName, city, duty, todayShifts, over = {}) => ({
  storeCode,
  storeName,
  city,
  storeClosed: false,
  isEnabled: true,
  addedAt: '2026-10-21T10:00:00',
  addedBy: 'msartawi',
  updatedAt: '2026-10-23T11:15:00',
  updatedBy: 'amal',
  duty,
  onDutyNow: duty === 'OnDuty',
  todayShifts,
  ...over,
})
// By store code, as the door answers.
const MEMBERS = [
  member('1001', 'Olaya', 'Riyadh', 'OnDuty', [shift('09:00', '17:00')]),
  member('1002', 'Malqa', 'Riyadh', 'OnDuty', [shift('08:00', '12:00'), shift('16:00', '22:00')]),
  member('1003', 'Tahlia', 'Jeddah', 'OnDuty', [shift('18:00', '02:00', true)]),
  member('1004', 'Rawdah', 'Jeddah', 'OffDuty', [shift('16:00', '23:00')]),
  member('1005', 'Corniche', 'Dammam', 'OffDuty', []),
  member('1006', 'Faisaliah', 'Dammam', 'NoRoster', [], { storeClosed: true }),
  member('1007', 'Sahafa', 'Riyadh', 'NoRoster', [], { isEnabled: false }),
  member('1008', 'Nakheel', 'Riyadh', 'OnBreak', [shift('10:00', '12:00')]),
]
const DUTY_STATES = ['onduty', 'offduty', 'noroster']

/** The door's own filtering: city trimmed + case-insensitive, enabled true/false, duty case-insensitive. */
function membersAnswer(qs) {
  const city = (qs.get('city') ?? '').trim().toLowerCase()
  const enabled = qs.get('enabled')
  const duty = (qs.get('duty') ?? '').trim().toLowerCase()
  if (duty && !DUTY_STATES.includes(duty)) return null
  return MEMBERS.filter(
    (m) => (!city || m.city.toLowerCase() === city) && (enabled == null || String(m.isEnabled) === enabled) && (!duty || m.duty.toLowerCase() === duty),
  )
}

const browser = await chromium.launch()

async function open(dir, { listsFail = false } = {}) {
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
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'ServingListWeb/Access') return route.fulfill(envelope({ canViewServingLists: true, canEditServingLists: true }))
    if (p === 'ServingListWeb/Lists') {
      if (listsFail) return route.fulfill(envelope(null, { status: 500, success: false, message: '' }))
      return route.fulfill(envelope(LISTS))
    }
    let m
    if ((m = p.match(/^ServingListWeb\/Lists\/([^/]+)\/Members$/))) {
      const id = decodeURIComponent(m[1])
      calls.push({ id, qs: url.searchParams.toString() })
      if (id === NOPE)
        return route.fulfill(envelope(null, { status: 400, success: false, message: `Serving list ${id} does not exist. / قائمة الخدمة ${id} غير موجودة.`, errorCode: 'SVL-00001' }))
      if (id === D) return route.fulfill(envelope([MEMBERS[0]]))
      if (id === DUTY9) return route.fulfill(envelope(null, { status: 400, success: false, message: 'Unknown duty filter. / مرشّح غير معروف.', errorCode: 'SVL-00009' }))
      const rows = membersAnswer(url.searchParams)
      if (!rows) return route.fulfill(envelope(null, { status: 400, success: false, message: 'Unknown duty filter', errorCode: 'SVL-00009' }))
      return route.fulfill(envelope(rows))
    }
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const grid = (page) => page.locator('[data-members-grid]')
const rowOf = (page, code) => page.locator(`[data-members-grid] .ag-row[row-id="${code}"]:has([col-id="duty"])`)
const rowIds = (page) =>
  page
    .locator('[data-members-grid] .ag-row:has([col-id="duty"])')
    .evaluateAll((els) => els.sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index'))).map((e) => e.getAttribute('row-id')))
const lastCall = (calls) => calls.at(-1)?.qs ?? '(none)'
const settle = async (page, codes) => {
  await page
    .waitForFunction(
      (want) => {
        const ids = [...document.querySelectorAll('[data-members-grid] .ag-row:has([col-id="duty"])')]
          .sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index')))
          .map((e) => e.getAttribute('row-id'))
        return JSON.stringify(ids) === JSON.stringify(want)
      },
      codes,
      { timeout: 8000 },
    )
    .catch(() => {})
}
const ALL = MEMBERS.map((m) => m.storeCode)

for (const dir of ['ltr', 'rtl']) {
  {
    const { context, page, errors, calls } = await open(dir)
    await page.goto(`${BASE}/oms/serving-lists/${A}`)
    await grid(page).locator('[data-duty]').first().waitFor({ timeout: 20000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)

    // 1. header
    const h = page.locator('[data-list-header]')
    check(`${dir} 1. the header names (EN + AR)`, strip(await h.locator('[data-name-en]').innerText()) === 'Riyadh north' && strip(await h.locator('[data-name-ar]').innerText()) === 'شمال الرياض')
    check(`${dir} 1. the header status reads Active`, (await h.locator('[data-status]').getAttribute('data-status')) === 'active' && strip(await h.locator('[data-status]').innerText()) === 'Active')
    check(`${dir} 1. enabled / all members, one ltr isolate`, (await h.locator('[data-header-members] bdi[dir="ltr"]').innerText()) === '7 / 8')
    const chips = await h.locator('[data-chip]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-chip')}:${e.getAttribute('data-competed')}`))
    check(`${dir} 1. the pointing-type chips`, JSON.stringify(chips) === JSON.stringify(['QC:true', 'HD:false']), JSON.stringify(chips))
    check(`${dir} 1. Members is the open tab`, (await page.locator('[role="tab"][data-tab="members"]').getAttribute('aria-selected')) === 'true')
    check(`${dir} 1. the first read sends no filter`, calls.length >= 1 && calls[0].qs === '' && calls[0].id === A, JSON.stringify(calls))
    check(`${dir} 1. every member, by store code`, JSON.stringify(await rowIds(page)) === JSON.stringify(ALL), JSON.stringify(await rowIds(page)))
    check(`${dir} 1. the count reads 8 members`, strip(await page.locator('[data-members-count]').innerText()) === '8 members')
    check(`${dir} 1. the actions column (570, Execute held)`, (await grid(page).locator(`[col-id="actions"]`).count()) > 0)

    // 2. duty
    const duty = async (code) => {
      const c = rowOf(page, code).locator('[data-duty]')
      return `${await c.getAttribute('data-duty')}=${strip(await c.innerText())}`
    }
    const duties = await Promise.all(ALL.map(duty))
    check(
      `${dir} 2. each duty state's label and hours`,
      JSON.stringify(duties) ===
        JSON.stringify([
          'onDuty=On duty now 09:00–17:00',
          'onDuty=On duty now 08:00–12:00 16:00–22:00',
          'onDuty=On duty now 18:00–02:00 next morning',
          'offDuty=Off duty now 16:00–23:00',
          'closedToday=Closed today',
          'noRoster=No roster',
          'noRoster=No roster',
          'unknown=OnBreak 10:00–12:00',
        ]),
      JSON.stringify(duties),
    )
    check(`${dir} 2. each shift is one ltr isolate`, JSON.stringify(await rowOf(page, '1002').locator('[data-shift] bdi[dir="ltr"]').allInnerTexts()) === JSON.stringify(['08:00–12:00', '16:00–22:00']))
    check(`${dir} 2. the overnight shift is marked next morning`, (await rowOf(page, '1003').locator('[data-shift="overnight"] [data-next-morning]').count()) === 1 && (await rowOf(page, '1001').locator('[data-next-morning]').count()) === 0)
    const noRoster = rowOf(page, '1006').locator('[data-duty]')
    check(`${dir} 2. No roster is a warning, with the hint`, /bg-attention-050/.test((await noRoster.locator('span').first().getAttribute('class')) ?? '') && /never bids/.test((await noRoster.getAttribute('title')) ?? ''), (await noRoster.locator('span').first().getAttribute('class')) ?? '')

    // 3. closed, disabled, stamps
    check(`${dir} 3. a closed store reads Closed, an open one Open`, strip(await rowOf(page, '1006').locator('[data-store-closed="true"]').innerText()) === 'Closed' && strip(await rowOf(page, '1001').locator('[data-store-closed]').innerText()) === 'Open')
    check(`${dir} 3. a disabled member reads Disabled`, (await rowOf(page, '1007').locator('[data-enabled]').getAttribute('data-enabled')) === 'false' && strip(await rowOf(page, '1007').locator('[data-enabled]').innerText()) === 'Disabled')
    check(`${dir} 3. added at · by is one ltr isolate`, (await rowOf(page, '1001').locator('[data-stamp="added"] bdi[dir="ltr"]').innerText()) === '2026-10-21 10:00 · msartawi')
    check(`${dir} 3. updated at · by`, strip(await rowOf(page, '1001').locator('[data-stamp="updated"]').innerText()) === '2026-10-23 11:15 · amal')
    check(`${dir} 3. the store code is an ltr isolate`, (await page.locator(`[data-members-grid] .ag-row[row-id="1001"] [col-id="storeCode"] bdi[dir="ltr"]`).first().innerText()) === '1001')

    // 4. filters
    await page.locator('[data-filter="city"]').fill('riyadh')
    await page.locator('[data-filter-apply]').click()
    await settle(page, ['1001', '1002', '1007', '1008'])
    check(`${dir} 4. city goes to the URL`, new URL(page.url()).search === '?city=riyadh', page.url())
    check(`${dir} 4. city goes to the door`, lastCall(calls) === 'city=riyadh', lastCall(calls))
    check(`${dir} 4. city filters the members`, JSON.stringify(await rowIds(page)) === JSON.stringify(['1001', '1002', '1007', '1008']), JSON.stringify(await rowIds(page)))
    await page.locator('[data-filter="enabled"]').selectOption('disabled')
    await page.locator('[data-filter="duty"]').selectOption('NoRoster')
    await page.locator('[data-filter-apply]').click()
    await settle(page, ['1007'])
    check(`${dir} 4. all three combine in the URL`, new URL(page.url()).search === '?city=riyadh&enabled=disabled&duty=NoRoster', page.url())
    check(`${dir} 4. all three combine at the door`, lastCall(calls) === 'city=riyadh&enabled=false&duty=NoRoster', lastCall(calls))
    check(`${dir} 4. the combined filter finds the disabled no-roster store`, JSON.stringify(await rowIds(page)) === JSON.stringify(['1007']))
    await page.locator('[data-filter="city"]').fill('')
    await page.locator('[data-filter="enabled"]').selectOption('enabled')
    await page.locator('[data-filter-apply]').click()
    await settle(page, ['1006'])
    check(`${dir} 4. enabled maps to true`, lastCall(calls) === 'enabled=true&duty=NoRoster', lastCall(calls))
    await page.locator('[data-filter="duty"]').selectOption('OffDuty')
    await page.locator('[data-filter="enabled"]').selectOption('')
    await page.locator('[data-filter-apply]').click()
    await settle(page, ['1004', '1005'])
    check(`${dir} 4. duty OffDuty → off duty and closed today`, JSON.stringify(await rowIds(page)) === JSON.stringify(['1004', '1005']) && lastCall(calls) === 'duty=OffDuty', lastCall(calls))
    const offered = await page.locator('[data-filter="duty"] option').evaluateAll((els) => els.map((e) => e.value))
    check(`${dir} 4. the duty filter offers Any and the three states only`, JSON.stringify(offered) === JSON.stringify(['', 'OnDuty', 'OffDuty', 'NoRoster']), JSON.stringify(offered))
    await page.locator('[data-filter="city"]').fill('Nowhere')
    await page.locator('[data-filter-apply]').click()
    await page.locator('[data-members-empty="filtered"]').waitFor({ timeout: 8000 }).catch(() => {})
    check(`${dir} 4. no match reads its own sentence`, strip(await page.locator('[data-members-empty]').innerText().catch(() => '')) === 'No member matches these filters.')
    await page.locator('[data-filter-clear]').click()
    await settle(page, ALL)
    check(`${dir} 4. Clear empties the URL and the door query`, new URL(page.url()).search === '' && lastCall(calls) === '', `${page.url()} ${lastCall(calls)}`)
    check(`${dir} 4. Clear brings every member back`, JSON.stringify(await rowIds(page)) === JSON.stringify(ALL))

    // 9. tabs
    await page.locator('[role="tab"][data-tab="history"]').click()
    await page.locator('[data-history-tab]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 9. History is held in the URL`, new URL(page.url()).search === '?tab=history' && (await page.locator('[data-history-tab]').count()) === 1)
    check(`${dir} 9. History unmounts the Members tab`, (await page.locator('[data-members-tab]').count()) === 0)
    await page.locator('[role="tab"][data-tab="members"]').click()
    await grid(page).waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 9. Members writes no tab key`, new URL(page.url()).search === '' && (await grid(page).count()) === 1)

    check(`${dir} 10. no raw keys on screen`, !/serving-lists:|members\.|duty\.|detail\.|tabs\./.test(await page.locator('main').innerText()))
    await page.locator('[data-back]').click()
    await page.waitForURL(/\/oms\/serving-lists$/, { timeout: 5000 }).catch(() => {})
    check(`${dir} 10. the back link opens every list`, new URL(page.url()).pathname === '/oms/serving-lists')
    check(`${dir} 10. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 5 + 6. URL-borne filters
  {
    const { context, page, errors, calls } = await open(dir)
    await page.goto(`${BASE}/oms/serving-lists/${A}?duty=bogus&enabled=maybe`)
    await grid(page).locator('[data-duty]').first().waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 5. an unlisted duty / enabled is never sent (SVL-00009)`, calls.length > 0 && calls.every((c) => c.qs === ''), JSON.stringify(calls))
    check(`${dir} 5. …and reads as Any`, (await page.locator('[data-filter="duty"]').inputValue()) === '' && (await page.locator('[data-filter="enabled"]').inputValue()) === '')
    await page.goto(`${BASE}/oms/serving-lists/${A}?city=Jeddah&duty=OnDuty`)
    await settle(page, ['1003'])
    check(`${dir} 6. a deep link's filters reach the door`, lastCall(calls) === 'city=Jeddah&duty=OnDuty', lastCall(calls))
    check(`${dir} 6. …and the bar`, (await page.locator('[data-filter="city"]').inputValue()) === 'Jeddah' && (await page.locator('[data-filter="duty"]').inputValue()) === 'OnDuty')
    check(`${dir} 6. …and the grid`, JSON.stringify(await rowIds(page)) === JSON.stringify(['1003']))
    check(`${dir} 6. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 7. deactivated
  {
    const { context, page, errors } = await open(dir)
    await page.goto(`${BASE}/oms/serving-lists/${D}`)
    await grid(page).locator('[data-duty]').first().waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 7. a deactivated list reads Deactivated`, (await page.locator('[data-list-header] [data-status]').getAttribute('data-status')) === 'deactivated')
    check(`${dir} 7. …and says its deliveries are not competed`, /not competed/.test(strip(await page.locator('[data-deactivated-note]').innerText())))
    check(`${dir} 7. …and still lists its members`, JSON.stringify(await rowIds(page)) === JSON.stringify(['1001']))
    check(`${dir} 7. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 8. unknown id
  {
    const { context, page, errors } = await open(dir)
    await page.goto(`${BASE}/oms/serving-lists/${NOPE}`)
    await page.locator('[data-list-not-found]').waitFor({ timeout: 20000 }).catch(() => {})
    const nf = page.locator('[data-list-not-found]')
    check(`${dir} 8. SVL-00001 reads "This serving list does not exist"`, (await nf.count()) === 1 && strip(await nf.innerText()).startsWith('This serving list does not exist'))
    check(`${dir} 8. …with the id as an ltr isolate`, (await nf.locator('bdi[dir="ltr"]').innerText()) === NOPE)
    check(`${dir} 8. …in place of the grid`, (await grid(page).count()) === 0 && (await page.locator('[data-list-header][data-list-known="false"]').count()) === 1)
    check(`${dir} 8. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 9. SVL-00009 has the screen's own words, with the code (review fix)
  {
    const { context, page, errors } = await open(dir)
    await page.goto(`${BASE}/oms/serving-lists/${DUTY9}`)
    const refusal = page.locator('[data-members-tab] [data-members-refusal="SVL-00009"]')
    await refusal.waitFor({ timeout: 20000 }).catch(() => {})
    const text = strip(await page.locator('[data-members-tab] [role="alert"]').first().innerText().catch(() => ''))
    check(`${dir} 9. SVL-00009 reads the screen's words + its code`, (await refusal.count()) === 1 && /duty filter is not one the server knows|مرشّح المناوبة/.test(text) && !/Unknown duty filter/.test(text), text)
    check(`${dir} 9. no raw keys`, !/members\.unknownDuty/.test(text))
    check(`${dir} 9. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 10. the Lists read fails: the header says so instead of silently degrading (review fix)
  {
    const { context, page, errors } = await open(dir, { listsFail: true })
    await page.goto(`${BASE}/oms/serving-lists/${A}`)
    await page.locator('[data-lists-failed]').waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 10. a failed Lists read shows an error under the header`, (await page.locator('[data-lists-failed]').count()) === 1 && (await page.locator('[data-list-header][data-list-known="false"]').count()) === 1)
    check(`${dir} 10. …and the edit controls stay hidden`, (await page.locator('[data-header-actions], [data-add-stores]').count()) === 0)
    await grid(page).locator('[data-duty]').first().waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 10. …while Members still reads`, (await grid(page).count()) === 1)
    check(`${dir} 10. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
