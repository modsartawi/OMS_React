// Donor requests drive (ticket 431, spec 430 D2/D3/D9/D18).
//
// Drives the REAL app in Chromium against a STUB of the spec 430 wire contract — the door
// (`GET SdDocumentWeb/DonorRequests`, BackOffice ask BO-2) is NOT built, so there is no live
// SIS.Api to point at. Stubbed, exactly as D2/D3 propose (plus the `requestNo` param 431 adds):
//   GET SdDocumentWeb/Access          → { canOpenList, canOpenDetail, canOpenDonorRequests? }
//   GET SdDocumentWeb/DonorRequests   → { rows: DonorRequestModel[], limited }
// In LTR and RTL (`oms.locale = 'ar'` sets dir="rtl"; i18n stays `lng: 'en'`), it asserts:
//   1. without the flag (an older server that omits it) the leaf is hidden and the URL shows
//      the denied card, with no list call;
//   2. with it, the leaf sits right after Central invoices, and the group costs ONE probe call;
//   3. the screen opens on today: fromDate = toDate = today, no state, no store;
//   4. refused/expired rows are amber (attention), a cancelled one muted, a cancel after pick is
//      marked, an open unpicked one shows its wait and a picked one its pick time;
//   5. the status bar counts the rows, and says "showing the first N" when `limited`;
//   6. the filters reach the wire: state as a REPEATED key, both stores, both days;
//   7. `?request=<no>` seeds a request-only search with no date bound;
//   8. a business refusal from the door is shown with its own message;
//   9. store codes are isolated; no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/donor-requests-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.donor-requests-shots'
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

