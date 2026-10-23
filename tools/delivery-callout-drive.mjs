// Delivery details callout drive (ticket 542; BackOffice spec 2952, door 2964 + Release lock 2959).
//
// Drives the REAL app in Chromium against a STUB of the doors (no live SIS.Api). The header is the
// ticket-078 capture 8000000121, patched to Ready; the Log and the callout histories are synthesized.
// In LTR and RTL (`oms.locale = 'ar'` sets dir="rtl"; i18n stays `lng: 'en'`), it asserts:
//   1. a TAKEN delivery: the callout moments interleave with the Log newest first; took, awarded
//      elsewhere, passed, a bid that did not answer (with its ignore reason) are distinct moments;
//      the callout's Opened and the till's BidOpened are told apart; store codes are ltr isolates;
//   2. the Activity / Callout sub-tabs; the Callout view's ledger (one row per bid: km, ATP, tills,
//      the four moments, answer by, outcome) and the raw event log in server order;
//   3. a FELL-BACK delivery: fell back to the fallback store, the assigned-card moments, an unknown
//      event kind rendered as itself;
//   4. a RELEASED delivery: the lock-released moment with its reason and note; no Release lock;
//   5. a NOT-COMPETED delivery: one moment with its reason; the sub-tab shows no ledger;
//   6. an OPEN callout: the "On callout" line above Now with a countdown that moves;
//   7. an empty list: no sub-tabs, no callout moment, no Release lock;
//   8. Release lock on Delivery details: only on a locked delivery with Execute; the board's dialog;
//      the POST body; after release the action goes and the release joins the spine;
//   9. a failing callout read leaves the spine drawn with one inline error.
//
//   1. run the app:  npx vite --port 5202 --strictPort
//   2. node tools/delivery-callout-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5202}`
const SHOTS = 'tools/.delivery-callout-shots'
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

const base = JSON.parse(readFileSync('.issues/assets/078-document-payloads/8000000121-driver-assigned.json', 'utf8')).data

const pad = (n) => String(n).padStart(2, '0')
const local = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

const D = '2026-10-23T'

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

const bid = (bidId, store, over = {}) => ({
  bidId,
  store,
  status: 'OPEN',
  offeredAt: `${D}10:00:00`,
  distanceKm: 2.4,
  atpKnown: true,
  atpCoversBasket: true,
  atpShortLines: 0,
  onlineTills: 2,
  signedInTills: 1,
  dark: false,
  deliveredAt: null,
  deliveredRegister: '',
  shownAt: null,
  shownStaff: '',
  shownRegister: '',
  openedAt: null,
  openedStaff: '',
  openedRegister: '',
  answeredAt: null,
  answeredStaff: '',
  answeredRegister: '',
  closedAt: null,
  ignoreReason: '',
  ...over,
})

let eid = 0
const ev = (at, kind, over = {}) => ({
  eventId: `E${++eid}`,
  at: at.includes('T') ? at : `${D}${at}`,
  kind,
  bidId: '',
  party: '',
  staff: '',
  register: '',
  detail: '',
  ...over,
})

const callout = (deliveryNumber, over = {}) => ({
  calloutId: `C-${deliveryNumber}`,
  deliveryNumber,
  status: 'TAKEN',
  outcome: 'Taken',
  endReason: '',
  openedAt: `${D}10:00:00`,
  expiresAt: `${D}10:05:00`,
  endedAt: `${D}10:02:00`,
  secondsLeft: null,
  candidateCount: 4,
  locksDelivery: true,
  locked: false,
  awardedParty: '',
  awardedAt: null,
  takenByStaff: '',
  takenByDevice: '',
  fallbackParty: 'R001',
  fallbackAt: null,
  releasedAt: null,
  releasedBy: '',
  releaseReason: '',
  releaseNote: '',
  channel: 'WEB',
  deliveryType: 'EXPRESS',
  city: 'Riyadh',
  cityCode: 'RUH',
  district: 'Olaya',
  value: 120,
  lineCount: 3,
  bids: [],
  events: [],
  ...over,
})

