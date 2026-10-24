// Document Details prescription-sessions drive (ticket 544; BackOffice spec 2994, doors 3016 + 3014).
//
// Drives the REAL app in Chromium against a STUB of the doors (no live SIS.Api; the door is on
// BackOffice branch spec2994, not deployed). Headers are the ticket-078 captures: 2000000551 (an
// order, category X) and 8000000121 (a delivery), renumbered per case. In LTR and RTL
// (`oms.locale = 'ar'` sets dir="rtl"; i18n stays `lng: 'en'`), opened both as an order
// (`/oms/document/…`) and as a delivery (`/oms/delivery/…`), it asserts:
//   1. one session: the row line, then display id, source, holding store, state, route, the step's
//      label + owner; machine values are ltr isolates; the door is asked with the record's number;
//   2. a shared order (delivery) with two sessions, one waiting on the other, both listed in full;
//   3. a parked session with its note and EXPIRES_TOMORROW;
//   4. a closed session with RETURN, CORRECTION and RESALE lines (numbers, store · time, by);
//   5. empty `sessions` → no panel, no heading (order and delivery);
//   6. a failed read (400, and 403) → no panel, and the page still works (header, items, Refresh);
//   7. no button or link anywhere on the panel.
//
//   1. run the app:  npx vite --port 5203 --strictPort
//   2. node tools/prescription-sessions-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5203}`
const SHOTS = 'tools/.prescription-sessions-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors: errorCode ? [errorCode] : [], errorCode, data }),
})

const orderBase = JSON.parse(readFileSync('.issues/assets/078-document-payloads/2000000551-erx.json', 'utf8')).data
const deliveryBase = JSON.parse(readFileSync('.issues/assets/078-document-payloads/8000000121-driver-assigned.json', 'utf8')).data

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
const session = (id, over = {}) => ({
  sessionId: id,
  displayId: `PS-${id}`,
  sourceKind: 'NPHS',
  holdingStore: 'P001',
  state: 'AWAITING_APPROVAL',
  route: 'DELIVERY',
  step: step(),
  afterClose: [],
  ...over,
})
const event = (over) => ({
  kind: 'RETURN',
  originalSaleNo: 'S1',
  documentNo: 'R1',
  resaleNo: null,
  storeCode: 'P001',
  recordedAt: '2026-10-23T14:05:00',
  recordedBy: 'till.p001',
  ...over,
})
const status = (documentNo, sessions, row = sessions[0]?.step ?? null) => ({ documentNo, sessions, row, isInvoiced: false })

function cases(rtl) {
  return {
    // order, one session
    '2000000601': { as: 'document', ps: status('2000000601', [session('41')]) },
    // delivery, one session (read through its order)
    '8000000601': { as: 'delivery', ps: status('8000000601', [session('42', { sourceKind: 'WSFT', route: null })]) },
    // delivery, a shared order with two sessions
    '8000000602': {
      as: 'delivery',
      ps: status(
        '8000000602',
        [
          session('50', { state: 'DISPENSED', step: step({ code: 'WAIT_SIBLING', label: 'Waiting on PS-51', owner: 'SYSTEM', waitingOn: 'PS-51' }) }),
          session('51', { holdingStore: 'P002', sourceKind: 'WSFT' }),
        ],
        step({ label: '1 of 2 ready, Waiting on payer (PS-51)' }),
      ),
    },
    // order, parked
    '2000000603': {
      as: 'document',
      ps: status('2000000603', [
        session('60', {
          state: 'DISPENSED',
          route: 'COUNTER',
          step: step({ code: 'COLLECT', label: 'Customer collects', owner: 'CUSTOMER', isParked: true, parkNote: rtl ? 'يستلم غدًا' : 'collects tomorrow', badges: ['EXPIRES_TOMORROW'] }),
        }),
      ]),
    },
    // delivery, closed with after-close events
    '8000000604': {
      as: 'delivery',
      ps: status(
        '8000000604',
        [
          session('70', {
            state: 'CLOSED',
            step: null,
            afterClose: [
              event({ kind: 'RETURN', originalSaleNo: 'S1', documentNo: 'R1' }),
              event({ kind: 'CORRECTION', originalSaleNo: 'S1', documentNo: 'R2', resaleNo: 'I2', recordedBy: rtl ? 'سارة' : 'sara' }),
              event({ kind: 'RESALE', originalSaleNo: 'S1', documentNo: 'I3', resaleNo: 'I3', storeCode: 'P009', recordedAt: '2026-10-24T09:30:00' }),
            ],
          }),
        ],
        null,
      ),
    },
    '2000000605': { as: 'document', ps: status('2000000605', [], null) },
    '8000000606': { as: 'delivery', ps: status('8000000606', [], null) },
    '2000000607': { as: 'document', ps: 'fail' },
    '8000000608': { as: 'delivery', ps: 'denied' },
  }
}