const pad = (n) => String(n).padStart(2, '0')
const day = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
/** A local wall-clock ISO time, as SIS.Api sends them (no zone). */
const local = (d) => `${day(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
const TODAY = day(new Date())
const ago = (minutes) => local(new Date(Date.now() - minutes * 60_000 - 5_000))

const UNSET = '0001-01-01T00:00:00'
const request = (requestNo, over) => ({
  requestNo,
  deliveryNo: '8000000500',
  orderStore: 'P019',
  donorStore: 'D012',
  state: 'OPEN',
  outcome: '',
  outcomeReason: '',
  outcomeBy: '',
  outcomeAt: UNSET,
  raisedBy: 'store.p019',
  raisedAt: ago(300),
  changedBy: '',
  changedAt: UNSET,
  fulfilledAt: UNSET,
  lockedBy: '',
  lockedAt: UNSET,
  transferStoNo: '',
  transferSapDocumentNo: '',
  transferredAt: UNSET,
  picked: 0,
  required: 3,
  ...over,
})

function todaysRows(rtl) {
  return [
    // Raised 80 minutes and a few seconds ago, nobody has picked it: "Waiting 1h 20m".
    request('DR1', { raisedAt: ago(80) }),
    request('DR2', {
      donorStore: 'D044',
      state: 'CANCELLED',
      outcome: 'REFUSED',
      outcomeReason: rtl ? 'لا يوجد مخزون' : 'No stock on the shelf',
      outcomeAt: ago(200),
      required: 1,
    }),
    request('DR3', { state: 'CANCELLED', outcome: 'EXPIRED', outcomeAt: ago(100) }),
    request('DR4', {
      state: 'CANCELLED',
      outcome: 'CANCELLED',
      fulfilledAt: ago(250),
      picked: 3,
      outcomeAt: ago(220),
    }),
    // Raised 300 minutes ago, picked 25 minutes later.
    request('DR5', {
      donorStore: 'D077',
      state: 'TRANSFERRED',
      fulfilledAt: ago(275),
      picked: 3,
      transferStoNo: '4500001234',
      transferredAt: ago(200),
    }),
  ]
}

const browser = await chromium.launch()

async function open(dir, { grant, list = 'today' }) {
  const rtl = dir === 'rtl'
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const listQueries = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    calls.push(p)
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access')
      return route.fulfill(
        envelope(grant ? { canOpenList: true, canOpenDetail: true, canOpenDonorRequests: true } : { canOpenList: true, canOpenDetail: true }),
      )
    if (p === 'Sd/CentralInvoice/Access') return route.fulfill(envelope({ canOpen: true }))
    if (p === 'SdDocumentWeb/DonorRequests') {
      listQueries.push(url.searchParams)
      const mode = typeof list === 'function' ? list(url.searchParams) : list
      if (mode === 'refused')
        return route.fulfill(envelope(null, { status: 403, success: false, message: 'Donor request inquiry is not granted to you.' }))
      if (mode === 'limited') return route.fulfill(envelope({ rows: todaysRows(rtl).slice(0, 2), limited: true }))
      // A server that has not learned `requestNo` ignores it and answers everything it holds.
      if (mode === 'ignores')
        return route.fulfill(envelope({ rows: [...todaysRows(rtl), request('DR77', { raisedAt: '2026-09-01T09:00:00' })], limited: false }))
      return route.fulfill(envelope({ rows: todaysRows(rtl), limited: false }))
    }
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, listQueries }
}

const omsLinks = (page) =>
  page.locator('nav a[href^="/oms/"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')))])

const waitRows = async (page, n) => {
  await page.waitForFunction((count) => document.querySelectorAll('[data-donor-list] .ag-row').length === count, n, { timeout: 20000 })
  await page.waitForTimeout(150)
}

/** One row's cells, by column id, as drawn. */
const rowOf = (page, requestNo) =>
  page.evaluate((no) => {
    const rows = [...document.querySelectorAll('[data-donor-list] .ag-row')]
    const row = rows.find((r) => r.querySelector('[col-id="requestNo"]')?.textContent === no)
    if (!row) return null
    const cell = (id) => row.querySelector(`[col-id="${id}"]`)
    const probe = document.createElement('div')
    probe.style.color = 'var(--attention-800)'
    document.body.appendChild(probe)
    const amber = getComputedStyle(probe).color
    probe.remove()
    const badge = cell('outcome')?.querySelector('[data-donor-tone] > span')
    return {
      outcome: cell('outcome')?.textContent ?? '',
      tone: cell('outcome')?.querySelector('[data-donor-tone]')?.getAttribute('data-donor-tone') ?? null,
      amber: badge ? getComputedStyle(badge).color === amber : false,
      pickTime: cell('pickTime')?.textContent ?? '',
      waiting: !!cell('pickTime')?.querySelector('[data-donor-waiting]'),
      muted: row.classList.contains('text-muted-foreground'),
      donorStoreIsolated: !!cell('donorStore')?.querySelector('bdi'),
    }
  }, requestNo)

const statusText = (page) => page.locator('[data-status-count]').innerText()

async function drive(dir) {
  const label = dir

  // ── 1: no flag → hidden leaf, denied card, no list call ─────────────────────────────────────
  {
    const { context, page, errors, calls } = await open(dir, { grant: false })
    await page.goto(`${BASE}/oms/deliveries`)
    await page.locator('nav a[href="/oms/deliveries"]').first().waitFor({ timeout: 20000 })
    await page.waitForTimeout(400)
    const links = await omsLinks(page)
    check(`${label}: without the flag the Donor requests leaf is hidden`, !links.includes('/oms/donor-requests'), links.join(' · '))
    await page.goto(`${BASE}/oms/donor-requests`)
    const card = page.locator('[role="alert"]', { hasText: 'No access to donor requests' })
    await card.waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    check(
      `${label}: the URL shows the denied card and never asks for the list`,
      (await card.count()) === 1 && !calls.includes('SdDocumentWeb/DonorRequests'),
      calls.filter((c) => /Donor/.test(c)).join(','),
    )
    check(`${label}: no page errors (denied)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 2–6, 9: granted ─────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, calls, listQueries } = await open(dir, {
      grant: true,
      list: (q) => (q.getAll('state').length ? 'limited' : 'today'),
    })
    // On an OMS screen, so the rail's OMS group is the open one.
    await page.goto(`${BASE}/oms/deliveries`)
    await page.locator('nav a[href="/oms/donor-requests"]').first().waitFor({ timeout: 20000 })
    const links = await omsLinks(page)
    check(
      `${label}: the leaf sits right after Central invoices`,
      links.indexOf('/oms/donor-requests') === links.indexOf('/oms/central-invoices') + 1 && links.indexOf('/oms/central-invoices') >= 0,
      links.join(' · '),
    )
    await page.locator('nav a[href="/oms/donor-requests"]').first().click()
    await waitRows(page, 5)
    check(
      `${label}: the OMS group and the page gate cost ONE probe call`,
      calls.filter((c) => c === 'SdDocumentWeb/Access').length === 1,
      String(calls.filter((c) => c === 'SdDocumentWeb/Access').length),
    )
    const first = listQueries[0]
    check(
      `${label}: opens on today — fromDate = toDate = today, no state, no store`,
      first?.get('fromDate') === TODAY && first?.get('toDate') === TODAY && [...first.keys()].sort().join(',') === 'fromDate,toDate',
      first?.toString(),
    )

    const dr1 = await rowOf(page, 'DR1')
    const dr2 = await rowOf(page, 'DR2')
    const dr3 = await rowOf(page, 'DR3')
    const dr4 = await rowOf(page, 'DR4')
    const dr5 = await rowOf(page, 'DR5')
    check(`${label}: an open, unpicked request shows its wait`, dr1?.waiting && dr1.pickTime === 'Waiting 1h 20m', JSON.stringify(dr1))
    check(`${label}: a refused request is amber`, dr2?.tone === 'attention' && dr2.amber && dr2.outcome === 'Refused', JSON.stringify(dr2))
    check(`${label}: an expired request is amber`, dr3?.tone === 'attention' && dr3.amber && dr3.outcome === 'Expired', JSON.stringify(dr3))
    check(
      `${label}: a cancel after pick is marked, and muted`,
      dr4?.tone === 'muted' && !dr4.amber && dr4.muted && dr4.outcome === 'Cancelled after pick',
      JSON.stringify(dr4),
    )
    check(`${label}: a picked request shows its pick time, no wait`, dr5 && !dr5.waiting && dr5.pickTime === 'Picked in 25m' && dr5.tone === null, JSON.stringify(dr5))
    check(`${label}: store codes are isolated`, [dr1, dr2, dr5].every((r) => r?.donorStoreIsolated))
    const count = await statusText(page)
    check(
      `${label}: the status bar counts the rows`,
      /^5 donor requests$/.test(count.trim()) && (await page.locator('[data-status-count] bdi[dir="ltr"]').count()) === 1,
      count,
    )
    check(`${label}: dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    await page.screenshot({ path: `${SHOTS}/${dir}-today.png` })

    // 6: filters on the wire
    await page.locator('[data-donor-state="OPEN"]').check()
    await page.locator('[data-donor-state="CANCELLED"]').check()
    await page.locator('[data-donor-filter="donorStore"]').fill(' D012 ')
    await page.locator('[data-donor-filter="orderStore"]').fill('P019')
    await page.locator('[data-donor-filter="from"]').fill('2026-10-01')
    await page.locator('[data-donor-filter="to"]').fill('2026-10-05')
    await page.locator('[data-donor-search]').click()
    await waitRows(page, 2)
    const q = listQueries.at(-1)
    check(
      `${label}: the filters reach the wire — state repeated, stores trimmed, both days`,
      q?.getAll('state').join(',') === 'OPEN,CANCELLED' &&
        q.get('donorStore') === 'D012' &&
        q.get('orderStore') === 'P019' &&
        q.get('fromDate') === '2026-10-01' &&
        q.get('toDate') === '2026-10-05' &&
        !q.has('requestNo'),
      q?.toString(),
    )
    const limited = await statusText(page)
    check(
      `${label}: a limited answer says "showing the first N"`,
      /Showing the first 2 donor requests/.test(limited) && (await page.locator('[data-status-count][data-limited]').count()) === 1,
      limited,
    )
    await page.screenshot({ path: `${SHOTS}/${dir}-limited.png` })
    check(`${label}: no page errors (granted)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 7: ?request= seeds a request-only search ────────────────────────────────────────────────
  {
    const { context, page, errors, listQueries } = await open(dir, {
      grant: true,
      list: (q) => (q.has('requestNo') ? 'ignores' : 'today'),
    })
    await page.goto(`${BASE}/oms/donor-requests?request=DR77`)
    await waitRows(page, 1)
    const q = listQueries[0]
    check(
      `${label}: ?request= asks for that one request with no date bound`,
      q && [...q.keys()].join(',') === 'requestNo' && q.get('requestNo') === 'DR77',
      q?.toString(),
    )
    const seed = await page.locator('[data-donor-request-seed]').innerText()
    check(`${label}: the screen says it shows that request only`, /DR77/.test(seed) && (await page.locator('[data-donor-request-seed] bdi[dir="ltr"]').count()) === 1, seed)
    check(`${label}: the date boxes are empty`, (await page.locator('[data-donor-filter="from"]').inputValue()) === '')
    check(
      `${label}: a server that ignores requestNo still shows only that request`,
      (await rowOf(page, 'DR77')) !== null && (await rowOf(page, 'DR1')) === null,
    )
    await page.locator('[data-donor-request-seed] button').click()
    await waitRows(page, 5)
    const back = listQueries.at(-1)
    check(
      `${label}: "Back to today" drops the param and asks for today`,
      !new URL(page.url()).searchParams.has('request') && back?.get('fromDate') === TODAY && !back.has('requestNo') &&
        (await page.locator('[data-donor-request-seed]').count()) === 0,
      `${page.url()} ${back?.toString()}`,
    )
    check(`${label}: no page errors (seeded)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 8: a refusal from the door ──────────────────────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir, { grant: true, list: 'refused' })
    await page.goto(`${BASE}/oms/donor-requests`)
    const banner = page.locator('[role="alert"]', { hasText: 'Donor request inquiry is not granted to you.' })
    await banner.waitFor({ timeout: 20000 })
    check(`${label}: a business refusal is shown with its own message`, (await banner.count()) === 1)
    check(
      `${label}: and no "0 donor requests" or "nothing matches" contradicts it`,
      (await page.locator('[data-status-count]').count()) === 0 && !/No donor request matches/.test(await page.locator('[data-donor-list]').innerText()),
    )
    await page.screenshot({ path: `${SHOTS}/${dir}-refused.png` })
    check(`${label}: no page errors (refused)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await drive('ltr')
await drive('rtl')
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