function takenCallout(no, rtl) {
  return callout(no, {
    locked: true,
    awardedParty: 'R047',
    awardedAt: `${D}10:02:00`,
    takenByStaff: rtl ? 'هدى' : 'Huda',
    takenByDevice: '01',
    bids: [
      bid('B1', 'R047', {
        status: 'TAKEN',
        distanceKm: 1.2,
        deliveredAt: `${D}10:00:05`,
        deliveredRegister: '01',
        shownAt: `${D}10:00:09`,
        shownStaff: rtl ? 'هدى' : 'Huda',
        shownRegister: '01',
        openedAt: `${D}10:00:20`,
        openedStaff: rtl ? 'هدى' : 'Huda',
        openedRegister: '01',
        answeredAt: `${D}10:02:00`,
        answeredStaff: rtl ? 'هدى' : 'Huda',
        answeredRegister: '01',
        closedAt: `${D}10:02:00`,
      }),
      bid('B2', 'R012', {
        status: 'LOST',
        distanceKm: 3.1,
        atpCoversBasket: false,
        atpShortLines: 2,
        deliveredAt: `${D}10:00:06`,
        answeredAt: `${D}10:02:03`,
        answeredStaff: 'Ali',
        answeredRegister: '02',
        closedAt: `${D}10:02:00`,
      }),
      bid('B3', 'R030', {
        status: 'PASSED',
        atpKnown: false,
        answeredAt: `${D}10:01:00`,
        answeredStaff: 'Omar',
        answeredRegister: '03',
        closedAt: `${D}10:01:00`,
      }),
      bid('B4', 'R090', {
        status: 'EXPIRED',
        dark: true,
        onlineTills: 0,
        signedInTills: 0,
        shownAt: `${D}10:00:40`,
        closedAt: `${D}10:02:00`,
        ignoreReason: 'ShownNotOpened',
      }),
    ],
    events: [
      ev('10:00:00', 'Opened', { detail: 'parties=4;fallback=R001' }),
      ev('10:00:05', 'Delivered', { bidId: 'B1', party: 'R047', register: '01' }),
      ev('10:00:09', 'Shown', { bidId: 'B1', party: 'R047', staff: rtl ? 'هدى' : 'Huda', register: '01' }),
      ev('10:00:20', 'BidOpened', { bidId: 'B1', party: 'R047', staff: rtl ? 'هدى' : 'Huda', register: '01' }),
      ev('10:01:00', 'Pass', { bidId: 'B3', party: 'R030', staff: 'Omar', register: '03', detail: 'YouPassed' }),
      ev('10:02:00', 'Take', { bidId: 'B1', party: 'R047', staff: rtl ? 'هدى' : 'Huda', register: '01', detail: 'Won' }),
      ev('10:02:03', 'Take', { bidId: 'B2', party: 'R012', staff: 'Ali', register: '02', detail: 'AwardedElsewhere' }),
    ],
  })
}

