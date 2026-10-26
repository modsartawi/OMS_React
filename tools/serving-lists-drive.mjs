// Serving lists drive (ticket 567, BackOffice spec 3042) — drives the REAL Serving lists page in Chromium against
// STUBBED `ServingListWeb/*` envelopes, shaped from BackOffice `ServingListAdminModels.cs` (branch spec3042).
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 3045 is built on spec3042, not deployed.
// Never point this at a real host.
//
// It verifies, in LTR and RTL:
//   1. with View: the menu leaf, the title, every list in the door's order — active, deactivated, one shared by
//      three types, an empty one, and an active one whose competed type has no enabled member;
//   2. the members label (enabled / all) as one ltr isolate; the status badge;
//   3. the pointing-type chips: the code, the description as the tooltip, competed marked;
//   4. the flag: no enabled member under a competed type, deactivated-but-pointed-at, empty;
//   5. a row opens /oms/serving-lists/:id (568's detail);
//   6. Access with neither flag → the gate's denial, no leaf, no Lists read; a bare 403 on Access → denial;
//   7. a bare 403 on Lists → "You do not have access", never an empty grid.
//
//   1. run the app:  npx vite --port 5207
//   2. node tools/serving-lists-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5207}`
const URL_ = `${BASE}/oms/serving-lists`

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
  memberCount: 0,
  enabledMemberCount: 0,
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
const EX = { documentType: 'EX', description: 'Express', isCompeted: true }
const DQ = { documentType: 'DQ', description: '', isCompeted: true }

// Sorted by English name, as the door answers.
const LISTS = [
  list('SVL-0004', 'Al Khobar (new)', 'الخبر (جديدة)'),
  list('SVL-0003', 'Dammam pilot', 'الدمام التجريبية', { memberCount: 3, enabledMemberCount: 0, pointingTypes: [DQ] }),
  list('SVL-0002', 'Jeddah', 'جدة', { isActive: false, memberCount: 4, enabledMemberCount: 4, pointingTypes: [] }),
  list('SVL-0001', 'Riyadh north', 'شمال الرياض', { memberCount: 12, enabledMemberCount: 9, pointingTypes: [QC, HD, EX] }),
]

const browser = await chromium.launch()

