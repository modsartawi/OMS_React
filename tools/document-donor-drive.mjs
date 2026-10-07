// Delivery details donor-moments drive (ticket 429; BackOffice 2458 owns the read).
//
// Drives the REAL app in Chromium against a STUB of the 2458 wire contract (no live SIS.Api).
// The header is the ticket-078 capture 8000000121, patched to Ready; the Log, jobs and donor
// requests are synthesized. In LTR and RTL (`oms.locale = 'ar'` sets dir="rtl"; i18n stays `lng: 'en'`,
// so the copy is English and only the stub ROWS carry Arabic), it asserts:
//   1. a delivery with a transferred, a refused and an open request draws every donor moment,
//      interleaved newest first with the Log and job rows; Stamped sits directly under Ready at
//      the same instant;
//   2. the open request gets ONE "Waiting on donor D077 · 1h 20m" line, below the future steps
//      and above Now; the transferred and refused ones get none;
//   3. the refused Ended row is amber (attention), its reason shown; donor rows use one icon;
//   4. the DRTR job whose documentNo is DR1 reads "Donor transfer to DRS · D012", still done;
//   5. the donor store is one ltr isolate;
//   6. a failing donor read leaves the spine drawn, with one inline error;
//   7. a delivery return (category T) never asks for donor requests.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/document-donor-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.document-donor-shots'
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

const base = JSON.parse(readFileSync('.issues/assets/078-document-payloads/8000000121-driver-assigned.json', 'utf8')).data
const returnDoc = JSON.parse(readFileSync('.issues/assets/078-document-payloads/9000000003-delivery-return.json', 'utf8')).data

const pad = (n) => String(n).padStart(2, '0')
/** A local wall-clock ISO time, as SIS.Api sends them (no zone). */
const local = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

const UNSET = '0001-01-01T00:00:00'
const D = '2026-10-07T'

const log = (no, entryTime, actionType, actionTypeDescription, entryUser) => ({
  logNo: String(no),
  documentNo: '',
  entryTime,
  entryUser,
  actionType,
  actionTypeDescription,
  actionData: '',
  actionOldData: '',
  note: '',
  staffId: '',
  storeCode: '',
})

const job = (outboxId, entryTime, actionType, actionTypeDescription, documentNo) => ({
  outboxId: String(outboxId),
  actionType,
  actionTypeDescription,
  documentNo,
  documentCategory: 'D',
  userId: 'system',
  entryTime,
  attemptCount: 1,
  lastAttemptTime: entryTime,
  nextAttemptTime: '',
  outboxStatus: 'C',
  errorMessage: '',
})

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
  raisedAt: `${D}09:00:00`,
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

