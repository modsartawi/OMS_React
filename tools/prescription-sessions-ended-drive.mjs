// HQ prescription sessions drive — the Ended tab (ticket 547; BackOffice spec 2994 story 71, doors 3015 + 3014).
//
// Drives the REAL app in Chromium against a STUB of `GET PrescriptionSessionWeb/Ended` (no live SIS.Api;
// BackOffice 3015 is on branch spec2994, not deployed). In LTR and RTL (`oms.locale = 'ar'` sets dir="rtl";
// i18n stays `lng: 'en'`), it asserts:
//   1. a bare `tab=ended` asks the last 7 days, today included, and nothing else;
//   2. a closed session with a return and a re-sale: both sales, "was owed", no reason, and under the row
//      the two after-close lines drawn by 544's core renderer (kind, sentence, store · time, by);
//   3. an abandoned session: its reason in words, "never invoiced", route not chosen;
//   4. a written-off session: its reason in words and its Arabic note as a dir-auto bdi;
//   5. machine values ltr-isolated (session, store, sales, times);
//   6. the filters round-trip bar → address → wire, and a pasted address → bar + wire;
//   7. a reversed range and a 93-day range are refused BEFORE sending (no request), with words;
//      a pasted reversed range asks nothing;
//   8. an empty answer says so; a bare 403 → the named denial; a server `PSES-00223` → its message
//      beside the filters.
//
//   1. run the app:  npx vite --port 5211 --strictPort
//   2. DRIVE_PORT=5211 node tools/prescription-sessions-ended-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5211}`
const SHOTS = 'tools/.prescription-sessions-ended-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors: errorCode ? [{ errorCode, errorMessage: message }] : [], data }),
})

const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const now = new Date()
const TODAY = iso(now)
const WEEK_AGO = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6))

