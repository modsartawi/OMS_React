// Stub fixtures for the IDF priority drives (BackOffice spec 3157; oms ticket 619 creates them, 620–627 EXTEND
// them). Shapes are the brief's (`BackOffice/.issues/assets/3157-oms-react-idf-brief.md`); the BackOffice ticket
// that builds a door owns its final spelling, and oms 628 reconciles. Every time is LOCAL (no `Z`). Never a live
// SIS.Api.
//
// ⚠️ To keep parallel slices merge-clean: add your fixtures and your doors under YOUR ticket's slot only (the blank
// lines between slots keep the hunks apart), and route them from `idfStub` through your own `…Stub` function.
//
// Used by: tools/idf-masters-drive.mjs (619) and every later IDF drive.

export { envelope } from './insurance-rules-stubs.mjs'
import { envelope } from './insurance-rules-stubs.mjs'

/** A bare 403: no envelope code, so the page draws its own "no access". */
export const bare403 = () => ({ status: 403, body: '' })

// --- 619 --- the masters list (door 3161: `GET IdfPriority/masters`).
export const IDF_MASTERS = [
  {
    masterId: 'M-BUPA',
    kind: 'insurer',
    payerCode: 'BUPA',
    nameEn: 'Bupa general',
    nameAr: 'بوبا العام',
    hardThreshold: 5,
    reminderThreshold: 2,
    liveVersion: { versionId: 'V-11', number: 3, by: 'nalharbi', at: '2026-10-20T09:15:00', note: 'October refresh' },
  },
  {
    masterId: 'M-TAW-PILOT',
    kind: 'insurer',
    payerCode: 'TAWUNIYA',
    storeListId: 'SL-PILOT',
    nameEn: 'Tawuniya on the pilot stores',
    nameAr: 'التعاونية في صيدليات التجربة',
    hardThreshold: null,
    reminderThreshold: null,
    liveVersion: null,
  },
  {
    masterId: 'M-OPS',
    kind: 'store',
    storeListId: 'SL-OPS',
    nameEn: 'Operation pharmacies',
    nameAr: 'صيدليات التشغيل',
    hardThreshold: 4,
    reminderThreshold: 1,
    liveVersion: { versionId: 'V-4', number: 1, by: 'falotaibi', at: '2026-10-01T14:02:00', note: null },
  },
]

export function newIdfState() {
  return { masters: structuredClone(IDF_MASTERS) }
}

/** `deny` names the doors answered a bare 403 (`'masters'`). */
export function idfMastersStub(method, path, opts = {}) {
  const { state = newIdfState(), deny = [], reads = {} } = opts
  if (method === 'GET' && path === 'IdfPriority/masters') {
    reads.masters = (reads.masters ?? 0) + 1
    if (deny.includes('masters')) return bare403()
    return envelope(state.masters)
  }
  return null
}

// --- 620 --- store lists (door 3162).
// `GET`, `POST`, `PUT …/{id}` (rename), `PUT …/{id}/stores { storeCodes }`, `DELETE …/{id}` (not in the brief's
// sketch; 628 confirms). State lives on `state.storeLists`, made on first use so `newIdfState` stays 619's.
// A name already taken is refused `NAME_TAKEN`; deleting the pilot list is refused `PILOT_LIST`.
export const IDF_STORE_LISTS = [
  { storeListId: 'SL-OPS', name: 'Operation pharmacies', isPilotList: false, storeCodes: ['P001', 'P002', 'P014'] },
  { storeListId: 'SL-PILOT', name: 'Pilot rollout', isPilotList: true, storeCodes: ['P003', 'P007'] },
]