const browser = await chromium.launch()

async function drive(dir) {
  const rtl = dir === 'rtl'
  const label = dir
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of (400|403)/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en'), dir)
  const CASES = cases(rtl)
  const asked = []
  await page.route('**/api/**', async (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access')
      return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true, canChangeDetail: true, canCreateReturn: true }))
    const ps = p.match(/^SdDocumentWeb\/Document\/(\d+)\/PrescriptionSessions$/)
    if (ps) {
      asked.push(ps[1])
      const c = CASES[ps[1]]
      if (c?.ps === 'fail') return route.fulfill(envelope(null, { status: 400, success: false, message: 'Session store unavailable' }))
      if (c?.ps === 'denied') return route.fulfill({ status: 403, contentType: 'text/plain', body: '' })
      return route.fulfill(envelope(c?.ps ?? status(ps[1], [], null)))
    }
    if (/^SdDocumentWeb\/Delivery\/\d+\/(DonorRequests)$/.test(p)) return route.fulfill(envelope([]))
    if (/^SdDocumentWeb\/Delivery\/\d+\/Callout$/.test(p)) return route.fulfill(envelope({ asOf: '2026-10-24T12:00:00', deliveryNumber: '', callouts: [] }))
    if (/^SdDocumentWeb\/Document\/\d+\/(Logs|Outbox)$/.test(p)) return route.fulfill(envelope([]))
    const doc = p.match(/^SdDocumentWeb\/(Document|Delivery)\/(\d+)$/)
    if (doc) {
      const c = CASES[doc[2]]
      if (!c) return route.fulfill(envelope(null))
      const b = c.as === 'delivery' ? deliveryBase : orderBase
      return route.fulfill(envelope({ ...b, documentNo: doc[2] }))
    }
    return route.fulfill(envelope({}))
  })

  const open = async (no) => {
    const as = CASES[no].as
    const before = asked.length
    await page.goto(`${BASE}/oms/${as}/${no}`)
    await page.locator('[data-spine]').waitFor({ timeout: 20000 })
    await page.waitForFunction(() => !document.querySelector('[data-spine] [role="status"]'), null, { timeout: 20000 })
    for (let i = 0; i < 50 && asked.length === before; i++) await page.waitForTimeout(100)
    await page.waitForTimeout(300)
    return asked.slice(before)
  }
  const panel = () =>
    page.evaluate(() => {
      const p = document.querySelector('[data-ps-panel]')
      if (!p) return null
      const s = (el) => ({
        id: el.getAttribute('data-ps-session'),
        idIsolated: el.querySelector('[data-ps-display-id] bdi[dir="ltr"]')?.textContent ?? '',
        source: el.querySelector('[data-ps-source]')?.textContent ?? '',
        store: el.querySelector('[data-ps-holding-store]')?.textContent ?? '',
        storeIsolated: el.querySelector('[data-ps-holding-store] bdi[dir="ltr"]')?.textContent ?? '',
        state: el.querySelector('[data-ps-state]')?.textContent ?? '',
        route: el.querySelector('[data-ps-route]')?.textContent ?? '',
        label: el.querySelector(':scope > div [data-ps-step-label]')?.textContent ?? '',
        owner: el.querySelector(':scope > div [data-ps-owner]')?.textContent ?? '',
        waitingOn: el.querySelector(':scope > div [data-ps-waiting-on]')?.textContent ?? '',
        waitingIsolated: el.querySelector(':scope > div [data-ps-waiting-on] bdi[dir="ltr"]')?.textContent ?? '',
        parked: !!el.querySelector('[data-ps-parked]'),
        note: el.querySelector('[data-ps-park-note]')?.textContent ?? '',
        noteIsBdi: el.querySelector('[data-ps-park-note]')?.tagName === 'BDI',
        badges: [...el.querySelectorAll('[data-ps-badge]')].map((b) => `${b.getAttribute('data-ps-badge')}=${b.textContent}`),
        after: [...el.querySelectorAll('[data-ps-after-close]')].map((a) => ({
          kind: a.getAttribute('data-ps-after-close'),
          text: a.querySelector('[data-ps-after-close-sentence]')?.textContent ?? '',
          nums: [...a.querySelectorAll('[data-ps-after-close-sentence] bdi[dir="ltr"]')].map((b) => b.textContent),
          at: a.querySelector('[data-ps-after-close-at] bdi[dir="ltr"]')?.textContent ?? '',
          by: a.querySelector('[data-ps-after-close-by] bdi:not([dir])')?.textContent ?? '',
        })),
      })
      return {
        heading: p.querySelector('h3')?.textContent ?? '',
        row: p.querySelector('[data-ps-row] [data-ps-step-label]')?.textContent ?? null,
        sessions: [...p.querySelectorAll('[data-ps-session]')].map(s),
        controls: p.querySelectorAll('button, a, input, select, textarea, [role="button"]').length,
      }
    })
  const noPanel = () => page.evaluate(() => ({ panel: document.querySelectorAll('[data-ps-panel]').length, heading: [...document.querySelectorAll('h3')].some((h) => /Prescription sessions/i.test(h.textContent)) }))

  check(`${label}: the page is ${dir}`, (await page.goto(`${BASE}/oms/document/2000000605`).then(() => page.evaluate(() => document.documentElement.dir || 'ltr'))) === dir)

  // ── 1: one session, as an order and as a delivery ──────────────────────────────────────────
  let a = await open('2000000601')
  check(`${label}: order — the door is asked with the order's number`, JSON.stringify(a) === '["2000000601"]', JSON.stringify(a))
  let v = await panel()
  check(`${label}: order — the panel is drawn with its heading`, v !== null && v.heading === 'Prescription sessions', JSON.stringify(v?.heading))
  check(`${label}: order — the row line comes first`, v?.row === 'Waiting on payer approval', String(v?.row))
  const s1 = v?.sessions[0]
  check(
    `${label}: order — the session line: id, source, holding store, state, route`,
    v?.sessions.length === 1 && s1.id === 'PS-41' && s1.idIsolated === 'PS-41' && s1.source === 'NPHIES' && s1.store === 'Held at P001' && s1.storeIsolated === 'P001' && s1.state === 'Awaiting approval' && s1.route === 'Delivery',
    JSON.stringify(s1),
  )
  check(`${label}: order — the step: server label, owner word`, s1?.label === 'Waiting on payer approval' && s1?.owner === 'Owner: Payer', JSON.stringify([s1?.label, s1?.owner]))
  check(`${label}: order — no button or link on the panel`, v?.controls === 0, String(v?.controls))
  await page.locator('[data-ps-panel]').screenshot({ path: `${SHOTS}/${dir}-order-one.png` })

  a = await open('8000000601')
  check(`${label}: delivery — the door is asked with the delivery's number`, JSON.stringify(a) === '["8000000601"]', JSON.stringify(a))
  v = await panel()
  check(
    `${label}: delivery — one session, Wasfaty, route not chosen`,
    v?.sessions.length === 1 && v.sessions[0].id === 'PS-42' && v.sessions[0].source === 'Wasfaty' && v.sessions[0].route === 'Route not chosen' && v.controls === 0,
    JSON.stringify(v?.sessions[0]),
  )

  // ── 2: a shared order ───────────────────────────────────────────────────────────────────────
  await open('8000000602')
  v = await panel()
  check(`${label}: shared — both sessions listed in full, in order`, JSON.stringify(v?.sessions.map((s) => s.id)) === '["PS-50","PS-51"]', JSON.stringify(v?.sessions.map((s) => s.id)))
  check(`${label}: shared — the order's row line is the server's`, v?.row === '1 of 2 ready, Waiting on payer (PS-51)', String(v?.row))
  check(
    `${label}: shared — the waiting session names PS-51 (isolated); the other waits on none`,
    v?.sessions[0].waitingOn === 'Waiting on PS-51' && v.sessions[0].waitingIsolated === 'PS-51' && v.sessions[1].waitingOn === '' && v.sessions[0].state === 'Dispensed' && v.sessions[0].owner === 'Owner: System' && v.sessions[1].storeIsolated === 'P002',
    JSON.stringify(v?.sessions.map((s) => [s.waitingOn, s.state, s.owner, s.store])),
  )
  await page.locator('[data-ps-panel]').screenshot({ path: `${SHOTS}/${dir}-shared.png` })

  // ── 3: parked ───────────────────────────────────────────────────────────────────────────────
  await open('2000000603')
  v = await panel()
  const p3 = v?.sessions[0]
  check(
    `${label}: parked — Parked, its note as free text, Expires tomorrow, owner Customer, route Counter`,
    p3?.parked && p3.note === (rtl ? 'يستلم غدًا' : 'collects tomorrow') && p3.noteIsBdi && JSON.stringify(p3.badges) === '["EXPIRES_TOMORROW=Expires tomorrow"]' && p3.owner === 'Owner: Customer' && p3.route === 'Counter',
    JSON.stringify(p3),
  )
  await page.locator('[data-ps-panel]').screenshot({ path: `${SHOTS}/${dir}-parked.png` })

  // ── 4: after close ──────────────────────────────────────────────────────────────────────────
  await open('8000000604')
  v = await panel()
  const s4 = v?.sessions[0]
  check(`${label}: closed — no row line, no step line, state Closed`, v?.row === null && s4?.label === '' && s4?.state === 'Closed', JSON.stringify([v?.row, s4?.label, s4?.state]))
  check(`${label}: closed — one after-close line per event, in order`, JSON.stringify(s4?.after.map((x) => x.kind)) === '["RETURN","CORRECTION","RESALE"]', JSON.stringify(s4?.after.map((x) => x.kind)))
  const [ret, cor, res] = s4?.after ?? []
  check(`${label}: RETURN reads "Returned R1 (sale S1)"`, ret?.text === 'Returned R1 (sale S1)' && JSON.stringify(ret.nums) === '["R1","S1"]', JSON.stringify(ret))
  check(
    `${label}: CORRECTION reads its reversal and re-invoice`,
    cor?.text === 'Patient share corrected on S1: reversal R2, re-invoice I2' && JSON.stringify(cor.nums) === '["S1","R2","I2"]' && cor.by === (rtl ? 'سارة' : 'sara'),
    JSON.stringify(cor),
  )
  check(`${label}: RESALE reads "Re-sold as I3 (after sale S1)"`, res?.text === 'Re-sold as I3 (after sale S1)', JSON.stringify(res))
  check(
    `${label}: each line's store · time is one ltr isolate, wall-clock as sent; by is free text`,
    ret?.at === 'P001 · 2026-10-23 14:05' && res?.at === 'P009 · 2026-10-24 09:30' && ret.by === 'till.p001',
    JSON.stringify([ret?.at, res?.at, ret?.by]),
  )
  check(`${label}: closed — no button or link on the panel`, v?.controls === 0, String(v?.controls))
  await page.locator('[data-ps-panel]').screenshot({ path: `${SHOTS}/${dir}-after-close.png` })

  // ── 5: empty ────────────────────────────────────────────────────────────────────────────────
  for (const no of ['2000000605', '8000000606']) {
    a = await open(no)
    const n = await noPanel()
    check(`${label}: empty sessions (${CASES[no].as}) — no panel, no heading`, a.length === 1 && n.panel === 0 && !n.heading, JSON.stringify([a, n]))
  }

  // ── 6: failed reads ─────────────────────────────────────────────────────────────────────────
  for (const no of ['2000000607', '8000000608']) {
    a = await open(no)
    const n = await noPanel()
    const page6 = await page.evaluate(() => ({
      items: !!document.querySelector('#doc-items'),
      facts: document.querySelectorAll('[data-facts-block]').length,
      alert: [...document.querySelectorAll('[role="alert"]')].map((x) => x.textContent).join('|'),
    }))
    check(
      `${label}: a failed read (${CASES[no].ps}) hides the panel; the page still draws`,
      a.length === 1 && n.panel === 0 && page6.items && page6.facts > 0 && !/Session store unavailable/.test(page6.alert),
      JSON.stringify([n, page6]),
    )
  }
  // The page still works after a failed read: Refresh reads again, and still draws no panel.
  const before = asked.length
  const refreshBtn = page.getByRole('button', { name: 'Refresh', exact: true }).first()
  if (await refreshBtn.count()) {
    await refreshBtn.click()
    for (let i = 0; i < 30 && asked.length === before; i++) await page.waitForTimeout(100)
    await page.waitForTimeout(800)
    const after = { reads: asked.length - before, panel: (await noPanel()).panel, items: await page.locator('#doc-items').count(), path: await page.evaluate(() => location.pathname) }
    check(
      `${label}: after a failed read, Refresh still reads the sessions and the page stays up`,
      after.reads > 0 && after.panel === 0 && after.items === 1,
      JSON.stringify(after),
    )
  } else {
    check(`${label}: after a failed read, Refresh still reads the sessions and the page stays up`, false, 'no refresh control found')
  }

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await drive('ltr')
await drive('rtl')
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
