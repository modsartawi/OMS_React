// HQ prescription sessions drive — the Open tab (ticket 545; BackOffice spec 2994, door 3015).
//
// Drives the REAL app in Chromium against a STUB of the doors (no live SIS.Api; BackOffice 3015 is on
// branch spec2994, not deployed). In LTR and RTL (`oms.locale = 'ar'` sets dir="rtl"; i18n stays
// `lng: 'en'`), it asserts:
//   1. the menu leaf, the three tabs (Open selected), the list: the door asked with NO parameter,
//      server order kept, other store + reason, parked step, lapse day only when about to lapse,
//      open items, machine values ltr-isolated, the beneficiary name a dir-auto bdi, chip counts
//      from the answer (not the rows), the store hint;
//   2. each chip sets `flag` in the address and on the wire, a second press clears it;
//   3. the filters round-trip address ↔ bar ↔ wire, and a reload asks the same question;
//   4. the Owed view asks `Sessions/Owed` with the store only;
//   5. a truncated answer says "oldest-idle N of TOTAL";
//   6. a bare 403 → the named denial, no grid;
//   7. `PSES-00223` → the envelope message beside the filters, no banner;
//   8. the To open / Ended tabs are placeholders and the tab lives in the address;
//   9. the DISPENSED rows carry no visible act yet (548's slot is hidden).
//
//   1. run the app:  npx vite --port 5204 --strictPort
//   2. DRIVE_PORT=5204 node tools/prescription-sessions-hq-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5204}`
const SHOTS = 'tools/.prescription-sessions-hq-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, errorMessage: message }] : [],
    data,
  }),
})

const step = (over = {}) => ({
  code: 'AWAIT_APPROVAL',
  label: 'Waiting on payer approval',
  owner: 'PAYER',
  waitingOn: null,
  isParked: false,
  parkNote: null,
  badges: [],
  ...over,
})
const row = (id, over = {}) => ({
  sessionId: id,
  displayId: `PS-${id}`,
  sourceKind: 'NPHS',
  sourceKey: `NP-${id}`,
  beneficiaryId: `10${id}00000`,
  beneficiaryName: 'Sara Ali',
  holdingStore: 'P001',
  otherStore: null,
  otherStoreReason: null,
  state: 'AWAITING_APPROVAL',
  route: 'DELIVERY',
  orderNo: `20000006${id}`,
  step: step(),
  createdAt: '2026-10-10T09:00:00',
  ageDays: 14,
  idleSince: '2026-10-20T10:00:00',
  idleDays: 4,
  isStalled: false,
  isAboutToLapse: false,
  isOwed: false,
  lapsesAtEndOf: null,
  dispensedAt: null,
  invoiceOwedAt: null,
  openItems: [],
  hasOpenItem: false,
  ...over,
})

function rows(rtl) {
  return [
    // Oldest idle first — and NOT in display-id order, so a client sort would show.
    row('77', { idleDays: 9, isStalled: true, openItems: ['STALLED'], hasOpenItem: true, otherStore: 'P002', otherStoreReason: 'DONOR', beneficiaryName: rtl ? 'سارة علي' : 'Sara Ali' }),
    row('12', {
      idleDays: 7,
      state: 'AWAITING_ORDER',
      isAboutToLapse: true,
      lapsesAtEndOf: '2026-10-26T00:00:00',
      openItems: ['LAPSE_WARNING'],
      hasOpenItem: true,
      otherStore: 'P009',
      otherStoreReason: 'TRANSFER',
    }),
    row('55', {
      idleDays: 3,
      state: 'DISPENSED',
      route: 'COUNTER',
      isOwed: true,
      dispensedAt: '2026-10-21T16:20:00',
      invoiceOwedAt: '2026-10-21T23:59:00',
      openItems: ['INVOICE_OWED'],
      hasOpenItem: true,
      lapsesAtEndOf: '2026-10-30T00:00:00', // sent, but not about to lapse: must not show
      step: step({ code: 'COLLECT', label: 'Customer collects', owner: 'CUSTOMER', isParked: true, parkNote: rtl ? 'يستلم غدًا' : 'collects tomorrow' }),
    }),
    row('31', { idleDays: 1, sourceKind: 'WSFT', route: null, step: null }),
  ]
}
const answer = (rtl, over = {}) => ({ rows: rows(rtl), total: 4, stalled: 310, aboutToLapse: 12, owed: 87, isTruncated: false, ...over })