/** `deny` may name `'storeLists'` (the read answered a bare 403); `sent` collects each write's method, path and body. */
export function idfStoreListsStub(method, path, body, opts = {}) {
  const { state = newIdfState(), deny = [], reads = {}, sent = [] } = opts
  if (!path.startsWith('IdfPriority/store-lists')) return null
  state.storeLists ??= structuredClone(IDF_STORE_LISTS)
  const lists = state.storeLists
  const refuse = (message, errorCode) => envelope(null, { status: 400, success: false, message, errorCode })
  const taken = (name, id) => lists.some((l) => l.storeListId !== id && l.name.toLowerCase() === String(name ?? '').trim().toLowerCase())
  if (method !== 'GET') sent.push({ method, path, body })
  if (method === 'GET' && path === 'IdfPriority/store-lists') {
    reads.storeLists = (reads.storeLists ?? 0) + 1
    if (deny.includes('storeLists')) return bare403()
    return envelope(lists)
  }
  if (method === 'POST' && path === 'IdfPriority/store-lists') {
    if (taken(body?.name)) return refuse('A store list with this name already exists.', 'NAME_TAKEN')
    const list = { storeListId: `SL-${lists.length + 1}`, name: body.name, isPilotList: false, storeCodes: [] }
    lists.push(list)
    return envelope(list)
  }
  const m = /^IdfPriority\/store-lists\/([^/]+)(\/stores)?$/.exec(path)
  const list = m && lists.find((l) => l.storeListId === decodeURIComponent(m[1]))
  if (!list) return envelope(null, { status: 404, success: false, message: 'No such store list.', errorCode: 'NOT_FOUND' })
  if (method === 'PUT' && m[2]) {
    list.storeCodes = [...body.storeCodes]
    return envelope(list)
  }
  if (method === 'PUT') {
    if (taken(body?.name, list.storeListId)) return refuse('A store list with this name already exists.', 'NAME_TAKEN')
    list.name = body.name
    return envelope(list)
  }
  if (method === 'DELETE') {
    if (list.isPilotList) return refuse('The pilot list cannot be deleted.', 'PILOT_LIST')
    state.storeLists = lists.filter((l) => l !== list)
    return envelope(null)
  }
  return null
}

// --- 621 --- create / edit a master (door 3161).
// `POST IdfPriority/masters`, `PUT …/{id}` on `state.masters`. An overlapping scope — another master of the same
// kind for the same payer and store list (insurer), or another store master on the same store list (store; the
// stub reads "share a store" as "the same list") — is refused `OVERLAPPING_SCOPE`, the message naming the clash
// and `data.clashingMasterId` carrying it. Kind is kept on PUT whatever the body says. `opts.sent` collects writes.
export function idfMasterFormStub(method, path, body, opts = {}) {
  const { state = newIdfState(), sent = [] } = opts
  const edit = /^IdfPriority\/masters\/([^/]+)$/.exec(path)
  if (!((method === 'POST' && path === 'IdfPriority/masters') || (method === 'PUT' && edit))) return null
  sent.push({ method, path, body })
  const id = edit ? decodeURIComponent(edit[1]) : null
  const current = id ? state.masters.find((m) => m.masterId === id) : null
  if (id && !current) return envelope(null, { status: 404, success: false, message: 'No such master.', errorCode: 'NOT_FOUND' })
  const kind = current?.kind ?? body.kind
  const clash = state.masters.find(
    (m) =>
      m.masterId !== id &&
      m.kind === kind &&
      (kind === 'store' ? m.storeListId === body.storeListId : m.payerCode === body.payerCode && (m.storeListId ?? null) === (body.storeListId ?? null)),
  )
  if (clash)
    return {
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 409,
        success: false,
        message: `This scope overlaps the master "${clash.nameEn}" (${clash.masterId}).`,
        data: { clashingMasterId: clash.masterId },
        errors: [{ errorCode: 'OVERLAPPING_SCOPE', errorMessage: `This scope overlaps the master "${clash.nameEn}" (${clash.masterId}).` }],
      }),
    }
  const fields = { payerCode: body.payerCode, storeListId: body.storeListId, nameEn: body.nameEn, nameAr: body.nameAr, hardThreshold: body.hardThreshold, reminderThreshold: body.reminderThreshold }
  if (current) {
    Object.assign(current, fields)
    return envelope(current)
  }
  const master = { masterId: `M-NEW-${state.masters.length + 1}`, kind, ...fields, liveVersion: null }
  state.masters.push(master)
  return envelope(master)
}

// --- 622 --- upload, row report, publish (door 3161).
// The report depends on the file's NAME: one containing `dirty` fails three rows (in the server's order), one
// containing `notok` says `ok: false` with no rows, any other is clean. `body` is the raw multipart text (the
// drive passes `postData()`); `opts.uploads` keeps what was uploaded, `opts.published` what was published.
export const IDF_DIRTY_ROWS = [
  { line: 3, itemNumber: '100234', rule: 'unknownItem', messageEn: 'Item 100234 does not exist.', messageAr: 'الصنف 100234 غير موجود.' },
  { line: 7, itemNumber: '100871', rule: 'notInItemCustomer', messageEn: 'Item 100871 is not one of Bupa\'s items.', messageAr: 'الصنف 100871 ليس من أصناف بوبا.' },
  { line: 9, itemNumber: '100555', rule: 'badPriority', messageEn: 'Priority "1.5" is not a whole number of 1 or more.', messageAr: 'الأولوية "1.5" ليست عددًا صحيحًا يساوي 1 أو أكثر.' },
]