const NOTE = 'رفض المريض الاستلام بعد الصرف'
const ended = (id, over = {}) => ({
  sessionId: id,
  displayId: `PS-${id}`,
  sourceKind: 'NPHS',
  holdingStore: 'P001',
  state: 'CLOSED',
  route: 'COUNTER',
  createdAt: '2026-10-18T09:00:00',
  dispensedAt: '2026-10-19T12:00:00',
  endedAt: '2026-10-20T18:30:00',
  endedBy: 'ph.ali',
  endReason: null,
  endNote: null,
  invoiceOwedAt: null,
  saleNos: [],
  wasInvoiced: false,
  afterClose: [],
  ...over,
})
const rows = () => [
  ended('77', {
    saleNos: ['1000123', '1000999'],
    wasInvoiced: true,
    invoiceOwedAt: '2026-10-19T23:59:00',
    afterClose: [
      { kind: 'RETURN', originalSaleNo: '1000123', documentNo: '7000001', resaleNo: null, storeCode: 'P001', recordedAt: '2026-10-21T10:00:00', recordedBy: 'ph.ali' },
      { kind: 'RESALE', originalSaleNo: '1000123', documentNo: '1000999', resaleNo: '1000999', storeCode: 'P001', recordedAt: '2026-10-21T10:05:00', recordedBy: 'ph.ali' },
    ],
  }),
  ended('12', { state: 'ABANDONED', route: null, dispensedAt: null, endReason: 'PATIENT_WITHDREW', endedBy: 'ph.sara', sourceKind: 'WSFT' }),
  ended('55', { state: 'WRITTEN_OFF', endReason: 'OTHER', endNote: NOTE, endedBy: 'hq.user', holdingStore: 'P019', invoiceOwedAt: '2026-10-19T23:59:00' }),
]

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
    if (p === 'PrescriptionSessionWeb/Ended') {
      const params = Object.fromEntries(u.searchParams)
      asked.push({ path: p, params })
      if (params.store === 'DENY') return route.fulfill({ status: 403, contentType: 'text/plain', body: '' })
      if (params.store === 'BAD')
        return route.fulfill(envelope(null, { status: 400, success: false, message: "'X' is not an end state.", errorCode: 'PSES-00223' }))
      if (params.store === 'EMPTY') return route.fulfill(envelope([]))
      return route.fulfill(envelope(rows()))
    }
    return route.fulfill(envelope({}))
  })

  const last = () => asked[asked.length - 1]
  const settle = async (before) => {
    for (let i = 0; i < 30 && asked.length === before; i++) await page.waitForTimeout(100)
    await page.waitForTimeout(400)
  }
  const open = async (qs = '') => {
    const before = asked.length
    await page.goto(`${BASE}/oms/prescription-sessions?tab=ended${qs}`)
    await page.locator('[data-ps-hq]').waitFor({ timeout: 20000 })
    await settle(before)
  }
  const search = () => new URLSearchParams(new URL(page.url()).search).toString()
  const table = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-ps-ended-row]')].map((r) => {
        const id = r.getAttribute('data-ps-ended-row')
        const after = document.querySelector(`[data-ps-ended-after="${id}"]`)
        const td = [...r.querySelectorAll(':scope > td')]
        return {
          id,
          display: td[0]?.querySelector('bdi[dir="ltr"]')?.textContent ?? '',
          source: td[1]?.textContent ?? '',
          store: td[2]?.querySelector('bdi[dir="ltr"]')?.textContent ?? '',
          state: td[3]?.textContent ?? '',
          route: td[4]?.textContent ?? '',
          createdLtr: !!td[5]?.querySelector('bdi[dir="ltr"]'),
          dispensed: td[6]?.textContent ?? '',
          endedAt: r.querySelector('[data-ps-ended-at] bdi[dir="ltr"]')?.textContent ?? '',
          endedBy: r.querySelector('[data-ps-ended-by] bdi:not([dir])')?.textContent ?? '',
          reason: r.querySelector('[data-ps-end-reason]')?.getAttribute('data-ps-end-reason') ?? '',
          reasonText: r.querySelector('[data-ps-end-reason-text]')?.textContent ?? '',
          note: r.querySelector('[data-ps-end-note]')?.textContent ?? '',
          noteBdiAuto: r.querySelector('[data-ps-end-note]')?.tagName === 'BDI' && !r.querySelector('[data-ps-end-note]')?.hasAttribute('dir'),
          sales: [...r.querySelectorAll('[data-ps-sale]')].map((s) => s.querySelector('bdi[dir="ltr"]')?.textContent ?? ''),
          never: r.querySelector('[data-ps-never-invoiced]')?.textContent ?? '',
          owed: r.querySelector('[data-ps-was-owed]')?.textContent ?? '',
          after: after
            ? [...after.querySelectorAll('[data-ps-after-close]')].map((a) => ({
                kind: a.getAttribute('data-ps-after-close'),
                kindText: a.querySelector('[data-ps-after-close-kind]')?.textContent ?? '',
                sentence: a.querySelector('[data-ps-after-close-sentence]')?.textContent ?? '',
                nums: [...(a.querySelector('[data-ps-after-close-sentence]')?.querySelectorAll('bdi[dir="ltr"]') ?? [])].map((b) => b.textContent),
                at: a.querySelector('[data-ps-after-close-at] bdi[dir="ltr"]')?.textContent ?? '',
                by: a.querySelector('[data-ps-after-close-by]')?.textContent ?? '',
              }))
            : [],
        }
      }),
    )

  // ── 1: the default range ────────────────────────────────────────────────────────────────────
  await open()
  check(`${L}: the page is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
  const tabs = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].map((b) => `${b.getAttribute('data-ps-tab-button')}:${b.getAttribute('aria-selected')}`))
  check(`${L}: the Ended tab is selected`, tabs.join(',') === 'open:false,toOpen:false,ended:true', tabs.join(','))
  check(`${L}: a bare tab=ended asks the last 7 days and nothing else`, last()?.path === 'PrescriptionSessionWeb/Ended' && JSON.stringify(last().params) === JSON.stringify({ from: WEEK_AGO, to: TODAY }), JSON.stringify(last()))
  const barDates = await page.evaluate(() => [...document.querySelectorAll('[data-ps-ended-filter="from"],[data-ps-ended-filter="to"]')].map((e) => e.value))
  check(`${L}: the bar shows the default range`, barDates.join('|') === `${WEEK_AGO}|${TODAY}`, barDates.join('|'))
  await page.locator('[data-ps-ended-row]').first().waitFor({ timeout: 10000 })
  let g = await table()
  check(`${L}: three rows in server order`, g.map((r) => r.id).join() === '77,12,55', g.map((r) => r.id).join())

  // ── 2: closed with a return and a re-sale ───────────────────────────────────────────────────
  const c = g[0]
  check(`${L}: closed — state word, source, route`, c.state === 'Closed' && c.source === 'NPHIES' && c.route === 'Counter', `${c.state}|${c.source}|${c.route}`)
  check(`${L}: closed — both sales, each isolated`, c.sales.join() === '1000123,1000999', c.sales.join())
  check(`${L}: closed — was owed`, c.owed === 'Was owed' && c.never === '')
  check(`${L}: closed — no end reason`, c.reason === '' && c.reasonText === '' && c.note === '')
  check(`${L}: closed — two after-close lines under the row`, c.after.map((a) => a.kind).join() === 'RETURN,RESALE', JSON.stringify(c.after))
  check(`${L}: the return line reads as on Details`, c.after[0]?.kindText === 'Return' && c.after[0]?.sentence === 'Returned 7000001 (sale 1000123)' && c.after[0]?.nums.join() === '7000001,1000123', JSON.stringify(c.after[0]))
  check(`${L}: the re-sale line reads as on Details`, c.after[1]?.kindText === 'Re-sale' && c.after[1]?.sentence === 'Re-sold as 1000999 (after sale 1000123)', c.after[1]?.sentence)
  check(`${L}: an after-close line's store · time is one isolate`, /^P001 · .*2026/.test(c.after[0]?.at ?? '') && /ph\.ali/.test(c.after[0]?.by ?? ''), `${c.after[0]?.at}|${c.after[0]?.by}`)

  // ── 3: abandoned ────────────────────────────────────────────────────────────────────────────
  const a = g[1]
  check(`${L}: abandoned — reason in words`, a.state === 'Abandoned' && a.reason === 'PATIENT_WITHDREW' && a.reasonText === 'Patient withdrew', `${a.state}|${a.reasonText}`)
  check(`${L}: abandoned — never invoiced, no sale`, a.never === 'Never invoiced' && a.sales.length === 0 && a.owed === '')
  check(`${L}: abandoned — route not chosen, Wasfaty, no after-close`, a.route === 'Route not chosen' && a.source === 'Wasfaty' && a.after.length === 0 && a.dispensed === '', `${a.route}|${a.source}`)

  // ── 4: written off with an Arabic note ──────────────────────────────────────────────────────
  const w = g[2]
  check(`${L}: written off — reason in words`, w.state === 'Written off' && w.reason === 'OTHER' && w.reasonText === 'Other', `${w.state}|${w.reasonText}`)
  check(`${L}: written off — the Arabic note as a dir-auto bdi`, w.note === NOTE && w.noteBdiAuto, w.note)
  check(`${L}: written off — never invoiced, was owed`, w.never === 'Never invoiced' && w.owed === 'Was owed')

  // ── 5: isolation ────────────────────────────────────────────────────────────────────────────
  check(`${L}: session, store and times are ltr-isolated`, g.every((r) => r.display === `PS-${r.id}` && r.store && r.createdLtr && /2026/.test(r.endedAt)), JSON.stringify(g.map((r) => [r.display, r.store, r.endedAt])))
  check(`${L}: ended by is a dir-auto bdi`, g.map((r) => r.endedBy).join() === 'ph.ali,ph.sara,hq.user', g.map((r) => r.endedBy).join())
  const count = await page.locator('[data-status-count]').textContent()
  check(`${L}: the status bar counts the rows`, /3/.test(count) && /sessions/.test(count), count)
  await page.screenshot({ path: `${SHOTS}/${L}-list.png`, fullPage: true })

  // ── 6: filters round-trip ───────────────────────────────────────────────────────────────────
  await page.locator('[data-ps-ended-filter="from"]').fill('2026-09-01')
  await page.locator('[data-ps-ended-filter="to"]').fill('2026-09-30')
  await page.locator('[data-ps-ended-filter="store"]').fill(' P019 ')
  await page.locator('[data-ps-ended-filter="state"]').selectOption('WRITTEN_OFF')
  let before = asked.length
  await page.locator('[data-ps-ended-search]').click()
  await settle(before)
  const wantQs = 'tab=ended&from=2026-09-01&to=2026-09-30&store=P019&state=WRITTEN_OFF'
  const wantWire = JSON.stringify({ from: '2026-09-01', to: '2026-09-30', store: 'P019', state: 'WRITTEN_OFF' })
  check(`${L}: Search writes every filter to the address`, search() === wantQs, search())
  check(`${L}: Search asks the door with every filter`, JSON.stringify(last().params) === wantWire, JSON.stringify(last().params))
  await open('&from=2026-08-01&to=2026-08-31&store=P002&state=ABANDONED')
  const bar = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-ps-ended-filter]')].map((e) => [e.getAttribute('data-ps-ended-filter'), e.value])))
  check(`${L}: a pasted address fills the bar`, JSON.stringify(bar) === JSON.stringify({ from: '2026-08-01', to: '2026-08-31', store: 'P002', state: 'ABANDONED' }), JSON.stringify(bar))
  check(`${L}: a pasted address asks the same question`, JSON.stringify(last().params) === JSON.stringify({ from: '2026-08-01', to: '2026-08-31', store: 'P002', state: 'ABANDONED' }), JSON.stringify(last().params))
  before = asked.length
  await page.locator('[data-ps-ended-reset]').click()
  await settle(before)
  check(`${L}: Reset returns to the last 7 days, every store`, search() === `tab=ended&from=${WEEK_AGO}&to=${TODAY}` && JSON.stringify(last().params) === JSON.stringify({ from: WEEK_AGO, to: TODAY }), search())

  // ── 7: the range refused before sending ─────────────────────────────────────────────────────
  await page.locator('[data-ps-ended-filter="from"]').fill('2026-10-10')
  await page.locator('[data-ps-ended-filter="to"]').fill('2026-10-01')
  before = asked.length
  await page.locator('[data-ps-ended-search]').click()
  await page.waitForTimeout(600)
  let refusal = page.locator('[data-ps-ended-range]')
  check(`${L}: a reversed range is refused before sending`, asked.length === before && (await refusal.getAttribute('data-ps-ended-range')) === 'reversed' && /reversed/.test(await refusal.textContent()), `${asked.length - before} sent`)
  check(`${L}: the refused range does not reach the address`, !search().includes('2026-10-10'), search())
  await page.locator('[data-ps-ended-filter="from"]').fill('2026-06-30')
  await page.locator('[data-ps-ended-filter="to"]').fill('2026-09-30')
  before = asked.length
  await page.locator('[data-ps-ended-search]').click()
  await page.waitForTimeout(600)
  refusal = page.locator('[data-ps-ended-range]')
  const days = await refusal.evaluate((el) => el.querySelector('bdi[dir="ltr"]')?.textContent ?? '')
  check(`${L}: a 93-day range is refused before sending, naming 92`, asked.length === before && (await refusal.getAttribute('data-ps-ended-range')) === 'tooWide' && days === '92', `${asked.length - before} sent, ${days}`)
  await page.locator('[data-ps-ended-filter="from"]').fill('2026-07-01')
  before = asked.length
  await page.locator('[data-ps-ended-search]').click()
  await settle(before)
  check(`${L}: 92 days counting both ends is sent`, asked.length > before && last().params.from === '2026-07-01' && last().params.to === '2026-09-30' && (await page.locator('[data-ps-ended-range]').count()) === 0, JSON.stringify(last().params))
  before = asked.length
  await page.goto(`${BASE}/oms/prescription-sessions?tab=ended&from=2026-10-10&to=2026-10-01`)
  await page.locator('[data-ps-ended]').waitFor({ timeout: 20000 })
  await page.waitForTimeout(800)
  check(`${L}: a pasted reversed range asks nothing and says why`, asked.length === before && (await page.locator('[data-ps-ended-range="reversed"]').count()) === 1 && (await page.locator('[data-ps-ended-table]').count()) === 0, `${asked.length - before} sent`)
  await page.screenshot({ path: `${SHOTS}/${L}-reversed.png`, fullPage: true })

  // ── 8: empty, 403, PSES-00223 ───────────────────────────────────────────────────────────────
  await open('&store=EMPTY')
  check(`${L}: an empty answer says no session ended`, (await page.locator('[data-ps-ended-empty]').count()) === 1 && (await page.locator('[data-ps-ended-row]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/${L}-empty.png`, fullPage: true })
  await open('&store=DENY')
  check(`${L}: a bare 403 names the missing grant`, (await page.locator('[data-ps-denied]').count()) === 1 && (await page.locator('[data-ps-ended-table]').count()) === 0)
  await open('&store=BAD')
  const bad = page.locator('[data-ps-ended-filters] [data-ps-bad-filter]')
  check(`${L}: PSES-00223 shows the envelope message beside the filters`, (await bad.count()) === 1 && (await bad.textContent()) === "'X' is not an end state.", await bad.textContent().catch(() => ''))
  check(`${L}: no banner beside it`, (await page.locator('[data-ps-ended] [role="alert"]').count()) === 1)

  check(`${L}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await drive('ltr')
await drive('rtl')
await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