const browser = await chromium.launch()

async function drive(dir) {
  const rtl = dir === 'rtl'
  const L = dir
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of (400|403)/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)

  const asked = []
  await page.route('**/api/**', async (route) => {
    const u = new URL(route.request().url())
    const p = u.pathname.split('/api/')[1]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'hq.user', currentStoreCode: 'HQ01' }))
    if (p === 'PrescriptionSessionWeb/Sessions' || p === 'PrescriptionSessionWeb/Sessions/Owed') {
      const params = Object.fromEntries(u.searchParams)
      asked.push({ path: p, params })
      if (params.store === 'DENY') return route.fulfill({ status: 403, contentType: 'text/plain', body: '' })
      const min = Number(params.minAgeDays)
      const max = Number(params.maxAgeDays)
      if ('minAgeDays' in params && 'maxAgeDays' in params && min > max)
        return route.fulfill(envelope(null, { status: 400, success: false, message: 'The age range is reversed: from 9 is after to 3.', errorCode: 'PSES-00223' }))
      if (params.store === 'TRUNC') return route.fulfill(envelope(answer(rtl, { total: 2400, isTruncated: true })))
      if (p.endsWith('/Owed')) return route.fulfill(envelope(answer(rtl, { rows: rows(rtl).filter((r) => r.state === 'DISPENSED'), total: 1 })))
      return route.fulfill(envelope(answer(rtl)))
    }
    return route.fulfill(envelope({}))
  })

  const last = () => asked[asked.length - 1]
  const settle = async (before) => {
    for (let i = 0; i < 50 && asked.length === before; i++) await page.waitForTimeout(100)
    await page.waitForTimeout(400)
  }
  const open = async (qs = '') => {
    const before = asked.length
    await page.goto(`${BASE}/oms/prescription-sessions${qs}`)
    await page.locator('[data-ps-hq]').waitFor({ timeout: 20000 })
    await settle(before)
  }
  const search = () => new URLSearchParams(new URL(page.url()).search).toString()
  const grid = () =>
    page.evaluate(() => {
      const cell = (r, col) => r.querySelector(`[col-id="${col}"]`)
      const rows = [...document.querySelectorAll('[data-ps-grid] .ag-row')]
        .sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index')))
      return rows.map((r) => ({
        id: cell(r, 'displayId')?.textContent ?? '',
        idIsolated: !!cell(r, 'displayId')?.querySelector('bdi'),
        other: cell(r, 'otherStore')?.querySelector('[data-ps-other-store]')?.getAttribute('data-ps-other-store') ?? '',
        otherLtr: cell(r, 'otherStore')?.querySelector('bdi[dir="ltr"]')?.textContent ?? '',
        reason: cell(r, 'otherStore')?.querySelector('[data-ps-other-reason]')?.getAttribute('data-ps-other-reason') ?? '',
        reasonText: cell(r, 'otherStore')?.querySelector('[data-ps-other-reason] > span:last-child')?.textContent ?? '',
        state: cell(r, 'state')?.textContent ?? '',
        route: cell(r, 'route')?.textContent ?? '',
        source: cell(r, 'source')?.textContent ?? '',
        name: cell(r, 'beneficiaryName')?.querySelector('bdi:not([dir])')?.textContent ?? '',
        stepLabel: cell(r, 'step')?.querySelector('[data-ps-step-label]')?.textContent ?? '',
        owner: cell(r, 'step')?.querySelector('[data-ps-owner]')?.getAttribute('data-ps-owner') ?? '',
        parked: !!cell(r, 'step')?.querySelector('[data-ps-parked]'),
        note: cell(r, 'step')?.querySelector('[data-ps-park-note]')?.textContent ?? '',
        lapse: cell(r, 'lapsesAtEndOf')?.textContent ?? '',
        lapseLtr: !!cell(r, 'lapsesAtEndOf')?.querySelector('bdi[dir="ltr"]'),
        items: [...(cell(r, 'openItems')?.querySelectorAll('[data-ps-open-item]') ?? [])].map((i) => `${i.getAttribute('data-ps-open-item')}=${i.textContent}`),
        idle: cell(r, 'idleDays')?.textContent ?? '',
        dispensedAt: cell(r, 'dispensedAt')?.textContent ?? '',
        action: !!r.querySelector('[data-ps-row-action]'),
      }))
    })
  const chips = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-ps-chip]')].map((c) => ({
        flag: c.getAttribute('data-ps-chip'),
        count: c.querySelector('[data-ps-chip-count] bdi[dir="ltr"]')?.textContent ?? '',
        pressed: c.getAttribute('aria-pressed') === 'true',
        disabled: c.disabled,
      })),
    )

  // ── 1: the list ─────────────────────────────────────────────────────────────────────────────
  await open()
  check(`${L}: the page is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
  const leaf = page.locator('nav a[href="/oms/prescription-sessions"]')
  check(`${L}: the OMS group carries the leaf, and it is active`, (await leaf.count()) === 1 && /Prescription sessions/.test(await leaf.innerText()), String(await leaf.count()))
  const tabs = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].map((b) => `${b.getAttribute('data-ps-tab-button')}:${b.getAttribute('aria-selected')}`))
  check(`${L}: three tabs, Open selected`, tabs.join(',') === 'open:true,toOpen:false,ended:false', tabs.join(','))
  check(`${L}: the door is asked with no parameter`, last()?.path === 'PrescriptionSessionWeb/Sessions' && Object.keys(last().params).length === 0, JSON.stringify(last()))
  await page.waitForFunction(() => document.querySelectorAll('[data-ps-grid] .ag-row').length === 4, null, { timeout: 10000 })
  let g = await grid()
  check(`${L}: server order kept (oldest idle first)`, g.map((r) => r.id).join(',') === 'PS-77,PS-12,PS-55,PS-31', g.map((r) => r.id).join(','))
  check(`${L}: cells are isolated`, g.every((r) => r.idIsolated))
  check(`${L}: a donor other store with its reason`, g[0].other === 'P002' && g[0].otherLtr === 'P002' && g[0].reason === 'DONOR' && g[0].reasonText === 'Donor', JSON.stringify(g[0]))
  check(`${L}: a transfer other store with its reason`, g[1].other === 'P009' && g[1].reason === 'TRANSFER' && g[1].reasonText === 'Transfer')
  check(`${L}: no other store draws nothing`, g[2].other === '' && g[3].other === '')
  check(`${L}: the beneficiary name is a dir-auto bdi`, g[0].name === (rtl ? 'سارة علي' : 'Sara Ali'), g[0].name)
  check(`${L}: state and route words`, g[0].state === 'Awaiting approval' && g[2].state === 'Dispensed' && g[2].route === 'Counter' && g[3].route === 'Route not chosen', `${g[0].state}|${g[2].state}|${g[2].route}|${g[3].route}`)
  check(`${L}: source word`, g[0].source === 'NPHIES' && g[3].source === 'Wasfaty')
  check(`${L}: the step label and owner`, g[0].stepLabel === 'Waiting on payer approval' && g[0].owner === 'PAYER')
  check(`${L}: a parked step with its note, owner customer`, g[2].parked && g[2].note === (rtl ? 'يستلم غدًا' : 'collects tomorrow') && g[2].owner === 'CUSTOMER')
  check(`${L}: no step draws nothing`, g[3].stepLabel === '' && !g[3].parked)
  check(`${L}: lapse day only when about to lapse`, g[1].lapse === '2026-10-26' && g[1].lapseLtr && g[2].lapse === '' && g[0].lapse === '', `${g[1].lapse}|${g[2].lapse}`)
  check(`${L}: open items as words`, g[0].items.join() === 'STALLED=Stalled' && g[1].items.join() === 'LAPSE_WARNING=Lapse warning' && g[2].items.join() === 'INVOICE_OWED=Invoice owed' && g[3].items.length === 0, g.map((r) => r.items.join('+')).join('|'))
  check(`${L}: idle days and dispensed at shown`, g[0].idle === '9' && /2026/.test(g[2].dispensedAt), `${g[0].idle}|${g[2].dispensedAt}`)
  let c = await chips()
  check(`${L}: chip counts from the answer, not the rows`, c.map((x) => `${x.flag}=${x.count}`).join() === 'STALLED=310,ABOUT_TO_LAPSE=12,OWED=87', c.map((x) => `${x.flag}=${x.count}`).join())
  check(`${L}: no chip pressed`, c.every((x) => !x.pressed && !x.disabled))
  check(`${L}: the store field says it matches either store`, /holding store or the other store/.test(await page.locator('[data-ps-store-hint]').textContent()))
  // 548 enabled the slot: the act shows on the DISPENSED row only (its own drive covers the dialog).
  check(`${L}: the row action shows on the DISPENSED row only`, g.map((r) => r.action).join() === 'false,false,true,false', g.map((r) => r.action).join())
  check(`${L}: no truncation notice on a whole answer`, (await page.locator('[data-ps-truncated]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/${L}-list.png`, fullPage: true })

  // ── 2: each chip ────────────────────────────────────────────────────────────────────────────
  for (const flag of ['STALLED', 'ABOUT_TO_LAPSE', 'OWED']) {
    let before = asked.length
    await page.locator(`[data-ps-chip="${flag}"]`).click()
    await settle(before)
    c = await chips()
    check(`${L}: chip ${flag} sets flag in the address and on the wire`, search() === `flag=${flag}` && last().params.flag === flag && Object.keys(last().params).length === 1, `${search()} ${JSON.stringify(last().params)}`)
    check(`${L}: chip ${flag} is the only one pressed`, c.filter((x) => x.pressed).map((x) => x.flag).join() === flag)
    before = asked.length
    await page.locator(`[data-ps-chip="${flag}"]`).click()
    await settle(before)
    check(`${L}: chip ${flag} pressed again clears it`, search() === '' && Object.keys(last().params).length === 0, search())
  }

  // ── 3: filters round-trip ───────────────────────────────────────────────────────────────────
  await page.locator('[data-ps-filter="store"]').fill('P019')
  await page.locator('select[data-ps-filter="state"]').selectOption('PICKING')
  await page.locator('select[data-ps-filter="owner"]').selectOption('DONOR_STORE')
  await page.locator('select[data-ps-filter="source"]').selectOption('WSFT')
  await page.locator('[data-ps-filter="minAge"]').fill('3')
  await page.locator('[data-ps-filter="maxAge"]').fill('30')
  let before = asked.length
  await page.locator('[data-ps-search]').click()
  await settle(before)
  const wantQs = 'store=P019&state=PICKING&owner=DONOR_STORE&source=WSFT&minAge=3&maxAge=30'
  const wantWire = JSON.stringify({ store: 'P019', state: 'PICKING', owner: 'DONOR_STORE', source: 'WSFT', minAgeDays: '3', maxAgeDays: '30' })
  check(`${L}: Search writes every filter to the address`, search() === wantQs, search())
  check(`${L}: Search asks the door with every filter`, JSON.stringify(last().params) === wantWire, JSON.stringify(last().params))
  before = asked.length
  await page.locator('[data-ps-chip="STALLED"]').click()
  await settle(before)
  check(`${L}: a chip keeps the other filters`, search() === `${wantQs}&flag=STALLED` && last().params.flag === 'STALLED' && last().params.store === 'P019', search())
  await open(`?${wantQs}&flag=OWED`)
  const bar = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-ps-filter]')].map((e) => [e.getAttribute('data-ps-filter'), e.value])))
  check(`${L}: a pasted address fills the bar`, JSON.stringify(bar) === JSON.stringify({ store: 'P019', state: 'PICKING', owner: 'DONOR_STORE', source: 'WSFT', minAge: '3', maxAge: '30' }), JSON.stringify(bar))
  check(`${L}: a pasted address asks the same question`, JSON.stringify(last().params) === JSON.stringify({ ...JSON.parse(wantWire), flag: 'OWED' }), JSON.stringify(last().params))
  before = asked.length
  await page.locator('[data-ps-reset]').click()
  await settle(before)
  check(`${L}: Reset clears the address and the bar`, search() === '' && (await page.locator('[data-ps-filter="store"]').inputValue()) === '' && Object.keys(last().params).length === 0, search())

  // ── 4: the Owed view ────────────────────────────────────────────────────────────────────────
  await open('?state=PICKING&store=P019')
  before = asked.length
  await page.locator('[data-ps-view-button="owed"]').click()
  await settle(before)
  check(`${L}: Owed asks Sessions/Owed with the store only`, last().path === 'PrescriptionSessionWeb/Sessions/Owed' && JSON.stringify(last().params) === '{"store":"P019"}', JSON.stringify(last()))
  check(`${L}: Owed keeps only the store in the address`, search() === 'view=owed&store=P019', search())
  check(`${L}: Owed hides the other filters`, (await page.locator('select[data-ps-filter]').count()) === 0 && (await page.locator('[data-ps-filter="minAge"]').count()) === 0)
  c = await chips()
  check(`${L}: in Owed the chips are counts, not filters`, c.every((x) => x.disabled))
  await page.locator('[data-ps-filter="store"]').fill('')
  before = asked.length
  await page.locator('[data-ps-search]').click()
  await settle(before)
  check(`${L}: Owed with no store asks with no parameter`, last().path === 'PrescriptionSessionWeb/Sessions/Owed' && Object.keys(last().params).length === 0 && search() === 'view=owed', JSON.stringify(last()))
  g = await grid()
  check(`${L}: Owed shows the dispensed row`, g.map((r) => r.id).join() === 'PS-55', g.map((r) => r.id).join())
  await page.screenshot({ path: `${SHOTS}/${L}-owed.png`, fullPage: true })
  before = asked.length
  await page.locator('[data-ps-view-button="all"]').click()
  await settle(before)
  check(`${L}: All open asks Sessions again`, last().path === 'PrescriptionSessionWeb/Sessions' && search() === '', search())

  // ── 5: truncated ────────────────────────────────────────────────────────────────────────────
  await open('?store=TRUNC')
  const trunc = page.locator('[data-ps-truncated]')
  const truncNums = await trunc.evaluate((el) => [...el.querySelectorAll('bdi[dir="ltr"]')].map((b) => b.textContent))
  check(`${L}: a truncated answer says oldest-idle N of TOTAL`, (await trunc.count()) === 1 && truncNums.join('/') === '4/2400' && /oldest-idle/.test(await trunc.textContent()), truncNums.join('/'))
  await page.screenshot({ path: `${SHOTS}/${L}-truncated.png`, fullPage: true })

  // ── 6: bare 403 ─────────────────────────────────────────────────────────────────────────────
  await open('?store=DENY')
  const denied = page.locator('[data-ps-denied]')
  check(`${L}: a bare 403 names the missing grant`, (await denied.count()) === 1 && /prescription-session list grant/.test(await denied.textContent()))
  check(`${L}: the denial replaces the list`, (await page.locator('[data-ps-grid]').count()) === 0 && (await page.locator('[data-ps-filters]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/${L}-denied.png`, fullPage: true })

  // ── 7: PSES-00223 ───────────────────────────────────────────────────────────────────────────
  await open('?minAge=9&maxAge=3')
  const bad = page.locator('[data-ps-bad-filter]')
  check(`${L}: PSES-00223 shows the envelope message beside the filters`, (await bad.count()) === 1 && (await bad.textContent()) === 'The age range is reversed: from 9 is after to 3.', await bad.textContent().catch(() => ''))
  check(`${L}: the message is inside the filter bar, no banner`, (await page.locator('[data-ps-filters] [data-ps-bad-filter]').count()) === 1 && (await page.locator('[data-ps-open] [role="alert"]').count()) === 1)
  check(`${L}: the bar stays editable after the refusal`, await page.locator('[data-ps-filter="maxAge"]').isEditable())
  await page.screenshot({ path: `${SHOTS}/${L}-bad-filter.png`, fullPage: true })

  // ── 8: tabs ─────────────────────────────────────────────────────────────────────────────────
  await open('?store=P019')
  await page.locator('[data-ps-tab-button="toOpen"]').click()
  await page.locator('[data-ps-tab-placeholder="toOpen"]').waitFor({ timeout: 5000 })
  check(`${L}: To open is in the address, Open's filters dropped`, search() === 'tab=toOpen', search())
  await page.locator('[data-ps-tab-button="ended"]').click()
  await page.locator('[data-ps-tab-placeholder="ended"]').waitFor({ timeout: 5000 })
  check(`${L}: Ended is in the address`, search() === 'tab=ended' && (await page.locator('[data-ps-open]').count()) === 0)
  await open('?tab=toOpen')
  check(`${L}: a pasted tab opens that tab`, (await page.locator('[data-ps-tab-placeholder="toOpen"]').count()) === 1)
  before = asked.length
  await page.locator('[data-ps-tab-button="open"]').click()
  await settle(before)
  check(`${L}: back to Open asks the list again`, search() === '' && (await page.locator('[data-ps-open]').count()) === 1)

  check(`${L}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await drive('ltr')
await drive('rtl')
await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
