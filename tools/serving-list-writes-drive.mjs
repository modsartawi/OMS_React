// Serving list writes drive (ticket 570, BackOffice spec 3042) — drives the REAL serving-list pages in Chromium
// against STUBBED, STATEFUL `ServingListWeb/*` envelopes shaped from BackOffice `ServingListAdminModels.cs`
// (pricing2). 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 3045 is not deployed. Never point this at
// a real host.
//
// It verifies, in LTR and RTL:
//   1. without Execute (`canEditServingLists: false`): no New list, no Rename / Deactivate, no actions column;
//   2. create: blank and 101-character names block Create; the Arabic field is RTL; the body is trimmed with the
//      note; the created list opens; a forced SVL-00005 shows its own words + code and keeps the dialog open;
//   3. rename: Save is disabled while unchanged; the PUT body; the header re-reads; an unknown code shows the
//      server text; a bare 403 reads "not allowed";
//   4. deactivate: the confirm names the competed types (QC, QCS) and not HD; the POST body; the answer's
//      `warning` is a toast; the header flips to Deactivated / Reactivate; reactivate's SVL-00007 is stale →
//      its words, "refreshed", and Lists is re-read;
//   5. members: disable → enable → remove on one member (PUT Enabled false/true, DELETE ?note=), the grid follows;
//      a forced SVL-00004 reads "no longer on the list" and refetches;
//   6. every write re-reads Lists and the list's Members; no raw keys; no page errors.
//
//   1. run the app:  npx vite --port 5212 --strictPort
//   2. DRIVE_PORT=5212 node tools/serving-list-writes-drive.mjs
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
const refuse = (errorCode, message) => envelope(null, { status: 400, success: false, message, errorCode })

const A = '01JB8Z3K4M5N6P7Q8R9S0T1V2W'
const NEW = '01JB9NEWNEWNEWNEWNEWNEWNEW'
const QC = { documentType: 'QC', description: 'Quick commerce', isCompeted: true }
const QCS = { documentType: 'QCS', description: 'Quick commerce scheduled', isCompeted: true }
const HD = { documentType: 'HD', description: 'Home delivery', isCompeted: false }
const WARNING = 'Delivery types QC, QCS point at this list: their deliveries are no longer competed. / أنواع التوصيل QC, QCS تشير إلى هذه القائمة.'

const listRow = (id, nameEn, nameAr, over = {}) => ({
  servingListId: id,
  nameEn,
  nameAr,
  isActive: true,
  memberCount: 3,
  enabledMemberCount: 3,
  pointingTypes: [],
  createdAt: '2026-10-20T09:00:00',
  createdBy: 'msartawi',
  updatedAt: '2026-10-24T14:30:00',
  updatedBy: 'amal',
  warning: null,
  ...over,
})
const memberRow = (storeCode, storeName, over = {}) => ({
  storeCode,
  storeName,
  city: 'Riyadh',
  storeClosed: false,
  isEnabled: true,
  addedAt: '2026-10-21T10:00:00',
  addedBy: 'msartawi',
  updatedAt: '2026-10-23T11:15:00',
  updatedBy: 'amal',
  duty: 'OnDuty',
  onDutyNow: true,
  todayShifts: [{ open: '09:00', close: '17:00', overnight: false }],
  ...over,
})

const browser = await chromium.launch()