function cases(rtl) {
  const ready = (no) => ({
    ...base,
    documentNo: no,
    status: { ...base.status, readyStatus: 'R', deliveryStatus: '', closeStatus: '', lastAction: 'DRDY' },
  })
  const logs = [
    log(1, `${D}08:55:00`, 'DCRT', 'Delivery created', 'web'),
    log(2, `${D}09:45:00`, 'DRDY', 'Ready for delivery', 'store.p019'),
  ]
  const jobs = [
    job(9100, `${D}08:55:01`, 'LMCO', 'LastMile — create order', '8000000500'),
    job(9101, `${D}09:45:00`, 'DRTR', 'Donor transfer', 'DR1'),
  ]
  return {
    '8000000500': {
      doc: ready('8000000500'),
      logs,
      jobs,
      donors: [
        request('DR1', {
          state: 'TRANSFERRED',
          fulfilledAt: `${D}09:40:00`,
          lockedBy: 'store.d012',
          lockedAt: `${D}09:45:00`,
          transferStoNo: '4500001234',
          transferredAt: `${D}10:30:00`,
          picked: 3,
        }),
        request('DR2', {
          donorStore: 'D044',
          raisedAt: `${D}09:05:00`,
          state: 'CANCELLED',
          outcome: 'REFUSED',
          outcomeReason: rtl ? 'لا يوجد مخزون' : 'No stock on the shelf',
          outcomeBy: 'store.d044',
          outcomeAt: `${D}09:20:00`,
          required: 1,
        }),
        // Raised 80 minutes and a few seconds ago: the waiting line reads 1h 20m.
        request('DR3', { donorStore: 'D077', raisedAt: local(new Date(Date.now() - 80 * 60_000 - 5_000)), required: 2 }),
      ],
    },
    '8000000501': { doc: ready('8000000501'), logs, jobs: [], donors: 'fail' },
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
  page.on('console', (m) => m.type() === 'error' && !/status of 400/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en'), dir)
  const CASES = cases(rtl)
  const donorReads = []
  await page.route('**/api/**', async (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true }))
    const donors = p.match(/^SdDocumentWeb\/Delivery\/(\d+)\/DonorRequests$/)
    if (donors) {
      donorReads.push(donors[1])
      const rows = CASES[donors[1]]?.donors
      if (rows === 'fail')
        return route.fulfill(envelope(null, { status: 400, success: false, message: 'Donor store unavailable' }))
      return route.fulfill(envelope(rows ?? []))
    }
    const read = p.match(/^SdDocumentWeb\/Document\/(\d+)\/(Logs|Outbox)$/)
    if (read) return route.fulfill(envelope((read[2] === 'Logs' ? CASES[read[1]]?.logs : CASES[read[1]]?.jobs) ?? []))
    const doc = p.match(/^SdDocumentWeb\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) return route.fulfill(envelope(CASES[doc[1]]?.doc ?? (doc[1] === '9000000003' ? returnDoc : null)))
    return route.fulfill(envelope({}))
  })

  const open = async (no) => {
    await page.goto(`${BASE}/oms/delivery/${no}`)
    await page.locator('[data-spine]').waitFor({ timeout: 20000 })
    await page.waitForFunction(() => !document.querySelector('[data-spine] [role="status"]'), null, { timeout: 20000 })
    await page.waitForTimeout(150)
  }

  // ── 1–5: transferred, refused and open ──────────────────────────────────────────────────────
  await open('8000000500')
  const view = await page.evaluate(() => {
    const s = document.querySelector('[data-spine]')
    const blocks = [...s.children].map((el) => {
      if (el.matches('[data-donor-waiting]')) return `waiting:${el.getAttribute('data-request-no')}`
      if (el.matches('[data-now-line]')) return 'now'
      if (el.matches('ol')) return el.getAttribute('aria-label')
      return el.tagName.toLowerCase()
    })
    const past = [...s.querySelectorAll('ol:last-of-type > li')].map((li) => {
      const kind = li.getAttribute('data-entry')
      if (kind === 'donor') return `donor:${li.getAttribute('data-request-no')}:${li.getAttribute('data-moment')}`
      if (kind === 'milestone') return `milestone:${li.getAttribute('data-step')}`
      if (kind === 'job') return `job:${li.getAttribute('data-outbox-id')}`
      return kind
    })
    const row = (sel) => s.querySelector(sel)
    const refused = row('[data-entry="donor"][data-moment="ended"]')
    const drtr = row('[data-entry="job"][data-outbox-id="9101"]')
    const probe = document.createElement('div')
    probe.style.color = 'var(--attention-800)'
    document.body.appendChild(probe)
    const amber = getComputedStyle(probe).color
    probe.remove()
    return {
      blocks,
      past,
      waiting: [...s.querySelectorAll('[data-donor-waiting]')].map((el) => el.textContent),
      refused: {
        outcome: refused?.getAttribute('data-outcome'),
        amber: refused ? getComputedStyle(refused.querySelector('[data-label]')).color === amber : false,
        reason: refused?.querySelector('[data-detail]')?.textContent ?? null,
      },
      drtr: {
        store: drtr?.getAttribute('data-donor-store'),
        label: drtr?.querySelector('[data-label]')?.textContent ?? null,
        state: drtr?.getAttribute('data-job-state'),
      },
      stores: [...s.querySelectorAll('[data-entry="donor"] [data-label] bdi[dir="ltr"]')].map((b) => b.textContent),
      icons: new Set([...s.querySelectorAll('[data-entry="donor"] svg')].map((svg) => svg.getAttribute('class').split(' ').find((c) => c.startsWith('lucide-')))).size,
    }
  })
  const pastFixed = view.past.filter((e) => e !== 'donor:DR3:raised')
  check(
    `${label}: donor moments interleave newest first; Stamped directly under Ready`,
    JSON.stringify(pastFixed) ===
      JSON.stringify([
        'donor:DR1:transferred',
        'milestone:ready',
        'donor:DR1:stamped',
        'job:9101',
        'donor:DR1:picked',
        'donor:DR2:ended',
        'donor:DR2:raised',
        'donor:DR1:raised',
        'job:9100',
        'milestone:created',
      ]) && view.past.includes('donor:DR3:raised'),
    JSON.stringify(view.past),
  )
  const w = view.blocks.indexOf('waiting:DR3')
  check(
    `${label}: one waiting line, for the open request, below the future steps and above Now`,
    view.waiting.length === 1 && w > 0 && view.blocks[w - 1] !== 'now' && view.blocks[w + 1] === 'now' && view.blocks.slice(0, w).some((b) => b !== 'div'),
    JSON.stringify(view.blocks),
  )
  check(
    `${label}: the waiting line names the donor and the time waited`,
    /D077/.test(view.waiting[0] ?? '') && /Waiting on donor D077 · 1h 20m/.test(view.waiting[0]),
    view.waiting[0],
  )
  check(
    `${label}: the refused Ended row is amber, with its reason`,
    view.refused.outcome === 'refused' && view.refused.amber && !!view.refused.reason,
    JSON.stringify(view.refused),
  )
  check(
    `${label}: the DRTR job names its donor and keeps its state`,
    view.drtr.store === 'D012' && view.drtr.state === 'done' && /D012/.test(view.drtr.label ?? '') && view.drtr.label === 'Donor transfer to DRS · D012',
    JSON.stringify(view.drtr),
  )
  check(
    `${label}: every donor store is an ltr isolate, every donor row one icon`,
    view.stores.includes('D012') && view.stores.includes('D044') && view.stores.includes('D077') && view.icons === 1,
    `${view.stores.join(',')} icons=${view.icons}`,
  )
  await page.locator('[data-spine]').screenshot({ path: `${SHOTS}/${dir}-donors.png` })

  // ── 6: the donor read fails ──────────────────────────────────────────────────────────────────
  await open('8000000501')
  const failed = await page.evaluate(() => ({
    error: document.querySelector('[data-donor-error]')?.textContent ?? null,
    milestones: document.querySelectorAll('[data-entry="milestone"]').length,
    donors: document.querySelectorAll('[data-entry="donor"], [data-donor-waiting]').length,
  }))
  check(
    `${label}: a failing donor read leaves the spine drawn with one inline error`,
    /Donor store unavailable/.test(failed.error ?? '') && failed.milestones === 2 && failed.donors === 0,
    JSON.stringify(failed),
  )
  await page.locator('[data-spine]').screenshot({ path: `${SHOTS}/${dir}-donor-error.png` })

  // ── 7: a delivery return never asks ──────────────────────────────────────────────────────────
  const before = donorReads.length
  await page.goto(`${BASE}/oms/delivery/9000000003`)
  await page.locator('[data-spine]').waitFor({ timeout: 20000 })
  await page.waitForTimeout(500)
  check(`${label}: a delivery return asks for no donor requests`, donorReads.length === before, donorReads.join(','))

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await drive('ltr')
await drive('rtl')
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
