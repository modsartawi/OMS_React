// Insurance pattern cases — the drives' shared stubs (oms 922–924; BackOffice spec 4050). They serve the REAL shapes of
// BackOffice 4053/4055/4056 as built (routes `InsuranceRules/Patterns/...`, a case keyed by its INT case number; the C#
// views in `Sartawi.Retail.Data/Modules/InsuranceRules/Patterns/InsurancePatternCaseViews.cs`, camelCased), so a live
// walk and the drives agree. 923 and 924 import this module and add their own doors beside `patternsDoors` (chain them:
// the first that answers wins).
//
//   import { patternsState, patternsDoors, envelope, KEYS, standInGoogle } from './insurance-patterns-stubs.mjs'
//   const state = patternsState({ maps: { key: 'drive-stand-in-key' } })
//   const doors = patternsDoors(state)
//   await page.route('**/api/**', (route) => { const a = doors(route.request()); return route.fulfill(a ?? envelope({})) })
//
// Every fixture is synthetic: no patient key, member id or policy exists in any of them, as in the models.

/** The grant keys as BackOffice 4053/4055 seed them (`src/core/permissions.ts`): CONTROLLER `InsurancePattern`. */
export const KEYS = Object.freeze({
  /** 03 view: the list and a case. */
  analyst: 'InsurancePattern:03',
  /** 02 mark: the mark form. */
  marker: 'InsurancePattern:02',
  /** 06 reveal. */
  investigator: 'InsurancePattern:06',
  /** 01 manage: the settings and the reveal log. */
  manager: 'InsurancePattern:01',
  block: 'InsurancePatientBlock:02',
})

/** The SIS.Api envelope as a Playwright `route.fulfill` argument. */
export const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

/** A business refusal: a non-2xx that still carries the envelope, with its machine code. */
export const businessRefusal = (code, message, status = 400) =>
  envelope(null, { status, success: false, message, errors: [{ errorCode: code, errorMessage: message }] })

/** What ASP.NET answers a path its `{number:int}` route does not match: a bare 404, no envelope. */
export const bareNotFound = () => ({ status: 404, contentType: 'text/plain', body: '' })

/** BackOffice 4053's refusal for a case number no case has. */
export const caseNotFound = (n) => businessRefusal('INSPATTERN_NOT_FOUND', `No pattern case has the number ${n}.`, 404)

/** The stores the fixtures touch. 4090 has no coordinates: it is listed under the map, never drawn. */
export const STORES = Object.freeze({
  1001: { storeCode: '1001', storeName: 'Olaya', lat: 24.6943, lon: 46.6853 },
  1002: { storeCode: '1002', storeName: 'Malaz', lat: 24.6612, lon: 46.7311 },
  2040: { storeCode: '2040', storeName: 'Buraydah Central', lat: 26.326, lon: 43.975 },
  3050: { storeCode: '3050', storeName: 'Dammam Corniche', lat: 26.434, lon: 50.103 },
  5060: { storeCode: '5060', storeName: 'Hail', lat: 27.5114, lon: 41.7208 },
  7070: { storeCode: '7070', storeName: 'Jeddah Tahlia', lat: 21.5433, lon: 39.1728 },
  8080: { storeCode: '8080', storeName: 'Khobar', lat: 26.2794, lon: 50.2083 },
  4090: { storeCode: '4090', storeName: 'Qurtubah (new)', lat: null, lon: null },
})

/** A store on the wire (`InsurancePatternStoreView`). */
const wireStore = (code) => ({ storeCode: code, storeName: STORES[code].storeName, latitude: STORES[code].lat, longitude: STORES[code].lon })

