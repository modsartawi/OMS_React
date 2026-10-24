// HQ prescription sessions drive — the To open tab (ticket 546; BackOffice spec 2994, door 3015).
//
// Drives the REAL app in Chromium against a STUB of `GET PrescriptionSessionWeb/ToOpen` (no live
// SIS.Api; BackOffice 3015 is on branch spec2994, not deployed). In LTR and RTL (`oms.locale = 'ar'`
// sets dir="rtl"), it asserts:
//   1. the tab asks ToOpen with NO parameter; `total` at the top; one folded group per store, oldest
//      first (the stub sends them NOT in that order); each header: store, count, oldest age, isolated;
//   2. unfolding a group shows its orders (type, source, patient id, approval number, ordered at,
//      age, all isolated); the BKOF bulk-upload marker on the BKOF order only;
//   3. the capped-group notice only on the group whose orders < count;
//   4. `byUpload: true` changes nothing (still by store);
//   5. the store filter: bar → address (`tab=toOpen&store=…`) → wire, a pasted address → bar + wire,
//      Reset clears it;
//   6. an empty answer says so;
//   7. a bare 403 → the named denial;
//   8. the order number links to that order's Details.
//
//   1. run the app:  npx vite --port 5211 --strictPort
//   2. DRIVE_PORT=5211 node tools/prescription-sessions-to-open-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5211}`
const SHOTS = 'tools/.prescription-sessions-to-open-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '' } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors: [], data }),
})

const order = (documentNo, over = {}) => ({
  documentNo,
  documentType: 'ZPRS',
  sourceKind: 'NPHS',
  documentSource: '',
  patientId: '1012345678',
  approvalNumber: `AP-${documentNo}`,
  orderedAt: '2026-10-20T09:00:00',
  ageDays: 4,
  ...over,
})