async function open(dir, { access = { canViewServingLists: true, canEditServingLists: true }, accessStatus = 200, listsStatus = 200 } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const reads = { lists: 0, access: 0 }
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
    if (p === 'ServingListWeb/Access') {
      reads.access++
      if (accessStatus === 403) return route.fulfill({ status: 403, body: '' })
      return route.fulfill(envelope(access))
    }
    if (p === 'ServingListWeb/Lists') {
      reads.lists++
      if (listsStatus === 403) return route.fulfill({ status: 403, body: '' })
      if (listsStatus === 'coded403') return route.fulfill(envelope(null, { status: 403, success: false, message: 'Lists are closed for audit. / القوائم مغلقة للتدقيق.', errorCode: 'SVL-00042' }))
      return route.fulfill(envelope(LISTS))
    }
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const rowOf = (page, id) => page.locator(`[data-lists-grid] .ag-row[row-id="${id}"]`)
const leaf = (page) => page.locator('a[href="/oms/serving-lists"]')

for (const dir of ['ltr', 'rtl']) {
  // ── 1–5: View + Edit ────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir)
    await page.goto(URL_)
    await page.locator('[data-lists-grid] [data-members]').first().waitFor({ timeout: 20000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} 1. the title`, (await page.locator('h1').first().innerText()).trim() === 'Serving lists')
    check(`${dir} 1. the menu leaf is shown`, (await leaf(page).count()) >= 1)
    const ids = await page
      .locator('[data-lists-grid] .ag-row')
      .evaluateAll((els) => els.sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index'))).map((e) => e.getAttribute('row-id')))
    check(`${dir} 1. every list, in the door's order`, JSON.stringify(ids) === JSON.stringify(['SVL-0004', 'SVL-0003', 'SVL-0002', 'SVL-0001']), JSON.stringify(ids))
    const riyadh = rowOf(page, 'SVL-0001')
    check(`${dir} 1. English and Arabic names`, strip(await riyadh.locator('[col-id="nameEn"]').innerText()) === 'Riyadh north' && strip(await riyadh.locator('[col-id="nameAr"]').innerText()) === 'شمال الرياض')

    // 2. members + status
    const members = await Promise.all(['SVL-0004', 'SVL-0003', 'SVL-0002', 'SVL-0001'].map(async (id) => strip(await rowOf(page, id).locator('[data-members]').innerText())))
    check(`${dir} 2. members read enabled / all`, JSON.stringify(members) === JSON.stringify(['0 / 0', '0 / 3', '4 / 4', '9 / 12']), JSON.stringify(members))
    check(`${dir} 2. the members label is one ltr isolate`, (await riyadh.locator('[data-members] bdi[dir="ltr"]').count()) === 1 && (await riyadh.locator('[data-members] bdi[dir="ltr"]').innerText()) === '9 / 12')
    const statuses = await Promise.all(['SVL-0002', 'SVL-0001'].map(async (id) => (await rowOf(page, id).locator('[data-status]').getAttribute('data-status')) + '=' + strip(await rowOf(page, id).locator('[data-status]').innerText())))
    check(`${dir} 2. active and deactivated`, JSON.stringify(statuses) === JSON.stringify(['deactivated=Deactivated', 'active=Active']), JSON.stringify(statuses))

    // 3. chips
    const chips = await riyadh.locator('[data-chip]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-chip')}:${e.getAttribute('data-competed')}:${e.getAttribute('title')}`))
    check(
      `${dir} 3. a list shared by three types shows three chips, competed marked, description as tooltip`,
      JSON.stringify(chips.map((c) => c.replace(/[\u2066-\u2069]/g, ''))) === JSON.stringify(['QC:true:Quick commerce', 'HD:false:Home delivery', 'EX:true:Express']),
      JSON.stringify(chips),
    )
    check(`${dir} 3. a competed chip carries the competed mark`, (await riyadh.locator('[data-chip="QC"] svg[aria-label="Competed"]').count()) === 1 && (await riyadh.locator('[data-chip="HD"] svg').count()) === 0)
    check(`${dir} 3. a blank description falls back to the code`, ((await rowOf(page, 'SVL-0003').locator('[data-chip="DQ"]').getAttribute('title')) ?? '').replace(/[\u2066-\u2069]/g, '') === 'DQ')
    check(`${dir} 3. no pointing type reads None`, strip(await rowOf(page, 'SVL-0002').locator('[data-pointing-none]').innerText()) === 'None')
    if (dir === 'rtl') check('rtl 3. a chip code is an ltr isolate', (await riyadh.locator('[data-chip="QC"] bdi[dir="ltr"]').innerText()) === 'QC')

    // 4. flags
    const flags = await Promise.all(['SVL-0004', 'SVL-0003', 'SVL-0002', 'SVL-0001'].map(async (id) => (await rowOf(page, id).locator('[data-flag]').getAttribute('data-flag').catch(() => null)) ?? '-'))
    check(`${dir} 4. flags: empty · no enabled member · none · none`, JSON.stringify(flags) === JSON.stringify(['empty', 'noEnabledMember', '-', '-']), JSON.stringify(flags))
    const nem = rowOf(page, 'SVL-0003').locator('[data-flag]')
    check(`${dir} 4. the flag names ServingListInactive in its tooltip`, strip(await nem.innerText()) === 'No enabled member' && /ServingListInactive/.test((await nem.getAttribute('title')) ?? ''))
    check(`${dir} 4. updated at · by is one ltr isolate`, strip(await riyadh.locator('[data-updated]').innerText()) === '2026-10-24 14:30 · amal' && (await riyadh.locator('[data-updated] bdi[dir="ltr"]').count()) === 1, strip(await riyadh.locator('[data-updated]').innerText()))
    check(`${dir} 4. no raw keys on screen`, !/serving-lists:|flag\.|columns\.|status\./.test(await page.locator('main').innerText()))

    // 5. row opens detail
    await riyadh.locator('[col-id="nameEn"]').click()
    await page.waitForURL(/\/oms\/serving-lists\/SVL-0001$/, { timeout: 5000 }).catch(() => {})
    check(`${dir} 5. a row opens /oms/serving-lists/:id`, new URL(page.url()).pathname === '/oms/serving-lists/SVL-0001', page.url())
    check(`${dir} 5. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── View only: the screen still opens (edit controls are 570's) ────────────────────────────
  {
    const { context, page } = await open(dir, { access: { canViewServingLists: true, canEditServingLists: false } })
    await page.goto(URL_)
    await page.locator('[data-lists-grid] [data-members]').first().waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 6. View alone opens the screen`, (await page.locator('[data-lists-grid]').count()) === 1 && (await leaf(page).count()) >= 1)
    await context.close()
  }

  // ── 6. neither flag ────────────────────────────────────────────────────────────────────────
  {
    const { context, page, reads } = await open(dir, { access: { canViewServingLists: false, canEditServingLists: false } })
    await page.goto(URL_)
    await page.locator('[role="alert"]').first().waitFor({ timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(500)
    check(`${dir} 6. neither flag → "You do not have access"`, (await page.locator('[role="alert"]').first().innerText()).includes('You do not have access'))
    check(`${dir} 6. neither flag → no grid, no Lists read`, (await page.locator('[data-lists-grid]').count()) === 0 && reads.lists === 0, `lists reads ${reads.lists}`)
    check(`${dir} 6. neither flag → no menu leaf`, (await leaf(page).count()) === 0)
    await context.close()
  }
  {
    const { context, page, reads } = await open(dir, { accessStatus: 403 })
    await page.goto(URL_)
    await page.locator('[role="alert"]').first().waitFor({ timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(500)
    check(`${dir} 6. a bare 403 on Access → "You do not have access", no leaf, no read`, (await page.locator('[role="alert"]').first().innerText()).includes('You do not have access') && (await leaf(page).count()) === 0 && reads.lists === 0)
    await context.close()
  }

  // ── 7. a bare 403 on Lists ───────────────────────────────────────────────────────────────
  {
    const { context, page } = await open(dir, { listsStatus: 403 })
    await page.goto(URL_)
    await page.locator('[data-lists-denied]').waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 7. a bare 403 on Lists → "You do not have access", never an empty grid`, (await page.locator('[data-lists-denied]').count()) === 1 && strip(await page.locator('[data-lists-denied]').innerText()).startsWith('You do not have access') && (await page.locator('[data-lists-grid], [data-lists-empty]').count()) === 0)
    await context.close()
  }

  // ── 8. a CODED 403 on Lists is a business refusal: its message, not the denial card (review fix) ──
  {
    const { context, page } = await open(dir, { listsStatus: 'coded403' })
    await page.goto(URL_)
    await page.locator('[role="alert"]').filter({ hasText: 'closed for audit' }).first().waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 8. a coded 403 on Lists shows its message, not "no access"`, (await page.locator('[data-lists-denied]').count()) === 0 && (await page.locator('[role="alert"]').filter({ hasText: 'closed for audit' }).count()) === 1)
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