/** A dispense on the wire (`InsurancePatternDispenseView`): `seq`, `eventTime`, `isCounter`. */
const dispense = (seq, code, eventTime, { counter = true, item = ['100200', 'Insulin glargine 100 IU/ml'], quantity = 1, daysSupply = 30, payer = 'BUPA', pharmacist = 'phx' + code, signals = [] } = {}) => ({
  seq,
  storeCode: code,
  storeName: STORES[code].storeName,
  eventTime,
  itemNumber: item[0],
  itemDescription: item[1],
  sfdaCode: '6281100' + item[0].slice(-2),
  quantity,
  daysSupply,
  payer,
  channel: counter ? 'Counter' : 'Delivery',
  isCounter: counter,
  pharmacist,
  signals,
})

/** A leg on the wire (`InsurancePatternLegView`): between two consecutive COUNTER dispenses, so always `counter: true`. */
const leg = (dispenses, fromSeq, toSeq, km, minutes, kmPerHour, travel) => ({
  fromSeq,
  toSeq,
  fromStore: dispenses.find((d) => d.seq === fromSeq).storeCode,
  toStore: dispenses.find((d) => d.seq === toSeq).storeCode,
  km,
  minutes,
  kmPerHour,
  counter: true,
  travel,
})

const SCORE = { travel: 3, overlap: 2, hopping: 1 }
const scoreOf = (signals) => signals.reduce((s, x) => s + SCORE[x], 0)

const TRAVEL_DISPENSES = [
  dispense(1, '1001', '2026-11-10T09:15:00', { quantity: 2 }),
  dispense(2, '2040', '2026-11-10T10:55:00', { signals: ['travel'] }),
  dispense(3, '3050', '2026-11-11T12:00:00', { counter: false, payer: 'TAWUNIYA' }),
  dispense(4, '5060', '2026-11-11T15:30:00', { daysSupply: null }),
  dispense(5, '1001', '2026-11-12T18:40:00', { item: ['100300', 'Pregabalin 150 mg'] }),
  dispense(6, '4090', '2026-11-12T20:00:00'),
]

/**
 * The drive's main case, number 123: Olaya → Buraydah (312 km in 1 h 40 min: TRAVEL) → a DELIVERY from Dammam → Hail →
 * Olaya → the store with no coordinates. The server's legs arrive out of time order; the patient was cleared on case 99
 * before (the client derives the banner from that previous case's clearing mark).
 *
 * Internal fixture fields: `stores` are store codes, `signals` the kinds, `previousCases` case numbers; `rowOf` and
 * `detailOf` turn a fixture into the wire's shapes.
 */
export const TRAVEL_CASE = Object.freeze({
  caseNumber: 123,
  stores: ['1001', '2040', '3050', '5060', '4090'],
  dispenseCount: 6,
  openedAt: '2026-11-10T09:15:00',
  lastDispenseAt: '2026-11-12T20:00:00',
  closedAt: null,
  spanHours: 58,
  longestLegKm: 637.2,
  shortestGapMinutes: 80,
  signals: ['travel', 'hopping'],
  score: 4,
  severity: 'action',
  status: 'open',
  dispenses: TRAVEL_DISPENSES,
  legs: [
    leg(TRAVEL_DISPENSES, 4, 5, 637.2, 1630, 23.5, false),
    leg(TRAVEL_DISPENSES, 1, 2, 312.4, 100, 187.4, true),
    leg(TRAVEL_DISPENSES, 5, 6, null, 80, null, false),
    leg(TRAVEL_DISPENSES, 2, 4, 214.9, 1715, 7.5, false),
  ],
  signalWords: [
    { signal: 'travel', en: '312 km in 1 h 40 min, Olaya to Buraydah Central', ar: '312 كم في 1 س 40 د، من العليا إلى بريدة المركزي' },
    { signal: 'hopping', en: '5 pharmacies in 3 days', ar: '5 صيدليات في 3 أيام' },
  ],
  marks: [{ status: 'watching', note: 'Asked Buraydah Central for the CCTV.', markedBy: 'analyst1', markedAt: '2026-11-13T10:05:00' }],
  previousCases: [99],
})

const CLEARED_DISPENSES = [
  dispense(1, '1001', '2026-09-20T08:00:00'),
  dispense(2, '1002', '2026-09-22T04:10:00', { signals: ['overlap'] }),
  dispense(3, '1001', '2026-09-24T17:30:00'),
]

