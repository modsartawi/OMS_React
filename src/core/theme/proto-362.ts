/* PROTOTYPE 362 — throwaway (branch prototype/362-ops-console-tokens).
 *
 * Question: which exact Ops Console tokens, row height and grid text size?
 * Three palettes on the REAL app, switched by `html[data-palette]`:
 *   steel — today's POS system (baseline, no attribute)
 *   far   — A, "Far as drawn": neutral greys, cobalt accent, gold cursor bar
 *   navy  — B, "Navy-led": navy-tinted neutrals, navy-lifted accent, navy bar in light
 * plus rows 24/26/28 and grid text 12/12.5/13. Light/dark is the app's own toggle.
 *
 * Every setting lives in localStorage and a change RELOADS, because the grid
 * theme + row height are read once at module load (as production reads them).
 * `?palette=&rows=&size=&stub=` in the URL override and persist — so a capture
 * script can drive it.
 *
 * `stub=1` installs a fetch shim with fictional envelopes, because SIS.Api was
 * down when this was built. It patches window.fetch — prototype only.
 */
export type Palette = 'steel' | 'far' | 'navy'
export type ProtoSettings = { palette: Palette; rows: number; size: number; stub: boolean }

const KEY = 'proto362'
// PROTOTYPE 368: B "Navy-led" (362's pick) on stub data by default.
const DEFAULTS: ProtoSettings = { palette: 'navy', rows: 26, size: 12, stub: true }

function read(): ProtoSettings {
  let s: ProtoSettings = { ...DEFAULTS }
  try {
    const stored = localStorage.getItem(KEY)
    if (stored) s = { ...s, ...(JSON.parse(stored) as Partial<ProtoSettings>) }
  } catch {
    /* prototype: ignore */
  }
  const q = new URLSearchParams(location.search)
  const palette = q.get('palette')
  if (palette === 'steel' || palette === 'far' || palette === 'navy') s.palette = palette
  if (q.get('rows')) s.rows = Number(q.get('rows'))
  if (q.get('size')) s.size = Number(q.get('size'))
  if (q.get('stub')) s.stub = q.get('stub') === '1'
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* prototype: ignore */
  }
  return s
}

export const proto: ProtoSettings = import.meta.env.DEV ? read() : { ...DEFAULTS, palette: 'steel' }

if (proto.palette === 'steel') delete document.documentElement.dataset.palette
else document.documentElement.dataset.palette = proto.palette

export function setProto(next: Partial<ProtoSettings>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...proto, ...next }))
  } catch {
    /* prototype: ignore */
  }
  const url = new URL(location.href)
  for (const k of ['palette', 'rows', 'size', 'stub']) url.searchParams.delete(k)
  location.replace(url.toString())
}

// --- stub data (fictional) ----------------------------------------------------

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const NAMES = ['Noura Al-Harbi', 'Faisal Qahtani', 'Reem Al-Otaibi', 'Omar Zahrani', 'Lama Shehri', 'Sultan Dosari']
const SLOTS = ['08:00 - 10:00', '10:00 - 12:00', '12:00 - 14:00', '16:00 - 18:00', '18:00 - 20:00']
const CITIES = ['Riyadh', 'Jeddah', 'Dammam', 'Khobar']
const DISTRICTS = ['Al Olaya', 'Al Malaz', 'An Nakheel', 'Ar Rawdah']

/* PROTOTYPE 368: a richer, date-relative pool (status codes per 369, reschedules,
   courier times) so lenses, the inspector timeline and relative-date views have
   something to bite on. Day offset 0..5 = today..5 days ago. */