export function idfUploadStub(method, path, body, opts = {}) {
  const { state = newIdfState(), uploads = {}, published = [] } = opts
  const up = /^IdfPriority\/masters\/([^/]+)\/uploads$/.exec(path)
  if (method === 'POST' && up) {
    const name = /filename="([^"]*)"/.exec(String(body ?? ''))?.[1] ?? ''
    const uploadId = `U-${Object.keys(uploads).length + 1}`
    const dirty = /dirty/i.test(name)
    const report = { uploadId, ok: !dirty && !/notok/i.test(name), rows: dirty ? IDF_DIRTY_ROWS : [] }
    uploads[uploadId] = { masterId: decodeURIComponent(up[1]), name, report }
    return envelope(report)
  }
  const pub = /^IdfPriority\/masters\/([^/]+)\/uploads\/([^/]+)\/publish$/.exec(path)
  if (method === 'POST' && pub) {
    const masterId = decodeURIComponent(pub[1])
    const u = uploads[decodeURIComponent(pub[2])]
    if (!u || !u.report.ok)
      return envelope(null, { status: 400, success: false, message: 'This upload has failing rows and cannot be published.', errorCode: 'UPLOAD_NOT_CLEAN' })
    const m = state.masters.find((x) => x.masterId === masterId)
    const number = (m?.liveVersion?.number ?? 0) + 1
    const version = { versionId: `V-${masterId}-${number}`, number, by: 'msartawi', at: '2026-10-27T10:30:00', note: body?.note ?? null }
    if (m) m.liveVersion = version
    published.push({ masterId, uploadId: pub[2], note: body?.note })
    return envelope(version)
  }
  return null
}

// --- 623 --- versions and restore (door 3161).

// --- 624 --- exceptions (door 3166).
// The seed shapes of spec 3157 (SABIC skips; TCS offline, GOSI and delivery insurance skip) — server data the screen
// shows as it comes. `writes` records every POST / PUT / DELETE with its body (DELETE's reason is `?reason=`).
export const IDF_EXCEPTIONS = [
  { exceptionId: 'X-1', keyKind: 'documentType', key: 'SABIC', handling: 'skip', masterId: null, reason: 'SABIC contract orders', by: 'nalharbi', at: '2026-10-10T08:30:00' },
  { exceptionId: 'X-2', keyKind: 'subDocumentType', key: 'TCS-OFFLINE', handling: 'skip', masterId: null, reason: 'TCS offline', by: 'nalharbi', at: '2026-10-10T08:31:00' },
  { exceptionId: 'X-3', keyKind: 'nphiesClaimType', key: 'GOSI', handling: 'skip', masterId: null, reason: 'GOSI claims', by: 'falotaibi', at: '2026-10-11T12:00:00' },
  { exceptionId: 'X-4', keyKind: 'nphiesClaimType', key: 'DELIVERY', handling: 'master', masterId: 'M-OPS', reason: 'Delivery insurance uses the operation pharmacies', by: 'falotaibi', at: '2026-10-12T16:45:00' },
]

export function idfExceptionsStub(method, path, body, opts = {}) {
  const { state = newIdfState(), deny = [], reads = {}, writes = [] } = opts
  state.exceptions ??= structuredClone(IDF_EXCEPTIONS)
  const [bare, query = ''] = path.split('?')
  if (method === 'GET' && bare === 'IdfPriority/exceptions') {
    reads.exceptions = (reads.exceptions ?? 0) + 1
    if (deny.includes('exceptions')) return bare403()
    return envelope(state.exceptions)
  }
  const stamp = { by: 'msartawi', at: '2026-10-27T10:00:00' }
  if (method === 'POST' && bare === 'IdfPriority/exceptions') {
    writes.push({ method, path: bare, body })
    const row = { exceptionId: `X-${state.exceptions.length + 100}`, ...body, ...stamp }
    state.exceptions.push(row)
    return envelope(row)
  }
  const m = /^IdfPriority\/exceptions\/([^/]+)$/.exec(bare)
  if (m && method === 'PUT') {
    writes.push({ method, path: bare, body })
    const i = state.exceptions.findIndex((e) => e.exceptionId === decodeURIComponent(m[1]))
    state.exceptions[i] = { ...state.exceptions[i], ...body, ...stamp }
    return envelope(state.exceptions[i])
  }
  if (m && method === 'DELETE') {
    const reason = new URLSearchParams(query).get('reason')
    writes.push({ method, path: bare, reason })
    if (!reason) return envelope(null, { status: 400, success: false, message: 'A reason is required.', errorCode: 'REASON_REQUIRED' })
    state.exceptions = state.exceptions.filter((e) => e.exceptionId !== decodeURIComponent(m[1]))
    return envelope(null)
  }
  return null
}