/** The same patient's earlier case, number 99, cleared: what the clearance banner links to. */
export const CLEARED_CASE = Object.freeze({
  caseNumber: 99,
  stores: ['1001', '1002'],
  dispenseCount: 3,
  openedAt: '2026-09-20T08:00:00',
  lastDispenseAt: '2026-09-24T17:30:00',
  closedAt: '2026-10-01T12:00:00',
  spanHours: 105,
  longestLegKm: 5.6,
  shortestGapMinutes: 2650,
  signals: ['overlap'],
  score: 2,
  severity: 'info',
  status: 'cleared',
  dispenses: CLEARED_DISPENSES,
  legs: [leg(CLEARED_DISPENSES, 1, 2, 5.6, 2650, 0.1, false), leg(CLEARED_DISPENSES, 2, 3, 5.6, 3680, 0.1, false)],
  signalWords: [{ signal: 'overlap', en: 'Insulin again at Malaz with 27 of 30 days left', ar: 'إنسولين مرة أخرى في الملز مع بقاء 27 من 30 يوما' }],
  marks: [{ status: 'cleared', note: 'Chronic patient who travels for work; confirmed with the payer.', markedBy: 'analyst2', markedAt: '2026-10-01T12:00:00' }],
  previousCases: [],
})

const SIGNAL_SETS = [['travel', 'overlap', 'hopping'], ['travel', 'overlap'], ['travel', 'hopping'], ['travel'], ['overlap', 'hopping'], ['overlap'], ['hopping']]
const STATUS_CYCLE = ['open', 'open', 'watching', 'open', 'confirmed', 'cleared', 'closed']
const POOL = ['1001', '1002', '2040', '3050', '5060', '7070', '8080']

/** A generated case, number 200 + i, so the list has pages (60 of them besides the two above). Deterministic. */
export function generatedCase(i) {
  const signals = SIGNAL_SETS[i % SIGNAL_SETS.length]
  const score = scoreOf(signals)
  const codes = [POOL[i % POOL.length], POOL[(i + 2) % POOL.length], POOL[(i + 4) % POOL.length]].slice(0, 2 + (i % 2))
  const day = String(1 + (i % 18)).padStart(2, '0')
  const opened = `2026-11-${day}T08:${String(i % 60).padStart(2, '0')}:00`
  const last = `2026-11-${String(Math.min(28, 1 + (i % 18) + 2)).padStart(2, '0')}T19:${String((i * 7) % 60).padStart(2, '0')}:00`
  const status = STATUS_CYCLE[i % STATUS_CYCLE.length]
  const dispenses = codes.map((c, k) => dispense(k + 1, c, `2026-11-${day}T${String(9 + k * 3).padStart(2, '0')}:00:00`))
  return {
    caseNumber: 200 + i,
    stores: codes,
    dispenseCount: dispenses.length,
    openedAt: opened,
    lastDispenseAt: last,
    closedAt: status === 'closed' || status === 'cleared' ? `2026-11-${String(Math.min(28, 1 + (i % 18) + 5)).padStart(2, '0')}T12:00:00` : null,
    spanHours: 3 + Math.floor((i * 37) / 60),
    // The server's 0: no leg with coordinates at both ends.
    longestLegKm: i % 5 === 0 ? 0 : 40 + ((i * 53) % 700),
    shortestGapMinutes: 45 + ((i * 29) % 600),
    signals,
    score,
    severity: score >= 3 ? 'action' : 'info',
    status,
    dispenses,
    legs: dispenses.slice(1).map((d, k) => leg(dispenses, dispenses[k].seq, d.seq, 120, 180, 40, false)),
    signalWords: signals.map((s) => ({ signal: s, en: `${s} (generated)`, ar: `${s} (مولد)` })),
    marks: [],
    previousCases: [],
  }
}