// Deliberately NOT oldest first: P002 (newest) first, P001 (oldest) last.
const answer = (over = {}) => ({
  stores: [
    { storeCode: 'P002', count: 1, oldestAgeDays: 2, oldestOrderedAt: '2026-10-22T08:00:00', orders: [order('3000000001', { ageDays: 2, orderedAt: '2026-10-22T08:00:00' })] },
    {
      storeCode: 'P009',
      count: 5,
      oldestAgeDays: 11,
      oldestOrderedAt: '2026-10-13T10:00:00',
      orders: [
        order('2000000001', { documentSource: 'BKOF', ageDays: 11, orderedAt: '2026-10-13T10:00:00' }),
        order('2000000002', { sourceKind: 'WSFT', ageDays: 9, orderedAt: '2026-10-15T14:30:00' }),
      ],
    },
    {
      storeCode: 'P001',
      count: 2,
      oldestAgeDays: 12,
      oldestOrderedAt: '2026-10-12T09:30:00',
      orders: [order('1000000001', { ageDays: 12, orderedAt: '2026-10-12T09:30:00' }), order('1000000002', { ageDays: 3 })],
    },
  ],
  total: 8,
  byUpload: false,
  ...over,
})

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
    if (p === 'PrescriptionSessionWeb/ToOpen') {
      const params = Object.fromEntries(u.searchParams)
      asked.push({ path: p, params })
      if (params.store === 'DENY') return route.fulfill({ status: 403, contentType: 'text/plain', body: '' })
      if (params.store === 'NONE') return route.fulfill(envelope({ stores: [], total: 0, byUpload: false }))
      if (params.store === 'UPLD') return route.fulfill(envelope(answer({ byUpload: true })))
      if (params.store === 'P009') return route.fulfill(envelope(answer({ stores: answer().stores.filter((s) => s.storeCode === 'P009'), total: 5 })))
      return route.fulfill(envelope(answer()))
    }
    return route.fulfill(envelope({}))
  })

  const last = () => asked[asked.length - 1]
  const settle = async (before) => {
    for (let i = 0; i < 50 && asked.length === before; i++) await page.waitForTimeout(100)
    await page.waitForTimeout(400)
  }
  const open = async (qs = '?tab=toOpen') => {
    const before = asked.length
    await page.goto(`${BASE}/oms/prescription-sessions${qs}`)
    await page.locator('[data-ps-hq]').waitFor({ timeout: 20000 })
    await settle(before)
  }
  const search = () => new URLSearchParams(new URL(page.url()).search).toString()
  const groups = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-ps-to-open-group]')].map((g) => ({
        store: g.getAttribute('data-ps-to-open-group'),
        storeLtr: g.querySelector('[data-ps-to-open-store-code] bdi[dir="ltr"]')?.textContent ?? '',
        count: g.querySelector('[data-ps-to-open-count]')?.getAttribute('data-ps-to-open-count') ?? '',
        countLtr: g.querySelector('[data-ps-to-open-count] bdi[dir="ltr"]')?.textContent ?? '',
        countText: g.querySelector('[data-ps-to-open-count]')?.textContent ?? '',
        oldestLtr: g.querySelector('[data-ps-to-open-oldest] bdi[dir="ltr"]')?.textContent ?? '',
        oldestText: g.querySelector('[data-ps-to-open-oldest]')?.textContent ?? '',
        open: g.getAttribute('data-ps-open') === 'true',
        expanded: g.querySelector('[data-ps-to-open-toggle]')?.getAttribute('aria-expanded'),
        capped: g.querySelector('[data-ps-to-open-capped]')?.textContent ?? null,
        cappedLtr: [...(g.querySelector('[data-ps-to-open-capped]')?.querySelectorAll('bdi[dir="ltr"]') ?? [])].map((b) => b.textContent),
        orders: [...g.querySelectorAll('[data-ps-to-open-order]')].map((r) => {
          const tds = [...r.querySelectorAll('td')]
          return {
            no: r.getAttribute('data-ps-to-open-order'),
            href: r.querySelector('[data-ps-to-open-link]')?.getAttribute('href') ?? '',
            noLtr: r.querySelector('[data-ps-to-open-link] bdi[dir="ltr"]')?.textContent ?? '',
            type: tds[1]?.querySelector('bdi[dir="ltr"]')?.textContent ?? '',
            source: r.querySelector('[data-ps-to-open-source]')?.getAttribute('data-ps-to-open-source') ?? '',
            sourceText: r.querySelector('[data-ps-to-open-source] > span:first-child')?.textContent ?? '',
            bulk: r.querySelector('[data-ps-to-open-bulk]')?.textContent ?? null,
            patient: tds[3]?.querySelector('bdi[dir="ltr"]')?.textContent ?? '',
            approval: tds[4]?.querySelector('bdi[dir="ltr"]')?.textContent ?? '',
            at: tds[5]?.querySelector('bdi[dir="ltr"]')?.textContent ?? '',
            age: tds[6]?.querySelector('bdi[dir="ltr"]')?.textContent ?? '',
          }
        }),
      })),
    )
  const unfold = async (store) => {
    await page.locator(`[data-ps-to-open-toggle="${store}"]`).click()
    await page.waitForTimeout(150)
  }

  // ── 1. the list, folded ────────────────────────────────────────────────────
  await open()
  check(`${L}: page dir`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
  check(`${L}: To open tab selected`, (await page.locator('[data-ps-tab-button="toOpen"]').getAttribute('aria-selected')) === 'true')
  check(`${L}: asks ToOpen with no parameter`, last()?.path === 'PrescriptionSessionWeb/ToOpen' && Object.keys(last().params).length === 0, JSON.stringify(last()))
  const total = page.locator('[data-ps-to-open-total]')
  check(`${L}: total at the top`, (await total.getAttribute('data-ps-to-open-total')) === '8' && (await total.locator('bdi[dir="ltr"]').textContent()) === '8', await total.textContent())
  let g = await groups()
  check(`${L}: one group per store, oldest first`, g.map((x) => x.store).join(',') === 'P001,P009,P002', g.map((x) => x.store).join(','))
  check(`${L}: every group folded`, g.every((x) => !x.open && x.expanded === 'false' && x.orders.length === 0))
  check(`${L}: header store isolated`, g.map((x) => x.storeLtr).join(',') === 'P001,P009,P002')
  check(`${L}: header count isolated`, g.map((x) => x.countLtr).join(',') === '2,5,1', g.map((x) => x.countText).join(' | '))
  check(`${L}: header oldest age isolated`, g.map((x) => x.oldestLtr).join(',') === '12,11,2', g.map((x) => x.oldestText).join(' | '))
  // RTL drives keep `lng: 'en'` (only dir flips), so the words are the English plurals in both.
  check(`${L}: header words, plural-aware`, g[1].countText === '5 orders' && g[2].countText === '1 order' && g[0].oldestText === 'Oldest 12 days', `${g[1].countText} | ${g[2].countText} | ${g[0].oldestText}`)

  // ── 2. unfolded orders ─────────────────────────────────────────────────────
  await unfold('P009')
  g = await groups()
  const p009 = g.find((x) => x.store === 'P009')
  check(`${L}: P009 unfolds`, p009.open && p009.expanded === 'true')
  check(`${L}: P009 lists its orders oldest first`, p009.orders.map((o) => o.no).join(',') === '2000000001,2000000002')
  const [bk, ws] = p009.orders
  check(`${L}: BKOF marker on the BKOF order`, bk.bulk === 'Bulk upload', String(bk.bulk))
  check(`${L}: no marker on the other order`, ws.bulk === null)
  check(`${L}: source words`, bk.source === 'NPHS' && ws.source === 'WSFT' && bk.sourceText !== '' && bk.sourceText !== ws.sourceText, `${bk.sourceText} | ${ws.sourceText}`)
  check(`${L}: machine values isolated`, bk.noLtr === '2000000001' && bk.type === 'ZPRS' && bk.patient === '1012345678' && bk.approval === 'AP-2000000001' && bk.age === '11', JSON.stringify(bk))
  check(`${L}: ordered at, wall-clock as sent`, ws.at === '2026-10-15 14:30', ws.at)
  check(`${L}: other groups stay folded`, g.filter((x) => x.store !== 'P009').every((x) => !x.open))

  // ── 3. capped notice ───────────────────────────────────────────────────────
  check(`${L}: capped notice on P009 (2 of 5)`, p009.capped !== null && p009.cappedLtr.join(',') === '2,5', String(p009.capped))
  await unfold('P001')
  await unfold('P002')
  g = await groups()
  check(`${L}: no capped notice when every order is listed`, g.filter((x) => x.store !== 'P009').every((x) => x.open && x.capped === null))
  await page.screenshot({ path: `${SHOTS}/${dir}-groups.png`, fullPage: true })
  await unfold('P001')
  g = await groups()
  check(`${L}: a group folds again`, !g.find((x) => x.store === 'P001').open)

  // ── 8. the link to Details ─────────────────────────────────────────────────
  const link = page.locator('[data-ps-to-open-link="2000000001"]')
  check(`${L}: order number links to its Details`, (await link.getAttribute('href')) === '/oms/document/2000000001')
  await link.click()
  await page.waitForURL(/\/oms\/document\/2000000001/, { timeout: 5000 }).catch(() => {})
  check(`${L}: clicking it opens the order's Details`, new URL(page.url()).pathname === '/oms/document/2000000001', page.url())

  // ── 5. store filter ────────────────────────────────────────────────────────
  await open()
  let before = asked.length
  await page.locator('[data-ps-to-open-store]').fill('P009')
  check(`${L}: typing alone does not ask`, asked.length === before)
  await page.locator('[data-ps-to-open-search]').click()
  await settle(before)
  check(`${L}: Search writes the store to the address`, search() === 'tab=toOpen&store=P009', search())
  check(`${L}: and asks ToOpen with it`, last()?.params.store === 'P009' && Object.keys(last().params).length === 1, JSON.stringify(last()))
  g = await groups()
  check(`${L}: only P009 shown`, g.map((x) => x.store).join(',') === 'P009')
  await open('?tab=toOpen&store=P002')
  check(`${L}: a pasted address fills the bar`, (await page.locator('[data-ps-to-open-store]').inputValue()) === 'P002')
  check(`${L}: and asks with its store`, last()?.params.store === 'P002', JSON.stringify(last()))
  before = asked.length
  await page.locator('[data-ps-to-open-reset]').click()
  await settle(before)
  check(`${L}: Reset clears the store`, search() === 'tab=toOpen' && (await page.locator('[data-ps-to-open-store]').inputValue()) === '', search())
  check(`${L}: Reset asks with no parameter`, Object.keys(last()?.params ?? { x: 1 }).length === 0, JSON.stringify(last()))

  // ── 4. byUpload ignored ────────────────────────────────────────────────────
  await open('?tab=toOpen&store=UPLD')
  g = await groups()
  check(`${L}: byUpload true is ignored (still by store)`, g.map((x) => x.store).join(',') === 'P001,P009,P002')

  // ── 6. empty ───────────────────────────────────────────────────────────────
  await open('?tab=toOpen&store=NONE')
  check(`${L}: an empty answer says so`, (await page.locator('[data-ps-to-open-empty]').count()) === 1 && (await groups()).length === 0)
  check(`${L}: empty total reads zero`, (await total.getAttribute('data-ps-to-open-total')) === '0')

  // ── 7. bare 403 ────────────────────────────────────────────────────────────
  await open('?tab=toOpen&store=DENY')
  check(`${L}: a bare 403 → the named denial`, (await page.locator('[data-ps-denied]').count()) === 1 && (await page.locator('[data-ps-to-open]').count()) === 0)

  check(`${L}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

try {
  await drive('ltr')
  await drive('rtl')
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