// --- 625 --- lookup (door 3168).
// `GET IdfPriority/lookup?item=&store=&payer=&documentType=`. Keyed by `item|store|payer`; an unknown item is a
// business refusal (envelope `success:false`, `UNKNOWN_ITEM`). Tier spelling is 625's (`lookup.ts` IDF_TIERS).
export const IDF_LOOKUPS = {
  // Tawuniya decides at a store off the pilot list: one tier skipped.
  '100300|P019|TAWUNIYA': {
    decidingMaster: { masterId: 'M-TAW', kind: 'insurer', versionId: 'V-7' },
    skippedTiers: [{ tier: 'insurerStoreList', reasonEn: 'Store P019 is not on the pilot list', reasonAr: 'الصيدلية P019 ليست في قائمة التجربة' }],
    priority: 2,
    hardThreshold: 5,
    reminderThreshold: 2,
    group: [
      { itemNumber: '100200', descriptionEn: 'Panadol 500 mg', descriptionAr: 'بنادول ٥٠٠ مجم', priority: 1, sourceTier: 'insurer' },
      { itemNumber: '100300', descriptionEn: 'Adol 500 mg', descriptionAr: 'أدول ٥٠٠ مجم', priority: 2, sourceTier: 'insurer' },
      { itemNumber: '100400', descriptionEn: 'Fevadol 500 mg', descriptionAr: 'فيفادول ٥٠٠ مجم', priority: 3, sourceTier: 'general' },
    ],
  },
  // Nothing more specific decides: three tiers skipped, sent out of order; the cash rule carried.
  '200100|P001|CASH': {
    decidingMaster: null,
    skippedTiers: [
      { tier: 'operationPharmacy', reasonEn: 'The operation pharmacy master does not name the item', reasonAr: 'قائمة صيدليات التشغيل لا تذكر الصنف' },
      { tier: 'insurerStoreList', reasonEn: 'Store P001 is not on the pilot list', reasonAr: 'الصيدلية P001 ليست في قائمة التجربة' },
      { tier: 'insurer', reasonEn: 'No master for this payer', reasonAr: 'لا توجد قائمة لهذه الجهة الدافعة' },
    ],
    priority: 3,
    hardThreshold: null,
    reminderThreshold: null,
    cashNeverForces: true,
    group: [
      { itemNumber: '200050', descriptionEn: 'Brufen 200 mg', descriptionAr: 'بروفين ٢٠٠ مجم', priority: 1, sourceTier: 'general' },
      { itemNumber: '200100', descriptionEn: 'Brufen 400 mg', descriptionAr: 'بروفين ٤٠٠ مجم', priority: 3, sourceTier: 'general' },
    ],
  },
}
export const IDF_MASTER_TAW = {
  masterId: 'M-TAW',
  kind: 'insurer',
  payerCode: 'TAWUNIYA',
  nameEn: 'Tawuniya general',
  nameAr: 'التعاونية العام',
  hardThreshold: 5,
  reminderThreshold: 2,
  liveVersion: { versionId: 'V-7', number: 2, by: 'nalharbi', at: '2026-10-22T10:00:00', note: null },
}

/** `opts.lookups` collects each lookup's query string; `deny` may name `'lookup'`. */
export function idfLookupStub(method, path, opts = {}) {
  const { deny = [], reads = {}, lookups = [] } = opts
  const [bare, qs = ''] = path.split('?')
  if (method !== 'GET' || bare !== 'IdfPriority/lookup') return null
  reads.lookup = (reads.lookup ?? 0) + 1
  lookups.push(qs)
  if (deny.includes('lookup')) return bare403()
  const p = new URLSearchParams(qs)
  const hit = IDF_LOOKUPS[`${p.get('item')}|${p.get('store')}|${p.get('payer')}`]
  if (hit) return envelope(hit)
  return envelope(null, { status: 400, success: false, message: `Item ${p.get('item')} is not a known item.`, errorCode: 'UNKNOWN_ITEM' })
}