/** A case as the list shows it (`InsurancePatternCaseRow`): the signals with their words, the stores with coordinates. */
export const rowOf = (d) => ({
  caseNumber: d.caseNumber,
  status: d.status,
  severity: d.severity,
  score: d.score,
  signals: d.signals.map((s) => d.signalWords.find((w) => w.signal === s) ?? { signal: s, en: s, ar: s }),
  openedAt: d.openedAt,
  lastDispenseAt: d.lastDispenseAt,
  closedAt: d.closedAt,
  spanHours: d.spanHours,
  storeCount: d.stores.length,
  dispenseCount: d.dispenseCount,
  longestLegKm: d.longestLegKm,
  shortestGapMinutes: d.shortestGapMinutes,
  stores: d.stores.map(wireStore),
})

const newestMarkFirst = (a, b) => (a.markedAt < b.markedAt ? 1 : a.markedAt > b.markedAt ? -1 : 0)

/** One case as `GET …/Cases/{caseNumber}` answers it (`InsurancePatternCaseDetail`). No `maps` part: 4053 sends none. */
export const detailOf = (state, d) => ({
  case: rowOf(d),
  dispenses: d.dispenses,
  legs: d.legs,
  marks: [...d.marks].sort(newestMarkFirst),
  previousCases: d.previousCases
    .map((n) => state.details.get(n))
    .filter(Boolean)
    .map((p) => ({
      caseNumber: p.caseNumber,
      status: p.status,
      signals: p.signals.join(','),
      openedAt: p.openedAt,
      lastDispenseAt: p.lastDispenseAt,
      closedAt: p.closedAt,
      marks: [...p.marks].sort(newestMarkFirst),
    })),
  stores: d.stores.map(wireStore),
  canReveal: true,
  // A drive that stands Google in plants a key the way a later BackOffice might send one (the client reads it if sent).
  ...(state.maps ? { maps: state.maps } : {}),
})

/** The server's order: score, then the last dispense, newest first. */
const serverOrder = (a, b) => b.score - a.score || (a.lastDispenseAt < b.lastDispenseAt ? 1 : a.lastDispenseAt > b.lastDispenseAt ? -1 : 0)

/**
 * The doors' state for one scenario, cases keyed by their case NUMBER. `maps`: a `maps` part to plant on the case
 * (BackOffice 4053 sends none; null — the default — is the real server, so the map cannot draw and no request reaches
 * Google). `markRefusal`: `{ code, message }` to refuse the next marks. `calls` records what the app sent (`detail` holds
 * the case numbers asked, as numbers).
 */
export function patternsState(over = {}) {
  const details = new Map([TRAVEL_CASE, CLEARED_CASE, ...Array.from({ length: 60 }, (_, i) => generatedCase(i + 1))].map((d) => [d.caseNumber, structuredClone(d)]))
  return {
    details,
    maps: null,
    markRefusal: null,
    user: 'msartawi',
    clock: 0,
    calls: { list: [], detail: [], marks: [] },
    ...over,
  }
}

const dayOf = (iso) => iso.slice(0, 10)

/** The list's filters as the stub reads them (`store`, the period, `signal`, `status`, `severity`). */
function listed(state, q) {
  const rows = [...state.details.values()].filter((d) => {
    if (q.store && !d.stores.includes(q.store)) return false
    if (q.signal && !d.signals.includes(q.signal)) return false
    if (q.status && d.status !== q.status) return false
    if (q.severity && d.severity !== q.severity) return false
    // A case is in the period when its dispenses overlap it (days, inclusive).
    if (q.from && dayOf(d.lastDispenseAt) < q.from) return false
    if (q.to && dayOf(d.openedAt) > q.to) return false
    return true
  })
  return rows.sort(serverOrder)
}

/** A path segment the server's `{number:int}` route matches, as a number; null when it does not (a bare 404). */
const caseNumberIn = (segment) => (/^\d+$/.test(segment) ? Number(segment) : null)