function cases(rtl) {
  const ready = (no) => ({
    ...base,
    documentNo: no,
    status: { ...base.status, readyStatus: 'R', deliveryStatus: '', closeStatus: '', lastAction: 'DRDY' },
  })
  const logs = [
    log(1, `${D}09:59:00`, 'DCRT', 'Delivery created', 'web'),
    log(2, `${D}10:02:00`, 'DRDY', 'Ready for delivery', 'store.r047'),
  ]
  const released = takenCallout('8000000602', rtl)
  Object.assign(released, {
    locked: false,
    releasedAt: `${D}10:30:00`,
    releasedBy: 'hq.ops',
    releaseReason: 'Other',
    releaseNote: rtl ? 'العميل غيّر العنوان' : 'customer moved',
  })
  released.events = [
    ...released.events,
    ev('10:30:00', 'LockReleased', { party: 'R047', staff: 'hq.ops', detail: `Other: ${released.releaseNote}` }),
  ]
  const now = new Date()
  return {
    '8000000600': { doc: ready('8000000600'), logs, callouts: [takenCallout('8000000600', rtl)] },
    '8000000601': {
      doc: ready('8000000601'),
      logs,
      callouts: [
        callout('8000000601', {
          status: 'UNANSWERED',
          outcome: 'FellBack',
          endReason: 'Expired',
          endedAt: `${D}10:05:00`,
          locked: true,
          fallbackAt: `${D}10:05:00`,
          bids: [
            bid('B1', 'R047', { status: 'EXPIRED', closedAt: `${D}10:05:00`, ignoreReason: 'NotReached' }),
            bid('B2', 'R012', { status: 'PASSED', answeredAt: `${D}10:01:00`, answeredStaff: 'Ali', closedAt: `${D}10:01:00` }),
          ],
          events: [
            ev('10:00:00', 'Opened'),
            ev('10:01:00', 'Pass', { bidId: 'B2', party: 'R012', staff: 'Ali', register: '02', detail: 'YouPassed' }),
            ev('10:05:00', 'Unanswered', { party: 'R001', detail: 'Expired' }),
            ev('10:05:02', 'FallbackDelivered', { party: 'R001', register: '04' }),
            ev('10:05:10', 'FallbackShown', { party: 'R001', staff: 'Sami', register: '04' }),
            ev('10:06:00', 'Escalated', { party: 'R001', detail: 'phoned the store' }),
          ],
        }),
      ],
    },
    '8000000602': { doc: ready('8000000602'), logs, callouts: [released] },
    '8000000603': {
      doc: ready('8000000603'),
      logs,
      callouts: [
        callout('8000000603', {
          status: 'NOT_OPENED',
          outcome: 'NotCompeted',
          endReason: 'OneCandidate',
          candidateCount: 1,
          openedAt: `${D}10:00:00`,
          endedAt: `${D}10:00:00`,
          locksDelivery: false,
          events: [ev('10:00:00', 'Opened')],
        }),
      ],
    },
    '8000000604': { doc: ready('8000000604'), logs, callouts: [] },
    '8000000605': {
      doc: ready('8000000605'),
      logs: [log(1, local(new Date(now.getTime() - 60_000)), 'DCRT', 'Delivery created', 'web')],
      callouts: [
        callout('8000000605', {
          status: 'OPEN',
          outcome: 'Open',
          openedAt: local(new Date(now.getTime() - 30_000)),
          expiresAt: local(new Date(now.getTime() + 140_000)),
          endedAt: null,
          secondsLeft: 140,
          bids: [bid('B1', 'R047'), bid('B2', 'R012'), bid('B3', 'R030', { status: 'PASSED' })],
          events: [ev(local(new Date(now.getTime() - 30_000)), 'Opened')],
        }),
      ],
    },
    '8000000606': { doc: ready('8000000606'), logs, callouts: 'fail' },
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
  const access = { canOpenDispatchBoard: true, canReleaseLock: true }
  const releases = []
  await page.route('**/api/**', async (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access')
      return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true, canChangeDetail: true, canCreateReturn: true }))
    if (p === 'DispatchBoard/Access') {
      return route.fulfill(envelope({ ...access }))
    }
    if (p === 'DispatchBoard/ReleaseLock') {
      const body = JSON.parse(route.request().postData() || '{}')
      releases.push(body)
      const c = CASES[body.deliveryNumber]?.callouts?.[0]
      if (!c || !c.locked)
        return route.fulfill(envelope(null, { status: 400, success: false, message: 'Not locked', errorCode: 'CALLOUT-104' }))
      const at = `${D}11:00:00`
      Object.assign(c, { locked: false, releasedAt: at, releasedBy: 'msartawi', releaseReason: body.reason, releaseNote: body.note ?? '' })
      c.events = [...c.events, ev(at, 'LockReleased', { party: c.awardedParty || c.fallbackParty, staff: 'msartawi', detail: body.reason })]
      return route.fulfill(
        envelope({ deliveryNumber: body.deliveryNumber, calloutId: c.calloutId, heldBy: c.awardedParty, releasedAt: at, releasedBy: 'msartawi', reason: body.reason, note: '' }),
      )
    }
    const co = p.match(/^SdDocumentWeb\/Delivery\/(\d+)\/Callout$/)
    if (co) {
      const rows = CASES[co[1]]?.callouts
      if (rows === 'fail') return route.fulfill(envelope(null, { status: 400, success: false, message: 'Callout store unavailable' }))
      return route.fulfill(envelope({ asOf: `${D}12:00:00`, deliveryNumber: co[1], callouts: rows ?? [] }))
    }
    if (/^SdDocumentWeb\/Delivery\/\d+\/DonorRequests$/.test(p)) return route.fulfill(envelope([]))
    const read = p.match(/^SdDocumentWeb\/Document\/(\d+)\/(Logs|Outbox)$/)
    if (read) return route.fulfill(envelope(read[2] === 'Logs' ? (CASES[read[1]]?.logs ?? []) : []))
    const doc = p.match(/^SdDocumentWeb\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) return route.fulfill(envelope(CASES[doc[1]]?.doc ?? null))
    return route.fulfill(envelope({}))
  })

  const open = async (no) => {
    await page.goto(`${BASE}/oms/delivery/${no}`)
    await page.locator('[data-spine]').waitFor({ timeout: 20000 })
    await page.waitForFunction(() => !document.querySelector('[data-spine] [role="status"]'), null, { timeout: 20000 })
    await page.waitForTimeout(200)
  }
  const pastOf = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-spine] ol:last-of-type > li')].map((li) => {
        const kind = li.getAttribute('data-entry')
        if (kind === 'callout') return `callout:${li.getAttribute('data-moment')}${li.getAttribute('data-party') ? ':' + li.getAttribute('data-party') : ''}`
        if (kind === 'milestone') return `milestone:${li.getAttribute('data-step')}`
        return kind
      }),
    )
  const releaseAction = () => page.locator('[data-release-lock-action]').count()

  check(`${label}: the page is ${dir}`, (await page.goto(`${BASE}/oms/delivery/8000000604`).then(() => page.evaluate(() => document.documentElement.dir || 'ltr'))) === dir)

  // ── 1: a taken delivery's moments ────────────────────────────────────────────────────────────
  await open('8000000600')
  const taken = await pastOf()
  check(
    `${label}: taken — callout moments interleave with the Log newest first`,
    JSON.stringify(taken) ===
      JSON.stringify([
        'callout:awardedElsewhere:R012',
        'milestone:ready',
        'callout:bidExpired:R090',
        'callout:took:R047',
        'callout:passed:R030',
        'callout:bidOpened:R047',
        'callout:shown:R047',
        'callout:delivered:R047',
        'callout:opened',
        'milestone:created',
      ]),
    JSON.stringify(taken),
  )
  const t1 = await page.evaluate(() => {
    const s = document.querySelector('[data-spine]')
    const row = (m) => s.querySelector(`[data-entry="callout"][data-moment="${m}"]`)
    return {
      opened: row('opened')?.querySelector('[data-label]')?.textContent ?? '',
      bidOpened: row('bidOpened')?.querySelector('[data-label]')?.textContent ?? '',
      took: row('took')?.querySelector('[data-label]')?.textContent ?? '',
      lost: row('awardedElsewhere')?.querySelector('[data-label]')?.textContent ?? '',
      expired: row('bidExpired')?.querySelector('[data-detail]')?.textContent ?? '',
      tookWho: row('took')?.querySelector('[data-who]')?.textContent ?? '',
      stores: [...s.querySelectorAll('[data-entry="callout"] [data-label] bdi[dir="ltr"]')].map((b) => b.textContent),
    }
  })
  check(`${label}: the callout's Opened and the till's BidOpened read apart`, /Callout opened to 4 stores · fallback R001/.test(t1.opened) && /R047 opened the bid/.test(t1.bidOpened), JSON.stringify([t1.opened, t1.bidOpened]))
  check(`${label}: took and awarded elsewhere are distinct sentences`, /R047 took it: awarded/.test(t1.took) && /R012 tried to take it: awarded elsewhere/.test(t1.lost), JSON.stringify([t1.took, t1.lost]))
  check(`${label}: an unanswered bid shows its ignore reason`, /shown, never opened/.test(t1.expired), t1.expired)
  check(`${label}: the taker is named`, t1.tookWho === (rtl ? 'هدى' : 'Huda'), t1.tookWho)
  check(`${label}: store codes are ltr isolates`, ['R047', 'R012', 'R030', 'R090', 'R001'].every((s) => t1.stores.includes(s)), t1.stores.join(','))
  check(`${label}: sub-tabs shown with a callout`, (await page.locator('[data-activity-tab]').count()) === 2)
  check(`${label}: Release lock offered on a locked delivery with Execute`, (await releaseAction()) === 1)
  await page.locator('[data-spine]').screenshot({ path: `${SHOTS}/${dir}-taken-spine.png` })

  // ── 2: the Callout sub-tab ──────────────────────────────────────────────────────────────────
  await page.locator('[data-activity-tab="callout"]').click()
  await page.locator('[data-callout-panel]').waitFor({ timeout: 5000 })
  const panel = await page.evaluate(() => {
    const p = document.querySelector('[data-callout-panel]')
    const rows = [...p.querySelectorAll('[data-ledger-row]')]
    const r = (s) => p.querySelector(`[data-ledger-row="${s}"]`)
    return {
      spine: !!document.querySelector('[data-spine]'),
      selected: document.querySelector('[data-activity-tab="callout"]')?.getAttribute('aria-selected'),
      outcome: p.querySelector('[data-callout-outcome]')?.textContent,
      locked: p.querySelector('[data-callout-locked]')?.textContent ?? '',
      ledger: rows.map((x) => `${x.getAttribute('data-ledger-row')}:${x.getAttribute('data-bid-status')}`),
      r047: {
        km: r('R047')?.children[1]?.textContent,
        moments: [...(r('R047')?.querySelectorAll('[data-moment]') ?? [])].map((m) => m.textContent),
        by: r('R047')?.querySelector('[data-answered-by]')?.textContent,
        outcome: r('R047')?.querySelector('[data-outcome]')?.textContent,
      },
      r012: { atp: r('R012')?.querySelector('[data-atp]')?.textContent, outcome: r('R012')?.querySelector('[data-outcome]')?.textContent },
      r030atp: r('R030')?.querySelector('[data-atp]')?.textContent,
      r090: {
        dark: !!r('R090')?.querySelector('[data-dark]'),
        tills: r('R090')?.querySelector('[data-tills]')?.textContent,
        ignore: r('R090')?.querySelector('[data-ignore-reason]')?.textContent,
      },
      log: [...p.querySelectorAll('[data-event-log] [data-event]')].map((x) => x.getAttribute('data-event')),
      logFirst: [...(p.querySelector('[data-event-log] [data-event]')?.children ?? [])].map((c) => c.textContent),
    }
  })
  check(`${label}: the Callout view replaces the spine`, !panel.spine && panel.selected === 'true', JSON.stringify(panel.selected))
  check(`${label}: panel header — outcome and lock`, panel.outcome === 'Taken' && /Locked at R047/.test(panel.locked), `${panel.outcome} | ${panel.locked}`)
  check(`${label}: ledger has one row per bid with its status`, JSON.stringify(panel.ledger) === JSON.stringify(['R047:TAKEN', 'R012:LOST', 'R030:PASSED', 'R090:EXPIRED']), JSON.stringify(panel.ledger))
  check(
    `${label}: ledger row — km, the four moments from offer, answer by`,
    panel.r047.km === '1.2' && JSON.stringify(panel.r047.moments) === JSON.stringify(['+0:05', '+0:09', '+0:20', '+2:00']) && /reg 01/.test(panel.r047.by) && panel.r047.outcome === 'Took it',
    JSON.stringify(panel.r047),
  )
  check(`${label}: ledger — ATP short / not checked; lost the race`, /short 2/.test(panel.r012.atp) && panel.r012.outcome === 'Lost the race' && panel.r030atp === 'not checked', JSON.stringify([panel.r012, panel.r030atp]))
  check(`${label}: ledger — a dark store, its tills, its ignore reason`, panel.r090.dark && panel.r090.tills === '0 / 0' && /shown, never opened/.test(panel.r090.ignore), JSON.stringify(panel.r090))
  check(
    `${label}: the raw event log in server order`,
    JSON.stringify(panel.log) === JSON.stringify(['Opened', 'Delivered', 'Shown', 'BidOpened', 'Pass', 'Take', 'Take']) && panel.logFirst[1] === '+0:00' && panel.logFirst[3] === 'Opened',
    JSON.stringify([panel.log, panel.logFirst]),
  )
  await page.locator('[data-callout-panel]').screenshot({ path: `${SHOTS}/${dir}-taken-ledger.png` })
  await page.locator('[data-activity-tab="activity"]').click()
  check(`${label}: back to Activity shows the spine`, (await page.locator('[data-spine]').count()) === 1)

  // ── 3: fell back ────────────────────────────────────────────────────────────────────────────
  await open('8000000601')
  const fb = await pastOf()
  check(
    `${label}: fell back — fell back, the assigned card, an unknown kind as itself`,
    fb.includes('callout:fellBack:R001') && fb.includes('callout:fallbackDelivered:R001') && fb.includes('callout:fallbackShown:R001') && fb.includes('callout:other:R001') && fb.includes('callout:bidExpired:R047'),
    JSON.stringify(fb),
  )
  const fbText = await page.evaluate(() => {
    const s = document.querySelector('[data-spine]')
    return {
      fell: s.querySelector('[data-moment="fellBack"]')?.textContent ?? '',
      other: s.querySelector('[data-moment="other"]')?.textContent ?? '',
      notReached: s.querySelector('[data-moment="bidExpired"] [data-detail]')?.textContent ?? '',
    }
  })
  check(
    `${label}: fell back reads its store and reason; unknown kind keeps its name`,
    /Nobody took it: fell back to R001/.test(fbText.fell) && /the callout lapsed/.test(fbText.fell) && /Escalated/.test(fbText.other) && /phoned the store/.test(fbText.other) && /never reached a till/.test(fbText.notReached),
    JSON.stringify(fbText),
  )
  check(`${label}: a fell-back locked delivery offers Release lock`, (await releaseAction()) === 1)
  await page.locator('[data-spine]').screenshot({ path: `${SHOTS}/${dir}-fellback.png` })

  // ── 4: released ─────────────────────────────────────────────────────────────────────────────
  await open('8000000602')
  const rel = await page.evaluate(() => {
    const r = document.querySelector('[data-spine] [data-moment="lockReleased"]')
    return { label: r?.querySelector('[data-label]')?.textContent ?? '', detail: r?.querySelector('[data-detail]')?.textContent ?? '', who: r?.querySelector('[data-who]')?.textContent ?? '', past: [...document.querySelectorAll('[data-spine] [data-entry="callout"]')].map((x) => x.getAttribute('data-moment')) }
  })
  check(
    `${label}: released — the lock-released moment with its reason and note, newest`,
    /Lock released at R047/.test(rel.label) && /Other/.test(rel.detail) && (rtl ? /العميل غيّر العنوان/ : /customer moved/).test(rel.detail) && rel.who === 'hq.ops' && rel.past[0] === 'lockReleased',
    JSON.stringify(rel),
  )
  check(`${label}: a released delivery offers no Release lock`, (await releaseAction()) === 0)
  await page.locator('[data-activity-tab="callout"]').click()
  const relPanel = await page.locator('[data-callout-released]').textContent()
  check(`${label}: the panel says who released it`, /Lock released/.test(relPanel) && /hq\.ops/.test(relPanel), relPanel)

  // ── 5: not competed ─────────────────────────────────────────────────────────────────────────
  await open('8000000603')
  const nc = await page.evaluate(() => [...document.querySelectorAll('[data-spine] [data-entry="callout"]')].map((x) => `${x.getAttribute('data-moment')}|${x.textContent}`))
  check(
    `${label}: not competed — one moment with its reason`,
    nc.length === 1 && nc[0].startsWith('notCompeted|') && /sent straight to R001/.test(nc[0]) && /only one store in reach/.test(nc[0]) && /1 candidate/.test(nc[0]),
    JSON.stringify(nc),
  )
  await page.locator('[data-activity-tab="callout"]').click()
  const ncPanel = await page.evaluate(() => ({
    ledger: document.querySelectorAll('[data-ledger]').length,
    reason: document.querySelector('[data-not-competed]')?.textContent ?? '',
    outcome: document.querySelector('[data-callout-outcome]')?.textContent,
  }))
  check(`${label}: not competed — the sub-tab has no ledger, says why`, ncPanel.ledger === 0 && /only one store in reach/.test(ncPanel.reason) && ncPanel.outcome === 'Not competed', JSON.stringify(ncPanel))

  // ── 6: an open callout ──────────────────────────────────────────────────────────────────────
  await open('8000000605')
  const line1 = await page.evaluate(() => {
    const s = document.querySelector('[data-spine]')
    const blocks = [...s.children].map((el) => (el.matches('[data-on-callout]') ? 'oncallout' : el.matches('[data-now-line]') ? 'now' : el.tagName.toLowerCase()))
    return { text: s.querySelector('[data-on-callout]')?.textContent ?? '', blocks }
  })
  await page.waitForTimeout(2200)
  const line2 = await page.locator('[data-on-callout]').textContent()
  const secs = (s) => {
    const m = /(\d+):(\d\d) left/.exec(s ?? '')
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN
  }
  const oc = line1.blocks.indexOf('oncallout')
  check(`${label}: an open callout has its line just above Now`, oc >= 0 && line1.blocks[oc + 1] === 'now', JSON.stringify(line1.blocks))
  check(`${label}: the line counts down and names who it waits on`, /waiting on 2 stores/.test(line1.text) && secs(line1.text) <= 140 && secs(line1.text) > 130 && secs(line2) < secs(line1.text), `${line1.text} → ${line2}`)
  await page.locator('[data-spine]').screenshot({ path: `${SHOTS}/${dir}-open.png` })

  // ── 7: no callout ───────────────────────────────────────────────────────────────────────────
  await open('8000000604')
  const none = await page.evaluate(() => ({
    tabs: document.querySelectorAll('[data-activity-tab]').length,
    moments: document.querySelectorAll('[data-entry="callout"], [data-on-callout]').length,
    milestones: document.querySelectorAll('[data-entry="milestone"]').length,
  }))
  check(`${label}: empty list — no sub-tabs, no callout moment, spine as before`, none.tabs === 0 && none.moments === 0 && none.milestones === 2, JSON.stringify(none))
  // The board's probe is asked by the menu leaf (541) on every page anyway: only the action is checked.
  check(`${label}: empty list — no Release lock`, (await releaseAction()) === 0)

  // ── 8: Release lock on Delivery details ─────────────────────────────────────────────────────
  await open('8000000600')
  await page.locator('[data-release-lock-action]').click()
  await page.locator('[data-release-dialog="8000000600"]').waitFor({ timeout: 5000 })
  const explain = await page.locator('[data-release-note-text]').textContent()
  check(`${label}: the board's release dialog names the delivery and the store holding it`, /8000000600/.test(explain) && /R047/.test(explain), explain)
  check(`${label}: confirm waits for a reason`, await page.locator('[data-release-confirm]').isDisabled())
  await page.locator('[data-release-reason="NoStock"]').check()
  await page.locator('[data-release-confirm]').click()
  await page.locator('[data-release-dialog]').waitFor({ state: 'detached', timeout: 5000 })
  await page.waitForFunction(() => !document.querySelector('[data-spine] [role="status"]'), null, { timeout: 10000 })
  await page.waitForTimeout(300)
  check(`${label}: the release posts the delivery and the reason`, JSON.stringify(releases.at(-1)) === JSON.stringify({ deliveryNumber: '8000000600', reason: 'NoStock' }), JSON.stringify(releases.at(-1)))
  const after = await page.evaluate(() => ({
    action: document.querySelectorAll('[data-release-lock-action]').length,
    first: document.querySelector('[data-spine] [data-entry="callout"]')?.getAttribute('data-moment'),
    reason: document.querySelector('[data-spine] [data-moment="lockReleased"] [data-reason-text]')?.textContent ?? '',
    toast: [...document.querySelectorAll('[data-sonner-toast]')].map((t) => t.textContent).join(' | '),
  }))
  check(
    `${label}: after release — the action goes, the release joins the spine, a toast says so`,
    after.action === 0 && after.first === 'lockReleased' && after.reason === 'No stock' && /Lock released/.test(after.toast),
    JSON.stringify(after),
  )
  await page.screenshot({ path: `${SHOTS}/${dir}-released.png` })

  access.canReleaseLock = false
  await page.reload()
  await open('8000000601')
  check(`${label}: no Execute grant — no Release lock on a locked delivery`, (await releaseAction()) === 0)
  access.canReleaseLock = true

  // ── 9: the callout read fails ───────────────────────────────────────────────────────────────
  await open('8000000606')
  const failed = await page.evaluate(() => ({
    error: document.querySelector('[data-callout-error]')?.textContent ?? null,
    milestones: document.querySelectorAll('[data-entry="milestone"]').length,
    tabs: document.querySelectorAll('[data-activity-tab]').length,
  }))
  check(
    `${label}: a failing callout read leaves the spine drawn with one inline error`,
    /Callout store unavailable/.test(failed.error ?? '') && failed.milestones === 2 && failed.tabs === 0,
    JSON.stringify(failed),
  )

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await drive('ltr')
await drive('rtl')
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