/** One browser context with its own stateful stub. `force` maps "METHOD path-suffix" → one-shot refusal. */
async function open(dir, { canEdit = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const force = new Map()
  const state = {
    lists: [listRow(A, 'Riyadh north', 'شمال الرياض', { pointingTypes: [QC, HD, QCS] })],
    members: { [A]: [memberRow('1001', 'Olaya'), memberRow('1002', 'Malqa'), memberRow('1003', 'Tahlia')] },
  }
  const recount = (id) => {
    const l = state.lists.find((r) => r.servingListId === id)
    const ms = state.members[id] ?? []
    Object.assign(l, { memberCount: ms.length, enabledMemberCount: ms.filter((m) => m.isEnabled).length, updatedAt: '2026-10-25T10:00:00', updatedBy: 'msartawi', warning: null })
    return l
  }
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
    const method = req.method()
    const body = req.postData() ? JSON.parse(req.postData()) : null
    calls.push({ method, p, qs: url.searchParams.toString(), body })
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'ServingListWeb/Access') return route.fulfill(envelope({ canViewServingLists: true, canEditServingLists: canEdit }))
    for (const [k, answer] of force) {
      if (`${method} ${p}`.endsWith(k)) {
        force.delete(k)
        return route.fulfill(answer)
      }
    }
    if (p === 'ServingListWeb/Lists' && method === 'GET') return route.fulfill(envelope(state.lists))
    if (p === 'ServingListWeb/Lists' && method === 'POST') {
      const row = listRow(NEW, body.nameEn, body.nameAr, { memberCount: 0, enabledMemberCount: 0 })
      state.lists.push(row)
      state.members[NEW] = []
      return route.fulfill(envelope(row))
    }
    let m
    if ((m = p.match(/^ServingListWeb\/Lists\/([^/]+)\/(Members|Changes|Name|Deactivate|Reactivate)$/))) {
      const id = decodeURIComponent(m[1])
      const l = state.lists.find((r) => r.servingListId === id)
      if (m[2] === 'Members') return route.fulfill(envelope(state.members[id] ?? []))
      if (m[2] === 'Changes') return route.fulfill(envelope([]))
      if (m[2] === 'Name') {
        Object.assign(l, { nameEn: body.nameEn, nameAr: body.nameAr })
        return route.fulfill(envelope(recount(id)))
      }
      if (m[2] === 'Deactivate') {
        l.isActive = false
        const row = recount(id)
        return route.fulfill(envelope({ ...row, warning: WARNING }))
      }
      l.isActive = true
      return route.fulfill(envelope(recount(id)))
    }
    if ((m = p.match(/^ServingListWeb\/Lists\/([^/]+)\/Stores\/([^/]+)(\/Enabled)?$/))) {
      const id = decodeURIComponent(m[1])
      const code = decodeURIComponent(m[2])
      const ms = state.members[id]
      if (m[3]) ms.find((x) => x.storeCode === code).isEnabled = body.enabled
      else state.members[id] = ms.filter((x) => x.storeCode !== code)
      return route.fulfill(envelope(recount(id)))
    }
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, force, state }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const dialog = (page, hook) => page.locator(`[data-write-dialog="${hook}"]`)
const confirmBtn = (page) => page.locator('dialog[open] [data-write-confirm]')
const toastText = async (page, re) => {
  await page.locator('[data-sonner-toast]').filter({ hasText: re }).first().waitFor({ timeout: 5000 }).catch(() => {})
  return strip((await page.locator('[data-sonner-toast]').allInnerTexts()).join(' | '))
}
const count = (calls, method, re) => calls.filter((c) => c.method === method && re.test(c.p)).length
const rowOf = (page, code) => page.locator(`[data-members-grid] .ag-row[row-id="${code}"]`)
const RAW = /serving-lists:|writes\.|members\.|detail\./