const pad = (n: number) => String(n).padStart(2, '0')
function localIso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}
function at(dayOffset: number, hour: number, minute: number) {
  const d = new Date()
  d.setDate(d.getDate() - dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d
}
const POOL = 64

function delivery(i: number) {
  const net = Math.round((35 + ((i * 73.37) % 900)) * 100) / 100
  const paid = i % 4 === 0 ? 0 : net
  const dayOffset = i % 6
  const created = at(dayOffset, 8 + (i % 11), (i * 7) % 60)
  const pickup = i % 5 === 4
  // Lifecycle per 369: Created → Ready (R/C) → Out (O) → Delivered (D).
  const stage = i % 4 // 0 created · 1 ready · 2 out · 3 delivered
  const ready = stage >= 1 ? (i % 2 ? 'R' : 'C') : ''
  const deliveryStatus = stage === 3 ? 'D' : stage === 2 && !pickup ? 'O' : ''
  const close = i % 11 === 3 ? 'R' : i % 13 === 5 ? 'C' : i === 27 ? 'X' : ''
  const out = deliveryStatus ? new Date(created.getTime() + 2.5 * 3600e3) : null
  const done = deliveryStatus === 'D' ? new Date(created.getTime() + 4 * 3600e3) : null
  const slotIdx = i % SLOTS.length
  const slotFromH = [8, 10, 12, 16, 18][slotIdx]
  const rescheduled = i % 6 === 1
  return {
    deliveryNo: String(80001300 - i),
    documentNo: String(1000000393 + i * 7),
    deliveryDocumentType: i % 5 === 0 ? 'Return' : 'Forward',
    orderNo: String(900120 + i * 3),
    storeCode: ['1001', '1002', '1017', '2040'][i % 4],
    documentDate: localIso(at(dayOffset, 0, 0)),
    deliveryType: pickup ? 'PickInStore' : 'Delivery',
    documentType: ['CLCN', 'WEBO', 'APPO'][i % 3],
    documentSource: ['Web', 'App', 'Call center'][i % 3],
    entryTime: localIso(created),
    isActiveInStore: i % 7 !== 0,
    timeSlotDescription: SLOTS[slotIdx],
    timeSlotDay: localIso(at(dayOffset, 0, 0)).slice(0, 10),
    deliveryScheduleFromTime: localIso(at(dayOffset, slotFromH, 0)),
    deliveryScheduleToTime: localIso(at(dayOffset, slotFromH + 2, 0)),
    customerName: NAMES[i % NAMES.length],
    customerPhone: `05${String(10000000 + i * 1373).slice(0, 8)}`,
    netTotal: net,
    paidAmount: paid,
    deliveryFees: i % 3 === 0 ? 25 : 10,
    amountDue: Math.round((net - paid) * 100) / 100,
    failedJobsCount: i % 9 === 2 ? 1 + (i % 3) : 0,
    rescheduled,
    rescheduledUser: rescheduled ? 'm.sartawi' : '',
    rescheduledTime: rescheduled ? localIso(new Date(created.getTime() + 3600e3)) : '',
    rescheduledReason: rescheduled ? 'Customer not available' : '',
    courierCode: pickup ? '' : ['JAH', 'MRS', 'CAR'][i % 3],
    courierDriverId: deliveryStatus && !pickup ? String(7700 + i) : '',
    courierDriverName: deliveryStatus && !pickup ? ['Khalid N.', 'Ahmed S.', 'Yousef A.'][i % 3] : '',
    courierDriverPhone: deliveryStatus && !pickup ? `05${String(55000000 + i * 911).slice(0, 8)}` : '',
    customerOtp: String(4000 + ((i * 37) % 6000)),
    lastAction: deliveryStatus === 'D' ? 'DDLR' : deliveryStatus === 'O' ? 'DOFD' : ready ? 'DRDY' : 'DCRT',
    readyStatus: ready,
    clearStatus: '',
    deliveryStatus,
    closeStatus: close,
    outForDeliveryTime: out ? localIso(out) : '',
    actualDeliveryTime: done ? localIso(done) : '',
    cityName: CITIES[i % CITIES.length],
    districtName: DISTRICTS[i % DISTRICTS.length],
    street1: `${12 + i} ${['King Fahd Rd', 'Tahlia St', 'Prince Sultan St', 'Olaya St'][i % 4]}`,
    isExpressDelivery: i % 3 === 0,
    expressCourierId: i % 3 === 0 ? `NOW-${3300 + i}` : '',
    note: i % 5 === 0 ? 'Call before arrival' : '',
    documentReason: '',
    reasonDescription: i % 8 === 6 ? 'Customer request' : '',
  }
}

/** The list stub honours Limit, the date pair and the identity/attribute filters. */
function deliveryList(q: URLSearchParams) {
  let rows = Array.from({ length: POOL }, (_, i) => delivery(i))
  const eq = (param: string, field: keyof ReturnType<typeof delivery>) => {
    const v = q.get(param)
    if (v) rows = rows.filter((r) => String(r[field]).toLowerCase() === v.toLowerCase())
  }
  eq('StoreCode', 'storeCode')
  eq('DeliveryNo', 'deliveryNo')
  eq('DocumentNo', 'documentNo')
  eq('OrderNo', 'orderNo')
  eq('DocumentType', 'documentType')
  eq('DocumentSource', 'documentSource')
  eq('DeliveryDocumentType', 'deliveryDocumentType')
  eq('DeliveryType', 'deliveryType')
  const phone = q.get('CustomerPhone')
  if (phone) rows = rows.filter((r) => r.customerPhone.includes(phone))
  const express = q.get('IsExpress')
  if (express) rows = rows.filter((r) => r.isExpressDelivery === (express === 'true'))
  const from = q.get('FromDate')
  const to = q.get('ToDate')
  if (from && to) rows = rows.filter((r) => r.entryTime.slice(0, 10) >= from && r.entryTime.slice(0, 10) <= to)
  rows.sort((a, b) => b.deliveryNo.localeCompare(a.deliveryNo))
  return rows.slice(0, Number(q.get('Limit') || 200))
}

const DOCUMENT = {
  documentNo: '1000000393',
  deliveryNo: '80001240',
  storeCode: '1001',
  documentType: 'CLCN',
  documentTypeDescription: 'Call Center',
  documentCategory: 'O',
  deliveryType: 'P',
  customerName: 'Noura Al-Harbi',
  lines: [
    { itemNumber: '000010', materialCode: '100234', materialDescription: 'Panadol Extra 500mg 24s', quantity: 2, netValue: 30 },
    { itemNumber: '000020', materialCode: '100877', materialDescription: 'Vitamin C 1000mg Effervescent', quantity: 1, netValue: 90.5 },
  ],
  conditions: [],
  status: { overallStatus: 'A', lastAction: 'X', lastActionDescription: 'Created' },
}

function stubFor(path: string, query: URLSearchParams): Response {
  if (path === 'Auth/Me')
    return envelope({ authenticated: true, userId: 'proto', displayName: 'Prototype 368', currentStoreCode: '1001' })
  if (path === 'SdDocumentWeb/DeliveryDocumentList') return envelope(deliveryList(query))
  if (/^SdDocumentWeb\/Document\/[^/]+\/(Outbox|Logs)$/.test(path)) return envelope([])
  if (/^SdDocumentWeb\/(Document|Delivery)\/[^/]+$/.test(path)) return envelope(DOCUMENT)
  if (/^SdDocument\/(DocumentTypes|DocumentSources|DeliveryDocumentTypes)$/.test(path)) return envelope([])
  if (/Access$/.test(path)) return envelope({ screenAllowed: true, allowed: true, canOpenList: true, canOpenDetail: true })
  return envelope({})
}

if (import.meta.env.DEV && proto.stub) {
  const real = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const at = url.indexOf('/api/')
    if (at === -1) return real(input, init)
    const [path, qs] = url.slice(at + 5).split('?')
    // A little latency so "Searching…" and the stale-rows-while-searching state are visible.
    await new Promise((r) => setTimeout(r, path === 'SdDocumentWeb/DeliveryDocumentList' ? 350 : 0))
    return stubFor(path, new URLSearchParams(qs ?? ''))
  }
}