/**
 * The pattern doors (BackOffice 4053 as built): `GET InsuranceRules/Patterns/Cases?store&from&to&signal&status&severity
 * &page&pageSize` → `{ page, pageSize, total, rows }`, `GET …/Cases/{caseNumber}` → the detail,
 * `POST …/Cases/{caseNumber}/Marks { status, note }` → the detail again. Returns `(request) => fulfil argument | null`:
 * null for a path it does not own.
 */
export function patternsDoors(state) {
  return (request) => {
    const url = new URL(request.url())
    const path = decodeURIComponent(url.pathname.split('/api/')[1] ?? '')
    const method = request.method()
    if (path === 'InsuranceRules/Patterns/Cases' && method === 'GET') {
      const q = Object.fromEntries(url.searchParams)
      state.calls.list.push({ query: q, csrf: request.headers()['x-web-client'] ?? null })
      const all = listed(state, q)
      const page = Math.max(1, Number(q.page ?? 1))
      const pageSize = Math.max(1, Number(q.pageSize ?? 25))
      return envelope({ page, pageSize, total: all.length, rows: all.slice((page - 1) * pageSize, page * pageSize).map(rowOf) })
    }
    let m = path.match(/^InsuranceRules\/Patterns\/Cases\/([^/]+)$/)
    if (m && method === 'GET') {
      const n = caseNumberIn(m[1])
      if (n === null) return bareNotFound()
      state.calls.detail.push(n)
      const d = state.details.get(n)
      if (!d) return caseNotFound(n)
      return envelope(detailOf(state, d))
    }
    m = path.match(/^InsuranceRules\/Patterns\/Cases\/([^/]+)\/Marks$/)
    if (m && method === 'POST') {
      const n = caseNumberIn(m[1])
      if (n === null) return bareNotFound()
      const body = JSON.parse(request.postData() || '{}')
      state.calls.marks.push({ caseNumber: n, body, csrf: request.headers()['x-web-client'] ?? null })
      if (state.markRefusal) return businessRefusal(state.markRefusal.code, state.markRefusal.message)
      const d = state.details.get(n)
      if (!d) return caseNotFound(n)
      if (!['watching', 'cleared', 'confirmed', 'closed'].includes(body.status) || !String(body.note ?? '').trim())
        return businessRefusal('INSPATTERN_BAD_REQUEST', 'A mark needs a status and a note.')
      const markedAt = `2026-11-19T11:${String(10 + state.clock++).padStart(2, '0')}:00`
      d.marks.push({ status: body.status, note: String(body.note).slice(0, 1000), markedBy: state.user, markedAt })
      d.status = body.status
      if (body.status === 'closed') d.closedAt = markedAt
      // 4053 answers the whole case again.
      return envelope(detailOf(state, d))
    }
    return null
  }
}

/**
 * A stand-in for Google's Maps JavaScript, so a drive watches `src/core/map/google-engine.ts` draw without a key, a
 * billed map load or the network: a blank map whose projection fits the bounds the adapter asks for, `Polyline`s drawn
 * as SVG lines (and recorded in `window.__googleStandIn.polylines`), Google's overlay panes as plain elements, and
 * `tilesloaded` + `idle` reported once drawn. `callback` is the loader's ready callback (from the script's address).
 */