for (const dir of ['ltr', 'rtl']) {
  // 1. no Execute → no edit control
  {
    const { context, page, errors } = await open(dir, { canEdit: false })
    await page.goto(`${BASE}/oms/serving-lists`)
    await page.locator('[data-lists-grid] .ag-row').first().waitFor({ timeout: 20000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} 1. no New list without Execute`, (await page.locator('[data-action="create"]').count()) === 0)
    await page.goto(`${BASE}/oms/serving-lists/${A}`)
    await page.locator('[data-members-grid] .ag-row').first().waitFor({ timeout: 20000 })
    check(`${dir} 1. no Rename / Deactivate without Execute`, (await page.locator('[data-header-actions] button').count()) === 0)
    check(`${dir} 1. no actions column without Execute`, (await page.locator('[data-members-grid] [col-id="actions"]').count()) === 0 && (await page.locator('[data-member-actions]').count()) === 0)
    check(`${dir} 1. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 2. create
  {
    const { context, page, errors, calls, force } = await open(dir)
    await page.goto(`${BASE}/oms/serving-lists`)
    await page.locator('[data-lists-grid] .ag-row').first().waitFor({ timeout: 20000 })
    await page.locator('[data-action="create"]').click()
    await dialog(page, 'create').waitFor({ timeout: 5000 })
    check(`${dir} 2. Create is disabled on an empty form`, await confirmBtn(page).isDisabled())
    check(`${dir} 2. the Arabic field is RTL, the English LTR`, (await page.locator('[data-name-field="ar"]').getAttribute('dir')) === 'rtl' && (await page.locator('[data-name-field="en"]').getAttribute('dir')) === 'ltr')
    await page.locator('[data-name-field="en"]').fill('  Jeddah south  ')
    check(`${dir} 2. a blank Arabic name blocks Create`, await confirmBtn(page).isDisabled())
    await page.locator('[data-name-field="ar"]').fill('ب'.repeat(101))
    check(`${dir} 2. 101 characters block Create and say so`, (await confirmBtn(page).isDisabled()) && (await page.locator('[data-name-problem="ar:tooLong"]').count()) === 1)
    await page.locator('[data-name-field="en"]').fill('   ')
    check(`${dir} 2. a white-space English name reads Required`, (await page.locator('[data-name-problem="en:required"]').count()) === 1)
    // A forced SVL-00005 (stale client rule): own words + code, dialog stays.
    await page.locator('[data-name-field="en"]').fill('  Jeddah south  ')
    await page.locator('[data-name-field="ar"]').fill(' جنوب جدة ')
    await page.locator('[data-write-note]').fill('  pilot list  ')
    force.set('POST ServingListWeb/Lists', refuse('SVL-00005', 'A serving list needs a name in English and in Arabic. / تحتاج قائمة الخدمة إلى اسم.'))
    await confirmBtn(page).click()
    await page.locator('[data-write-refusal="SVL-00005"]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 2. SVL-00005 shows its own words and code, dialog open`, (await page.locator('[data-write-refusal="SVL-00005"]').count()) === 1 && /needs a name in English and in Arabic/.test(strip(await dialog(page, 'create').innerText())))
    await confirmBtn(page).click()
    await page.waitForURL(new RegExp(`/oms/serving-lists/${NEW}$`), { timeout: 8000 }).catch(() => {})
    const post = calls.filter((c) => c.method === 'POST' && c.p === 'ServingListWeb/Lists').at(-1)
    check(`${dir} 2. the POST body is trimmed, with the note`, JSON.stringify(post?.body) === JSON.stringify({ nameEn: 'Jeddah south', nameAr: 'جنوب جدة', note: 'pilot list' }), JSON.stringify(post?.body))
    check(`${dir} 2. the created list opens`, new URL(page.url()).pathname === `/oms/serving-lists/${NEW}`, page.url())
    check(`${dir} 2. a toast names it`, /Serving list Jeddah south created/.test(await toastText(page, /created/)))
    await page.locator('[data-list-header][data-list-known="true"]').waitFor({ timeout: 8000 }).catch(() => {})
    check(`${dir} 2. its header reads the new name`, strip(await page.locator('[data-name-en]').innerText().catch(() => '')) === 'Jeddah south')
    check(`${dir} 2. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 3 + 4. rename, deactivate, reactivate
  {
    const { context, page, errors, calls, force } = await open(dir)
    await page.goto(`${BASE}/oms/serving-lists/${A}`)
    await page.locator('[data-members-grid] .ag-row').first().waitFor({ timeout: 20000 })
    await page.locator('[data-action="rename"]').click()
    await dialog(page, 'rename').waitFor({ timeout: 5000 })
    check(`${dir} 3. rename opens with the names, Save disabled while unchanged`, (await page.locator('[data-name-field="en"]').inputValue()) === 'Riyadh north' && (await confirmBtn(page).isDisabled()) && (await page.locator('[data-name-unchanged]').count()) === 1)
    await page.locator('[data-name-field="en"]').fill('Riyadh north ')
    check(`${dir} 3. surrounding spaces are still unchanged`, await confirmBtn(page).isDisabled())
    await page.locator('[data-name-field="en"]').fill('Riyadh North')
    // A bare 403 → not allowed.
    force.set('PUT ServingListWeb/Lists/' + A + '/Name', { status: 403, body: '' })
    await confirmBtn(page).click()
    await page.locator('[data-write-refusal="notGranted"]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 3. a bare 403 reads "not allowed" and disables Save`, (await page.locator('[data-write-refusal="notGranted"]').count()) === 1 && (await confirmBtn(page).isDisabled()))
    await page.locator('dialog[open] [data-write-cancel]').click()
    // An unknown code → the server text.
    await page.locator('[data-action="rename"]').click()
    await page.locator('[data-name-field="en"]').fill('Riyadh North')
    force.set('PUT ServingListWeb/Lists/' + A + '/Name', refuse('SVL-00099', 'Something new happened. / حدث شيء جديد.'))
    await confirmBtn(page).click()
    await page.locator('[data-write-refusal="SVL-00099"]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 3. an unknown code falls back to the server text`, /Something new happened\. \/ حدث شيء جديد\./.test(strip(await dialog(page, 'rename').innerText())))
    const listsBefore = count(calls, 'GET', /^ServingListWeb\/Lists$/)
    const membersBefore = count(calls, 'GET', /\/Members$/)
    await page.locator('[data-write-note]').fill('capital N')
    await confirmBtn(page).click()
    await dialog(page, 'rename').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    const put = calls.filter((c) => c.method === 'PUT' && c.p.endsWith('/Name')).at(-1)
    check(`${dir} 3. the PUT body`, JSON.stringify(put?.body) === JSON.stringify({ nameEn: 'Riyadh North', nameAr: 'شمال الرياض', note: 'capital N' }), JSON.stringify(put?.body))
    await page.locator('[data-name-en]').filter({ hasText: 'Riyadh North' }).waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 3. the header re-reads the new name`, strip(await page.locator('[data-name-en]').innerText()) === 'Riyadh North')
    check(`${dir} 6. a write re-reads Lists and the list's Members`, count(calls, 'GET', /^ServingListWeb\/Lists$/) > listsBefore && count(calls, 'GET', /\/Members$/) > membersBefore)

    // 4. deactivate
    await page.locator('[data-action="deactivate"]').click()
    await dialog(page, 'deactivate').waitFor({ timeout: 5000 })
    const warn = page.locator('dialog[open] [data-deactivate-competed]')
    check(`${dir} 4. the confirm names the competed types only`, (await warn.getAttribute('data-deactivate-competed')) === 'QC QCS')
    const warnText = strip(await warn.innerText())
    check(`${dir} 4. …in words: QC and QCS stop being competed`, /The deliveries of QC and QCS will stop being competed; they go to their fallback store\./.test(warnText) && !/HD/.test(warnText), warnText)
    check(`${dir} 4. …and says an open bid stays`, /never withdrawn/.test(strip(await dialog(page, 'deactivate').innerText())))
    await confirmBtn(page).click()
    await dialog(page, 'deactivate').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    const deact = calls.filter((c) => c.method === 'POST' && c.p.endsWith('/Deactivate')).at(-1)
    check(`${dir} 4. the POST body (no note → {})`, JSON.stringify(deact?.body) === '{}', JSON.stringify(deact?.body))
    check(`${dir} 4. the answer's warning is a toast`, (await toastText(page, /no longer competed/)).includes('Delivery types QC, QCS point at this list'))
    await page.locator('[data-action="reactivate"]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 4. the header flips to Deactivated, with Reactivate`, (await page.locator('[data-list-header] [data-status]').getAttribute('data-status')) === 'deactivated' && (await page.locator('[data-action="reactivate"]').count()) === 1)

    // reactivate → stale SVL-00007
    await page.locator('[data-action="reactivate"]').click()
    await dialog(page, 'reactivate').waitFor({ timeout: 5000 })
    check(`${dir} 4. reactivate carries no competed warning`, (await page.locator('dialog[open] [data-deactivate-competed]').count()) === 0)
    const listsBefore2 = count(calls, 'GET', /^ServingListWeb\/Lists$/)
    force.set('/Reactivate', refuse('SVL-00007', `Serving list ${A} is already active. / قائمة الخدمة نشطة بالفعل.`))
    await confirmBtn(page).click()
    await page.locator('[data-write-refusal="SVL-00007"]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 4. SVL-00007 reads its own words + "refreshed"`, /This change has already been made\./.test(strip(await dialog(page, 'reactivate').innerText())) && (await page.locator('[data-write-refreshed]').count()) === 1)
    await page.waitForTimeout(300)
    check(`${dir} 4. …and Lists is re-read`, count(calls, 'GET', /^ServingListWeb\/Lists$/) > listsBefore2)
    await confirmBtn(page).click()
    await page.locator('[data-action="deactivate"]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 4. a second try reactivates`, (await page.locator('[data-list-header] [data-status]').getAttribute('data-status')) === 'active')
    check(`${dir} 6. no raw keys`, !RAW.test(await page.locator('main').innerText()))
    check(`${dir} 3+4. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 5. members: disable → enable → remove
  {
    const { context, page, errors, calls, force } = await open(dir)
    await page.goto(`${BASE}/oms/serving-lists/${A}`)
    await page.locator('[data-members-grid] .ag-row').first().waitFor({ timeout: 20000 })
    const r = rowOf(page, '1001')
    check(`${dir} 5. the actions column is pinned at the end`, (await page.locator(`[data-members-grid] .ag-grid-pinned-${dir === 'rtl' ? 'left' : 'right'}-cells [data-member-actions="1001"]`).count()) === 1)
    const fit = await r.locator('[data-member-actions]').evaluate((e) => { const c = e.closest('.ag-cell'); const a = c.getBoundingClientRect(), b = e.getBoundingClientRect(); return b.left >= a.left - 1 && b.right <= a.right + 1 })
    check(`${dir} 5. both buttons fit in the actions cell`, fit)
    await r.locator('[data-member-action="disable"]').click()
    await dialog(page, 'member-disable').waitFor({ timeout: 5000 })
    check(`${dir} 5. the disable dialog names the store, one ltr isolate`, (await page.locator('dialog[open] [data-member-subject] bdi[dir="ltr"]').innerText()) === '1001 · Olaya')
    await page.locator('[data-write-note]').fill('roster gap')
    await confirmBtn(page).click()
    await r.locator('[data-member-action="enable"]').waitFor({ timeout: 5000 }).catch(() => {})
    const dis = calls.filter((c) => c.method === 'PUT' && c.p.endsWith('/Stores/1001/Enabled')).at(-1)
    check(`${dir} 5. disable sends { enabled: false, note }`, JSON.stringify(dis?.body) === JSON.stringify({ enabled: false, note: 'roster gap' }), JSON.stringify(dis?.body))
    check(`${dir} 5. the row reads Disabled, with Enable`, (await r.locator('[data-enabled]').getAttribute('data-enabled')) === 'false' && (await r.locator('[data-member-action="enable"]').count()) === 1)
    check(`${dir} 5. the header counts follow`, (await page.locator('[data-header-members] bdi[dir="ltr"]').innerText()) === '2 / 3')
    check(`${dir} 5. a toast names the store`, /Store 1001 · Olaya disabled/.test(await toastText(page, /disabled/)))
    await r.locator('[data-member-action="enable"]').click()
    await dialog(page, 'member-enable').waitFor({ timeout: 5000 })
    await confirmBtn(page).click()
    await r.locator('[data-member-action="disable"]').waitFor({ timeout: 5000 }).catch(() => {})
    const en = calls.filter((c) => c.method === 'PUT' && c.p.endsWith('/Stores/1001/Enabled')).at(-1)
    check(`${dir} 5. enable sends { enabled: true }`, JSON.stringify(en?.body) === JSON.stringify({ enabled: true }), JSON.stringify(en?.body))
    check(`${dir} 5. the row reads Enabled again`, (await r.locator('[data-enabled]').getAttribute('data-enabled')) === 'true')
    await r.locator('[data-member-action="remove"]').click()
    await dialog(page, 'member-remove').waitFor({ timeout: 5000 })
    const rm = strip(await dialog(page, 'member-remove').innerText())
    check(`${dir} 5. the remove confirm says next callout, and an offered bid stays`, /no longer bid from the next callout/.test(rm) && /never withdrawn/.test(rm), rm)
    await page.locator('[data-write-note]').fill('closed for works')
    await confirmBtn(page).click()
    await r.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    const del = calls.filter((c) => c.method === 'DELETE').at(-1)
    check(`${dir} 5. remove is DELETE …/Stores/1001?note=`, del?.p === `ServingListWeb/Lists/${A}/Stores/1001` && new URLSearchParams(del.qs).get('note') === 'closed for works' && del.body === null, JSON.stringify(del))
    check(`${dir} 5. the row leaves the grid`, (await r.count()) === 0)
    // SVL-00004 on another member: stale.
    const membersBefore = count(calls, 'GET', /\/Members$/)
    force.set('/Stores/1002', refuse('SVL-00004', `Store 1002 is not on serving list ${A}. / الفرع 1002 ليس في القائمة.`))
    await rowOf(page, '1002').locator('[data-member-action="remove"]').click()
    await confirmBtn(page).click()
    await page.locator('[data-write-refusal="SVL-00004"]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 5. SVL-00004 reads "no longer on the list" + refreshed`, /This store is no longer on the list\./.test(strip(await dialog(page, 'member-remove').innerText())) && (await page.locator('[data-write-refreshed]').count()) === 1)
    await page.waitForTimeout(300)
    check(`${dir} 5. …and Members is re-read`, count(calls, 'GET', /\/Members$/) > membersBefore)
    await page.locator('dialog[open] [data-write-cancel]').click()
    check(`${dir} 6. no raw keys`, !RAW.test(await page.locator('main').innerText()))
    check(`${dir} 5. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