// --- 626 --- events (door 3167: `GET IdfPriority/events?from&to&store&payer&masterId&outcome&page`).
// 30 events, newest first, 25 a page (so a second page of 5). Event 1 is a forced pick on M-BUPA; every 6th has no
// item dispensed; the masters cycle M-BUPA, M-OPS, M-TAW-PILOT, and M-GONE (not in 619's list: shown by its id).
const IDF_EVENT_OUTCOMES_CYCLE = ['forcedPickTaken', 'reminder', 'pickCancelled', 'lineAbandoned', 'skippedByException', 'refusedPreAuth']
const IDF_EVENT_MASTERS_CYCLE = ['M-BUPA', 'M-OPS', 'M-TAW-PILOT', 'M-GONE']
export const IDF_EVENTS_PAGE_SIZE = 25
export const IDF_EVENTS = Array.from({ length: 30 }, (_, i) => {
  const n = i + 1
  const outcome = IDF_EVENT_OUTCOMES_CYCLE[i % 6]
  const masterId = IDF_EVENT_MASTERS_CYCLE[i % 4]
  return {
    eventId: `E-${String(n).padStart(3, '0')}`,
    at: `2026-10-${String(27 - Math.floor(i / 10)).padStart(2, '0')}T${String(20 - (i % 10)).padStart(2, '0')}:05:00`,
    storeCode: i % 2 ? 'P019' : 'P001',
    payerCode: i % 3 === 2 ? null : i % 3 ? 'TAWUNIYA' : 'BUPA',
    documentType: 'ZINS',
    itemScanned: String(100200 + n),
    itemDispensed: outcome === 'forcedPickTaken' || outcome === 'reminder' || outcome === 'skippedByException' ? String(100900 + n) : null,
    masterId,
    masterVersion: masterId === 'M-OPS' ? 1 : 3,
    outcome,
    timeSpentSeconds: 5 + n * 4,
  }
})

/** `deny` may name `'events'`; `reads.events` collects every query string asked. */
export function idfEventsStub(method, path, opts = {}) {
  const { deny = [], reads = {} } = opts
  const [bare, qs = ''] = path.split('?')
  if (method !== 'GET' || bare !== 'IdfPriority/events') return null
  ;(reads.events ??= []).push(qs)
  if (deny.includes('events')) return bare403()
  const q = new URLSearchParams(qs)
  const day = (at) => at.slice(0, 10)
  const rows = IDF_EVENTS.filter(
    (e) =>
      (!q.get('from') || day(e.at) >= q.get('from')) &&
      (!q.get('to') || day(e.at) <= q.get('to')) &&
      (!q.get('store') || e.storeCode === q.get('store')) &&
      (!q.get('payer') || e.payerCode === q.get('payer')) &&
      (!q.get('masterId') || e.masterId === q.get('masterId')) &&
      (!q.get('outcome') || e.outcome === q.get('outcome')),
  )
  const page = Number(q.get('page') || 1)
  const items = rows.slice((page - 1) * IDF_EVENTS_PAGE_SIZE, page * IDF_EVENTS_PAGE_SIZE)
  return envelope({ items, total: rows.length, page, pageSize: IDF_EVENTS_PAGE_SIZE })
}

// --- 627 --- swap report and export (door 3169).

/**
 * Every IDF door the drives stub: each slice's handler in turn, the first answer wins (null when none matched).
 * `path` is without `/api/` and may carry its query string.
 */
export function idfStub(method, path, body, opts = {}) {
  const bare = path.split('?')[0]
  return (
    idfMastersStub(method, bare, opts) ??
    // 620 · store lists
    idfStoreListsStub(method, bare, body, opts) ??
    // 621 · master form
    idfMasterFormStub(method, bare, body, opts) ??
    // 622 · upload
    idfUploadStub(method, bare, body, opts) ??
    // 623 · versions
    // 624 · exceptions
    idfExceptionsStub(method, path, body, opts) ??
    // 625 · lookup
    idfLookupStub(method, path, opts) ??
    // 626 · events
    idfEventsStub(method, path, opts) ??
    // 627 · swap report
    null
  )
}