export function googleStandInScript(callback) {
  return `(() => {
  const record = (window.__googleStandIn = { maps: [], polylines: [] })
  const PAD = 40
  class Map {
    constructor(el, options) {
      this.el = el; this.options = options; this.listeners = {}; this.zoom = options.zoom ?? 5; this.bounds = null
      record.maps.push(this)
      el.style.position = 'relative'
      el.style.background = 'rgb(238, 242, 236)'
      this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      this.svg.setAttribute('data-stand-in', 'lines')
      Object.assign(this.svg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' })
      this.pane = document.createElement('div')
      Object.assign(this.pane.style, { position: 'absolute', inset: '0' })
      el.append(this.svg, this.pane)
      if (options.center) this.bounds = { west: options.center.lng - 1, east: options.center.lng + 1, south: options.center.lat - 1, north: options.center.lat + 1 }
      setTimeout(() => { this.fire('tilesloaded'); this.fire('idle') }, 60)
    }
    addListener(ev, fn) { (this.listeners[ev] ??= []).push(fn); return { remove: () => { this.listeners[ev] = (this.listeners[ev] ?? []).filter((f) => f !== fn) } } }
    fire(ev) { for (const fn of [...(this.listeners[ev] ?? [])]) fn() }
    fitBounds(b) { this.bounds = b; this.zoom = 6 }
    setOptions() {}
    setCenter(c) { this.bounds = { west: c.lng - 0.05, east: c.lng + 0.05, south: c.lat - 0.05, north: c.lat + 0.05 } }
    setZoom(z) { this.zoom = z }
    panTo() {}
    getZoom() { return this.zoom }
    project({ lat, lng }) {
      const b = this.bounds ?? { west: 34, east: 56, south: 15, north: 33 }
      const w = this.el.clientWidth - 2 * PAD, h = this.el.clientHeight - 2 * PAD
      const sx = w / Math.max(1e-9, b.east - b.west), sy = h / Math.max(1e-9, b.north - b.south)
      const s = Math.min(sx, sy)
      const ox = PAD + (w - s * (b.east - b.west)) / 2, oy = PAD + (h - s * (b.north - b.south)) / 2
      return { x: ox + (lng - b.west) * s, y: oy + (b.north - lat) * s }
    }
  }
  class OverlayView {
    setMap(map) { if (map) { this.map = map; this.onAdd && this.onAdd(); this.draw && this.draw() } else { this.onRemove && this.onRemove(); this.map = null } }
    getPanes() { return this.map ? { overlayMouseTarget: this.map.pane } : null }
    getProjection() { const m = this.map; return m && { fromLatLngToDivPixel: (p) => m.project(p), fromLatLngToContainerPixel: (p) => m.project(p) } }
    static preventMapHitsAndGesturesFrom() {}
  }
  class Polyline {
    constructor(options) {
      this.options = options; this.map = null
      record.polylines.push({ path: options.path, strokeColor: options.strokeColor, strokeWeight: options.strokeWeight, zIndex: options.zIndex, clickable: options.clickable })
      if (options.map) this.setMap(options.map)
    }
    setMap(map) {
      if (this.line) { this.line.remove(); this.line = null }
      this.map = map
      if (!map) return
      const [a, b] = this.options.path.map((p) => map.project(p))
      this.line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      for (const [k, v] of Object.entries({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: this.options.strokeColor, 'stroke-width': this.options.strokeWeight, 'stroke-opacity': this.options.strokeOpacity ?? 1 })) this.line.setAttribute(k, String(v))
      // SVG stacks in document order: a higher zIndex goes after every lower one, as Google stacks polylines.
      this.line.dataset.z = String(this.options.zIndex ?? 0)
      const above = [...map.svg.children].find((l) => Number(l.dataset.z) > Number(this.line.dataset.z))
      map.svg.insertBefore(this.line, above ?? null)
    }
  }
  window.google = { maps: {
    importLibrary: async () => ({ Map, RenderingType: { RASTER: 'RASTER' }, Polyline }),
    ControlPosition: { TOP_LEFT: 'TOP_LEFT', TOP_RIGHT: 'TOP_RIGHT' },
    OverlayView,
    event: { addListenerOnce(target, ev, fn) { const l = target.addListener(ev, () => { l.remove(); fn() }); return l } },
  } }
  window[${JSON.stringify(callback)}]()
})()`
}

/** Routes Google's script to the stand-in on a page (no key leaves the machine; no other Google host is asked). */
export async function standInGoogle(page) {
  const asked = []
  await page.route('https://maps.googleapis.com/**', (route) => {
    const url = new URL(route.request().url())
    asked.push(url.pathname)
    return route.fulfill({ status: 200, contentType: 'application/javascript', body: googleStandInScript(url.searchParams.get('callback') ?? '__omsGoogleMapsReady') })
  })
  return asked
}
