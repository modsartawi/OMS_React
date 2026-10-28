// Stub fixtures for the IDF priority drives (BackOffice spec 3157; oms ticket 619 creates them, 620–627 EXTEND
// them). Shapes are the doors AS BUILT — every dated line under `## Changes` in
// `BackOffice/.issues/assets/3157-oms-react-idf-brief.md` (oms 628 reconciled them: the payer key is the insurer's
// customer id, `insurerCustomerId`; refusals are `IDF-0000n`). Every time is LOCAL (no `Z`). Never a live SIS.Api.
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
    insurerCustomerId: '0001100336',
    nameEn: 'Bupa general',
    nameAr: 'بوبا العام',
    hardThreshold: 5,
    reminderThreshold: 2,
    liveVersion: { versionId: 'V-11', number: 3, by: 'nalharbi', at: '2026-10-20T09:15:00', note: 'October refresh', entryCount: 412, isLive: true },
  },
  {
    masterId: 'M-TAW-PILOT',
    kind: 'insurer',
    insurerCustomerId: '0001100412',
    storeListId: 'SL-PILOT',
    nameEn: 'Tawuniya on the pilot stores',
    nameAr: 'التعاونية في صيدليات التجربة',
    hardThreshold: 4,
    reminderThreshold: 1,
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
    liveVersion: { versionId: 'V-4', number: 1, by: 'falotaibi', at: '2026-10-01T14:02:00', note: '', entryCount: 96, isLive: true },
  },
  // 647 · the general master (tier 4, door 3191): the real door always lists it, last, with no version or thresholds.
  { masterId: 'general', kind: 'general', nameEn: 'General', nameAr: 'عام', liveVersion: null },
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
// `GET` (the pilot list first), `POST { code, nameEn, nameAr, storeCodes? }`, `PUT …/{id} { nameEn, nameAr }` (rename;
// the code never changes), `PUT …/{id}/stores { storeCodes }` (the whole set). No delete door. State lives on
// `state.storeLists`, made on first use so `newIdfState` stays 619's. A bad or taken code is refused `IDF-00017`; a
// blank name `IDF-00004`; a store code that is not P + digits is refused `IDF-00016` with `data.badStoreCodes`.
export const IDF_STORE_LISTS = [
  { storeListId: 'SL-PILOT', code: 'TIERS-PILOT', nameEn: 'Pilot rollout', nameAr: 'قائمة التجربة', isPilotList: true, storeCodes: ['P003', 'P007'], addedTime: '2026-10-01T08:00:00' },
  { storeListId: 'SL-OPS', code: 'OPS', nameEn: 'Operation pharmacies', nameAr: 'صيدليات التشغيل', isPilotList: false, storeCodes: ['P001', 'P002', 'P014'], addedTime: '2026-10-02T09:00:00' },
]

/** `deny` may name `'storeLists'` (the read answered a bare 403); `sent` collects each write's method, path and body. */
export function idfStoreListsStub(method, path, body, opts = {}) {
  const { state = newIdfState(), deny = [], reads = {}, sent = [] } = opts
  if (!path.startsWith('IdfPriority/store-lists')) return null
  state.storeLists ??= structuredClone(IDF_STORE_LISTS)
  const lists = state.storeLists
  const refuse = (message, errorCode, data) => envelope(data ?? null, { status: 400, success: false, message, errorCode })
  const namesBlank = (b) => !String(b?.nameEn ?? '').trim() || !String(b?.nameAr ?? '').trim()
  if (method !== 'GET') sent.push({ method, path, body })
  if (method === 'GET' && path === 'IdfPriority/store-lists') {
    reads.storeLists = (reads.storeLists ?? 0) + 1
    if (deny.includes('storeLists')) return bare403()
    return envelope(lists)
  }
  if (method === 'POST' && path === 'IdfPriority/store-lists') {
    const code = String(body?.code ?? '').trim()
    if (!code || /[^\x21-\x7E]|,/.test(code) || lists.some((l) => l.code === code))
      return refuse('An IDF store list needs a code of plain letters, digits and dashes. / يجب إدخال رمز لقائمة الفروع بأحرف وأرقام إنجليزية فقط.', 'IDF-00017')
    if (namesBlank(body)) return refuse('An IDF store list needs a name in English and in Arabic.', 'IDF-00004')
    const list = { storeListId: `SL-${lists.length + 1}`, code, nameEn: body.nameEn, nameAr: body.nameAr, isPilotList: false, storeCodes: [...(body.storeCodes ?? [])], addedTime: '2026-10-27T10:00:00' }
    lists.push(list)
    return envelope(list)
  }
  const m = /^IdfPriority\/store-lists\/([^/]+)(\/stores)?$/.exec(path)
  const list = m && lists.find((l) => l.storeListId === decodeURIComponent(m[1]))
  if (!list) return envelope(null, { status: 404, success: false, message: 'No such store list.', errorCode: 'IDF-00014' })
  if (method === 'PUT' && m[2]) {
    const bad = (body.storeCodes ?? []).filter((c) => !/^P\d+$/.test(c))
    if (bad.length) return refuse(`Unknown stores: ${bad.join(', ')}.`, 'IDF-00016', { badStoreCodes: bad })
    list.storeCodes = [...body.storeCodes]
    return envelope(list)
  }
  if (method === 'PUT') {
    if (namesBlank(body)) return refuse('An IDF store list needs a name in English and in Arabic.', 'IDF-00004')
    list.nameEn = body.nameEn
    list.nameAr = body.nameAr
    return envelope(list)
  }
  return null
}

// --- 621 --- create / edit a master (door 3161).
// `POST IdfPriority/masters`, `PUT …/{id}` on `state.masters`, body `{ kind, insurerCustomerId, storeListId, nameEn,
// nameAr, hardThreshold?, reminderThreshold? }`. An insurer master without an insurer is refused `IDF-00005`. An
// overlapping scope — another master of the same kind for the same insurer and store list (insurer), or another store
// master on the same store list (store; the stub reads "share a store" as "the same list") — is refused `IDF-00015`
// (a 400) with `data { masterId, clashingMasterId, clashingNameEn, clashingNameAr, sharedStores }`. Kind is kept on
// PUT whatever the body says. `opts.sent` collects writes.
export function idfMasterFormStub(method, path, body, opts = {}) {
  const { state = newIdfState(), sent = [] } = opts
  const edit = /^IdfPriority\/masters\/([^/]+)$/.exec(path)
  if (!((method === 'POST' && path === 'IdfPriority/masters') || (method === 'PUT' && edit))) return null
  sent.push({ method, path, body })
  const id = edit ? decodeURIComponent(edit[1]) : null
  const current = id ? state.masters.find((m) => m.masterId === id) : null
  if (id && !current) return envelope(null, { status: 404, success: false, message: 'No such master.', errorCode: 'NOT_FOUND' })
  const kind = current?.kind ?? body.kind
  if (kind === 'insurer' && !String(body.insurerCustomerId ?? '').trim())
    return envelope(null, { status: 400, success: false, message: "An insurer master needs the insurer's customer id.", errorCode: 'IDF-00005' })
  const clash = state.masters.find(
    (m) =>
      m.masterId !== id &&
      m.kind === kind &&
      (kind === 'store' ? m.storeListId === body.storeListId : m.insurerCustomerId === body.insurerCustomerId && (m.storeListId ?? null) === (body.storeListId ?? null)),
  )
  if (clash) {
    const shared = (state.storeLists ?? IDF_STORE_LISTS).find((l) => l.storeListId === clash.storeListId)?.storeCodes ?? []
    return envelope(
      { masterId: id ?? '', clashingMasterId: clash.masterId, clashingNameEn: clash.nameEn, clashingNameAr: clash.nameAr, sharedStores: shared },
      { status: 400, success: false, message: `This scope overlaps the master "${clash.nameEn}" (${clash.masterId}).`, errorCode: 'IDF-00015' },
    )
  }
  const fields = { insurerCustomerId: kind === 'insurer' ? body.insurerCustomerId : '', storeListId: body.storeListId, nameEn: body.nameEn, nameAr: body.nameAr, hardThreshold: body.hardThreshold, reminderThreshold: body.reminderThreshold }
  if (current) {
    Object.assign(current, fields)
    return envelope(current)
  }
  // 647 · a new master is numbered among the ranking masters and listed before the general one (always last)
  const ranked = state.masters.filter((m) => m.kind !== 'general')
  const master = { masterId: `M-NEW-${ranked.length + 1}`, kind, ...fields, liveVersion: null }
  state.masters.splice(ranked.length, 0, master)
  return envelope(master)
}

// --- 622 --- upload, row report, publish (door 3161).
// The report depends on the file's NAME: one containing `dirty` fails four rows (in the server's order), one
// containing `notok` says `ok: false` with no rows, any other is clean. `body` is the raw multipart text (the
// drive passes `postData()`); `opts.uploads` keeps what was uploaded, `opts.published` what was published.
export const IDF_DIRTY_ROWS = [
  { line: 3, itemNumber: '100234', rule: 'unknownItem', messageEn: 'Item 100234 does not exist.', messageAr: 'الصنف 100234 غير موجود.' },
  { line: 7, itemNumber: '100871', rule: 'notInInsurerItems', messageEn: 'Item 100871 is not one of Bupa\'s items.', messageAr: 'الصنف 100871 ليس من أصناف بوبا.' },
  { line: 8, itemNumber: '100302', rule: 'itemNotInGroup', messageEn: 'Item 100302 is not in IDF group IDF-PARA-500.', messageAr: 'الصنف 100302 ليس في مجموعة IDF-PARA-500.' },
  { line: 9, itemNumber: '100555', rule: 'badPriority', messageEn: 'Priority "1.5" is not a whole number of 1 or more.', messageAr: 'الأولوية "1.5" ليست عددًا صحيحًا يساوي 1 أو أكثر.' },
]

export function idfUploadStub(method, path, body, opts = {}) {
  const { state = newIdfState(), uploads = {}, published = [] } = opts
  const up = /^IdfPriority\/masters\/([^/]+)\/uploads$/.exec(path)
  if (method === 'POST' && up) {
    const name = /filename="([^"]*)"/.exec(String(body ?? ''))?.[1] ?? ''
    const uploadId = `U-${Object.keys(uploads).length + 1}`
    const dirty = /dirty/i.test(name)
    const report = { uploadId, ok: !dirty && !/notok/i.test(name), lineCount: 12, rows: dirty ? IDF_DIRTY_ROWS : [] }
    uploads[uploadId] = { masterId: decodeURIComponent(up[1]), name, report }
    return envelope(report)
  }
  const pub = /^IdfPriority\/masters\/([^/]+)\/uploads\/([^/]+)\/publish$/.exec(path)
  if (method === 'POST' && pub) {
    const masterId = decodeURIComponent(pub[1])
    const u = uploads[decodeURIComponent(pub[2])]
    if (!u || !u.report.ok)
      return envelope(null, { status: 400, success: false, message: 'This upload has failing rows and cannot be published.', errorCode: 'IDF-00011' })
    const m = state.masters.find((x) => x.masterId === masterId)
    const number = (m?.liveVersion?.number ?? 0) + 1
    const version = { versionId: `V-${masterId}-${number}`, number, by: 'msartawi', at: '2026-10-27T10:30:00', note: body?.note ?? '', entryCount: 12, isLive: true }
    if (m) m.liveVersion = version
    published.push({ masterId, uploadId: pub[2], note: body?.note })
    return envelope(version)
  }
  return null
}

// --- 623 --- versions and restore (door 3161).
// `GET IdfPriority/masters/{id}/versions` → the history (unsorted, the live one `isLive`); `POST …/versions/{vid}/
// restore { note }` → a NEW version (number = highest + 1) that becomes live on the master; the restored one stays as
// it was. A blank note is refused `NOTE_REQUIRED`; restoring the live one is refused `ALREADY_LIVE`. History lives on
// `state.versions[masterId]`, seeded from IDF_VERSIONS (or just the live version) on first use; `opts.restored`
// collects each restore.
export const IDF_VERSIONS = {
  'M-BUPA': [
    { versionId: 'V-2', number: 1, by: 'falotaibi', at: '2026-09-01T08:00:00', note: 'First list', entryCount: 380 },
    { versionId: 'V-11', number: 3, by: 'nalharbi', at: '2026-10-20T09:15:00', note: 'October refresh', entryCount: 412 },
    { versionId: 'V-7', number: 2, by: 'nalharbi', at: '2026-09-15T11:30:00', note: '', entryCount: 401 },
  ],
}

export function idfVersionsStub(method, path, body, opts = {}) {
  const { state = newIdfState(), deny = [], reads = {}, restored = [] } = opts
  const m = /^IdfPriority\/masters\/([^/]+)\/versions(?:\/([^/]+)\/restore)?$/.exec(path)
  if (!m) return null
  const masterId = decodeURIComponent(m[1])
  const master = state.masters.find((x) => x.masterId === masterId)
  state.versions ??= {}
  state.versions[masterId] ??= structuredClone(IDF_VERSIONS[masterId] ?? (master?.liveVersion ? [master.liveVersion] : []))
  const list = state.versions[masterId]
  // The master's live version may have moved by a publish (622): keep it in the history.
  if (master?.liveVersion && !list.some((v) => v.versionId === master.liveVersion.versionId)) list.push({ ...master.liveVersion })
  const liveId = master?.liveVersion?.versionId ?? null
  if (method === 'GET' && !m[2]) {
    reads.versions = (reads.versions ?? 0) + 1
    if (deny.includes('versions')) return bare403()
    return envelope(list.map((v) => ({ ...v, isLive: v.versionId === liveId })))
  }
  if (method === 'POST' && m[2]) {
    const versionId = decodeURIComponent(m[2])
    restored.push({ masterId, versionId, note: body?.note })
    const from = list.find((v) => v.versionId === versionId)
    if (!from) return envelope(null, { status: 404, success: false, message: 'No such version.', errorCode: 'NOT_FOUND' })
    if (!String(body?.note ?? '').trim()) return envelope(null, { status: 400, success: false, message: 'A note is required.', errorCode: 'NOTE_REQUIRED' })
    if (versionId === liveId) return envelope(null, { status: 400, success: false, message: 'This version is already live.', errorCode: 'ALREADY_LIVE' })
    const number = Math.max(0, ...list.map((v) => v.number)) + 1
    const version = { versionId: `V-${masterId}-${number}`, number, by: 'msartawi', at: '2026-10-27T11:00:00', note: body.note, entryCount: from.entryCount ?? 0, isLive: true }
    list.push(version)
    if (master) master.liveVersion = version
    return envelope(version)
  }
  return null
}

// --- 624 --- exceptions (door 3166).
// The seed shapes of spec 3157 (SABIC skips at every store; TCS offline, GOSI and delivery insurance) — server data the
// screen shows as it comes. `writes` records every POST / PUT / DELETE with its body (DELETE's `{ reason }` is in the
// BODY, as 3166 binds it). A blank reason is refused `IDF-00025`.
export const IDF_EXCEPTIONS = [
  { exceptionId: 'X-2', keyKind: 'subDocumentType', key: 'TCS-OFFLINE', handling: 'skip', masterId: '', allStores: false, reason: 'TCS offline', by: 'nalharbi', at: '2026-10-10T08:31:00' },
  { exceptionId: 'X-3', keyKind: 'nphiesClaimType', key: '3', handling: 'skip', masterId: '', allStores: false, reason: 'GOSI claims', by: 'falotaibi', at: '2026-10-11T12:00:00' },
  { exceptionId: 'X-4', keyKind: 'nphiesClaimType', key: '7', handling: 'master', masterId: 'M-OPS', allStores: false, reason: 'Delivery insurance uses the operation pharmacies', by: 'falotaibi', at: '2026-10-12T16:45:00' },
  { exceptionId: 'X-1', keyKind: 'documentType', key: 'SABIC', handling: 'skip', masterId: '', allStores: true, reason: 'SABIC contract orders', by: 'nalharbi', at: '2026-10-10T08:30:00' },
]

export function idfExceptionsStub(method, path, body, opts = {}) {
  const { state = newIdfState(), deny = [], reads = {}, writes = [] } = opts
  state.exceptions ??= structuredClone(IDF_EXCEPTIONS)
  const bare = path.split('?')[0]
  const refuseReason = () => envelope(null, { status: 400, success: false, message: 'A reason is required.', errorCode: 'IDF-00025' })
  if (method === 'GET' && bare === 'IdfPriority/exceptions') {
    reads.exceptions = (reads.exceptions ?? 0) + 1
    if (deny.includes('exceptions')) return bare403()
    return envelope(state.exceptions)
  }
  const stamp = { by: 'msartawi', at: '2026-10-27T10:00:00' }
  if (method === 'POST' && bare === 'IdfPriority/exceptions') {
    writes.push({ method, path: bare, body })
    if (!String(body?.reason ?? '').trim()) return refuseReason()
    const row = { exceptionId: `X-${state.exceptions.length + 100}`, ...body, masterId: body.masterId ?? '', allStores: body.allStores === true, ...stamp }
    state.exceptions.push(row)
    return envelope(row)
  }
  const m = /^IdfPriority\/exceptions\/([^/]+)$/.exec(bare)
  if (m && method === 'PUT') {
    writes.push({ method, path: bare, body })
    if (!String(body?.reason ?? '').trim()) return refuseReason()
    const i = state.exceptions.findIndex((e) => e.exceptionId === decodeURIComponent(m[1]))
    state.exceptions[i] = { ...state.exceptions[i], ...body, masterId: body.masterId ?? '', allStores: body.allStores === true, ...stamp }
    return envelope(state.exceptions[i])
  }
  if (m && method === 'DELETE') {
    const reason = body?.reason ?? null
    writes.push({ method, path: bare, reason })
    if (!String(reason ?? '').trim()) return refuseReason()
    const exceptionId = decodeURIComponent(m[1])
    state.exceptions = state.exceptions.filter((e) => e.exceptionId !== exceptionId)
    return envelope({ exceptionId })
  }
  return null
}

// --- 625 --- lookup (door 3168, 3166).
// `GET IdfPriority/lookup?item=&store=&payer=&documentType=&subDocumentType=&nphiesClaimType=`. Keyed by
// `item|store|payer` (payer = the insurer's customer id, '' for none); an unknown item is the business refusal
// `IDF-00019`. Tiers are the door's (`insurerAtStoreList | insurer | store | general`, plus `exceptionMaster`).
export const IDF_LOOKUPS = {
  // Tawuniya decides at a store off the pilot list: one tier skipped.
  '100300|P019|0001100412': {
    itemNumber: '100300',
    descriptionEn: 'Adol 500 mg',
    descriptionAr: 'أدول ٥٠٠ مجم',
    idfNumber: 'IDF-PARA-500',
    storeCode: 'P019',
    insurerCustomerId: '0001100412',
    documentType: null,
    documentTypeCanForcePick: null,
    decidingMaster: { masterId: 'M-TAW', kind: 'insurer', versionId: 'V-7', nameEn: 'Tawuniya general', nameAr: 'التعاونية العام' },
    exception: null,
    sourceTier: 'insurer',
    skippedTiers: [{ tier: 'insurerAtStoreList', reason: 'notOnPilotList', masterId: null, reasonEn: 'Store P019 is not on the pilot list', reasonAr: 'الصيدلية P019 ليست في قائمة التجربة' }],
    priority: 2,
    hardThreshold: 5,
    reminderThreshold: 2,
    group: [
      { itemNumber: '100200', descriptionEn: 'Panadol 500 mg', descriptionAr: 'بنادول ٥٠٠ مجم', priority: 1, sourceTier: 'insurer' },
      { itemNumber: '100300', descriptionEn: 'Adol 500 mg', descriptionAr: 'أدول ٥٠٠ مجم', priority: 2, sourceTier: 'insurer' },
      { itemNumber: '100400', descriptionEn: 'Fevadol 500 mg', descriptionAr: 'فيفادول ٥٠٠ مجم', priority: 3, sourceTier: 'general' },
    ],
  },
  // No insurer, a cash document type: nothing more specific decides, three tiers skipped (sent out of order).
  '200100|P001|': {
    itemNumber: '200100',
    descriptionEn: 'Brufen 400 mg',
    descriptionAr: 'بروفين ٤٠٠ مجم',
    idfNumber: 'IDF-IBU',
    storeCode: 'P001',
    insurerCustomerId: '',
    documentType: 'Cash',
    documentTypeCanForcePick: false,
    decidingMaster: null,
    exception: null,
    sourceTier: 'general',
    skippedTiers: [
      { tier: 'store', reason: 'masterDoesNotNameItem', masterId: 'M-OPS', reasonEn: 'The operation pharmacy master does not name the item', reasonAr: 'قائمة صيدليات التشغيل لا تذكر الصنف' },
      { tier: 'insurerAtStoreList', reason: 'noPayer', masterId: null, reasonEn: 'No insurer on the order', reasonAr: 'لا توجد شركة تأمين على الطلب' },
      { tier: 'insurer', reason: 'noPayer', masterId: null, reasonEn: 'No insurer on the order', reasonAr: 'لا توجد شركة تأمين على الطلب' },
    ],
    priority: 3,
    hardThreshold: 4,
    reminderThreshold: 1,
    group: [
      { itemNumber: '200050', descriptionEn: 'Brufen 200 mg', descriptionAr: 'بروفين ٢٠٠ مجم', priority: 1, sourceTier: 'general' },
      { itemNumber: '200100', descriptionEn: 'Brufen 400 mg', descriptionAr: 'بروفين ٤٠٠ مجم', priority: 3, sourceTier: 'general' },
    ],
  },
}
export const IDF_MASTER_TAW = {
  masterId: 'M-TAW',
  kind: 'insurer',
  insurerCustomerId: '0001100412',
  nameEn: 'Tawuniya general',
  nameAr: 'التعاونية العام',
  hardThreshold: 5,
  reminderThreshold: 2,
  liveVersion: { versionId: 'V-7', number: 2, by: 'nalharbi', at: '2026-10-22T10:00:00', note: '', entryCount: 220, isLive: true },
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
  const hit = IDF_LOOKUPS[`${p.get('item')}|${p.get('store')}|${p.get('payer') ?? ''}`]
  if (hit) return envelope(hit)
  return envelope(null, { status: 400, success: false, message: `Item ${p.get('item')} is not a known item.`, errorCode: 'IDF-00019' })
}

// --- 626 --- events (door 3167: `GET IdfPriority/events?from&to&store&payer&masterId&outcome&page&pageSize`).
// 30 events, newest first, 25 a page (so a second page of 5). Event 1 is a forced pick on M-BUPA; event 13 is an
// alternative taken (decision None); the outcomes otherwise cycle six (so no M-OPS event is a cancelled pick — the
// drive's empty state); the masters cycle M-BUPA, M-OPS, M-TAW-PILOT, and M-GONE (not in 619's list: shown by its
// id). Prices are per base unit; `durationMs` is decision to outcome.
const IDF_EVENT_OUTCOMES_CYCLE = ['forcedPickTaken', 'reminder', 'pickCancelled', 'lineAbandoned', 'skippedByException', 'refusedPreAuth']
const IDF_EVENT_MASTERS_CYCLE = ['M-BUPA', 'M-OPS', 'M-TAW-PILOT', 'M-GONE']
const IDF_EVENT_SOURCES = { 'M-BUPA': 'Insurer', 'M-OPS': 'Store', 'M-TAW-PILOT': 'InsurerAtStoreList', 'M-GONE': 'Insurer' }
export const IDF_EVENTS_PAGE_SIZE = 25
export const IDF_EVENTS = Array.from({ length: 30 }, (_, i) => {
  const n = i + 1
  const outcome = i === 12 ? 'alternativeTaken' : IDF_EVENT_OUTCOMES_CYCLE[i % 6]
  const masterId = IDF_EVENT_MASTERS_CYCLE[i % 4]
  const swapped = outcome === 'forcedPickTaken' || outcome === 'alternativeTaken'
  const at = `2026-10-${String(27 - Math.floor(i / 10)).padStart(2, '0')}T${String(20 - (i % 10)).padStart(2, '0')}:05:00`
  return {
    eventId: `E-${String(n).padStart(3, '0')}`,
    store: i % 2 ? 'P019' : 'P001',
    till: `0${(i % 3) + 1}`,
    trxNumber: String(5000100 + n),
    documentType: 'InsuranceOrder',
    subDocumentType: '',
    insurerCustomerId: i % 3 === 2 ? '' : i % 3 ? '0001100412' : '0001100336',
    idfNumber: 'IDF-PARA-500',
    scannedItemNumber: String(100200 + n),
    dispensedItemNumber: swapped ? String(100900 + n) : '',
    source: IDF_EVENT_SOURCES[masterId],
    masterId,
    masterVersionId: masterId === 'M-OPS' ? 'V-4' : 'V-11',
    priority: 2,
    hardThreshold: 4,
    reminderThreshold: 1,
    decision: outcome === 'forcedPickTaken' || outcome === 'pickCancelled' ? 'ForcedPick' : outcome === 'reminder' ? 'Reminder' : 'None',
    outcome,
    reason: outcome === 'reminder' && n % 2 ? 'allCandidatesDearer' : '',
    scannedUnitPrice: 12.5 + n,
    dispensedUnitPrice: swapped ? 10.25 + n : 0,
    decidedAt: at,
    occurredAt: at,
    durationMs: (5 + n * 4) * 1000,
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
      (!q.get('from') || day(e.occurredAt) >= q.get('from')) &&
      (!q.get('to') || day(e.occurredAt) <= q.get('to')) &&
      (!q.get('store') || e.store === q.get('store')) &&
      (!q.get('payer') || e.insurerCustomerId === q.get('payer')) &&
      (!q.get('masterId') || e.masterId === q.get('masterId')) &&
      (!q.get('outcome') || e.outcome === q.get('outcome')),
  )
  const page = Number(q.get('page') || 1)
  const pageSize = Number(q.get('pageSize') || IDF_EVENTS_PAGE_SIZE)
  return envelope({ page, pageSize, total: rows.length, rows: rows.slice((page - 1) * pageSize, page * pageSize) })
}

// --- 627 --- swap report and export (door 3169).
// `GET IdfPriority/swap-report?from&to&store&payer&masterId` → `{ from, to, rows, totals }`, rows master × store ×
// payer with fixed counts; `…/export` → an `.xlsx` (fake bytes, the server's name in `Content-Disposition`). The
// window is recorded, not applied: every row is in it. Prices per base unit.
const swapRow = (r) => ({
  events: 0, reminders: 0, remindersAllCandidatesDearer: 0, forcedPicksTaken: 0, alternativesTaken: 0, picksCancelled: 0,
  linesAbandoned: 0, skippedByException: 0, refusedPreAuth: 0, priceDifference: 0, totalDurationMs: 0, averageDurationMs: 0, ...r,
})
export const IDF_SWAP_REPORT = [
  swapRow({ masterId: 'M-BUPA', masterNameEn: 'Bupa general', masterNameAr: 'بوبا العام', store: 'P001', insurerCustomerId: '0001100336', events: 12, reminders: 4, remindersAllCandidatesDearer: 1, forcedPicksTaken: 6, alternativesTaken: 1, picksCancelled: 1, priceDifference: 182.5, totalDurationMs: 168000, averageDurationMs: 14000 }),
  swapRow({ masterId: 'M-BUPA', masterNameEn: 'Bupa general', masterNameAr: 'بوبا العام', store: 'P019', insurerCustomerId: '0001100336', events: 3, forcedPicksTaken: 2, linesAbandoned: 1, priceDifference: -12.25, totalDurationMs: 213000, averageDurationMs: 71000 }),
  swapRow({ masterId: 'M-OPS', masterNameEn: 'Operation pharmacies', masterNameAr: 'صيدليات التشغيل', store: 'P019', insurerCustomerId: '0001100412', events: 6, reminders: 3, skippedByException: 2, refusedPreAuth: 1, totalDurationMs: 56400, averageDurationMs: 9400 }),
  swapRow({ masterId: '', masterNameEn: '', masterNameAr: '', store: 'P001', insurerCustomerId: '', events: 2, picksCancelled: 2 }),
]
export const IDF_SWAP_EXPORT_NAME = 'idf-swap-report.xlsx'

export function idfReportStub(method, path, opts = {}) {
  const { deny = [], reads = {} } = opts
  const [bare, qs = ''] = path.split('?')
  if (method !== 'GET' || (bare !== 'IdfPriority/swap-report' && bare !== 'IdfPriority/swap-report/export')) return null
  const isExport = bare.endsWith('/export')
  ;(reads[isExport ? 'export' : 'report'] ??= []).push(qs)
  if (deny.includes('report')) return bare403()
  if (isExport)
    return {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${IDF_SWAP_EXPORT_NAME}"`,
      },
      body: Buffer.from('PK stub xlsx'),
    }
  const q = new URLSearchParams(qs)
  const rows = IDF_SWAP_REPORT.filter(
    (r) =>
      (!q.get('store') || r.store === q.get('store')) &&
      (!q.get('payer') || r.insurerCustomerId === q.get('payer')) &&
      (!q.get('masterId') || r.masterId === q.get('masterId')),
  )
  const sum = (k) => rows.reduce((t, r) => t + r[k], 0)
  const totals = swapRow({ masterId: '', masterNameEn: '', masterNameAr: '', store: '', insurerCustomerId: '' })
  for (const k of ['events', 'reminders', 'remindersAllCandidatesDearer', 'forcedPicksTaken', 'alternativesTaken', 'picksCancelled', 'linesAbandoned', 'skippedByException', 'refusedPreAuth', 'priceDifference', 'totalDurationMs'])
    totals[k] = sum(k)
  totals.averageDurationMs = totals.events ? Math.round(totals.totalDurationMs / totals.events) : 0
  return envelope({ from: q.get('from') ? `${q.get('from')}T00:00:00` : null, to: q.get('to') ? `${q.get('to')}T00:00:00` : null, rows, totals })
}

// --- 643 --- a version's items (door 3187).
// `GET IdfPriority/masters/{id}/versions/{vid}/entries?search&idf&page&pageSize` → one page `{ page, pageSize, total,
// rows }`. `search` matches the item number or either description (case-blind), `idf` one group exactly; 25 a page
// unless `pageSize` says. V-11 (Bupa live, v3) holds 60 items over 6 groups — three pages; V-7 (v2) and V-2 (v1) a
// few; V-4 (Ops live). A version not listed here (a new publish or restore) holds none. `opts.reads.entries` collects
// each read as `{ masterId, versionId, qs }`.
const IDF_GENERIC = [
  ['Panadol', 'بنادول'], ['Adol', 'أدول'], ['Fevadol', 'فيفادول'], ['Brufen', 'بروفين'], ['Augmentin', 'أوجمنتين'],
  ['Nexium', 'نيكسيوم'], ['Glucophage', 'جلوكوفاج'], ['Lipitor', 'ليبيتور'], ['Concor', 'كونكور'], ['Zyrtec', 'زيرتك'],
]
const IDF_ENTRY_GROUPS = ['IDF-PARA-500', 'IDF-IBU', 'IDF-AMOX', 'IDF-PPI', 'IDF-MET', 'IDF-STAT']
export const IDF_ENTRIES = {
  'V-11': IDF_ENTRY_GROUPS.flatMap((idfNumber, g) =>
    IDF_GENERIC.map(([en, ar], i) => ({
      itemNumber: String(100100 + g * 100 + i * 10),
      descriptionEn: `${en} ${g + 1}${i}0 mg`,
      descriptionAr: `${ar} ${g + 1}${i}0 مجم`,
      idfNumber,
      priority: i + 1,
    })),
  ),
  'V-7': [
    { itemNumber: '100200', descriptionEn: 'Panadol 500 mg', descriptionAr: 'بنادول ٥٠٠ مجم', idfNumber: 'IDF-PARA-500', priority: 2 },
    { itemNumber: '100300', descriptionEn: 'Adol 500 mg', descriptionAr: 'أدول ٥٠٠ مجم', idfNumber: 'IDF-PARA-500', priority: 1 },
    { itemNumber: '200100', descriptionEn: 'Brufen 400 mg', descriptionAr: 'بروفين ٤٠٠ مجم', idfNumber: 'IDF-IBU', priority: 1 },
  ],
  'V-2': [
    { itemNumber: '100200', descriptionEn: 'Panadol 500 mg', descriptionAr: 'بنادول ٥٠٠ مجم', idfNumber: 'IDF-PARA-500', priority: 1 },
    { itemNumber: '100400', descriptionEn: 'Fevadol 500 mg', descriptionAr: 'فيفادول ٥٠٠ مجم', idfNumber: 'IDF-PARA-500', priority: 2 },
  ],
  'V-4': [
    { itemNumber: '100200', descriptionEn: 'Panadol 500 mg', descriptionAr: 'بنادول ٥٠٠ مجم', idfNumber: 'IDF-PARA-500', priority: 1 },
    { itemNumber: '100300', descriptionEn: 'Adol 500 mg', descriptionAr: '', idfNumber: 'IDF-PARA-500', priority: 2 },
    { itemNumber: '200050', descriptionEn: 'Brufen 200 mg', descriptionAr: 'بروفين ٢٠٠ مجم', idfNumber: 'IDF-IBU', priority: 1 },
    { itemNumber: '200100', descriptionEn: 'Brufen 400 mg', descriptionAr: 'بروفين ٤٠٠ مجم', idfNumber: 'IDF-IBU', priority: 2 },
  ],
}
export const IDF_ENTRIES_PAGE_SIZE = 25

export function idfEntriesStub(method, path, opts = {}) {
  const { deny = [], reads = {} } = opts
  const [bare, qs = ''] = path.split('?')
  const m = /^IdfPriority\/masters\/([^/]+)\/versions\/([^/]+)\/entries$/.exec(bare)
  if (method !== 'GET' || !m) return null
  const masterId = decodeURIComponent(m[1])
  const versionId = decodeURIComponent(m[2])
  ;(reads.entries ??= []).push({ masterId, versionId, qs })
  if (deny.includes('entries')) return bare403()
  const q = new URLSearchParams(qs)
  const search = (q.get('search') ?? '').toLowerCase()
  const idf = q.get('idf') ?? ''
  const all = (IDF_ENTRIES[versionId] ?? []).filter(
    (r) =>
      (!idf || r.idfNumber === idf) &&
      (!search || r.itemNumber.includes(search) || r.descriptionEn.toLowerCase().includes(search) || r.descriptionAr.includes(search)),
  )
  const pageSize = Number(q.get('pageSize')) || IDF_ENTRIES_PAGE_SIZE
  const page = Math.max(1, Number(q.get('page')) || 1)
  return envelope({ page, pageSize, total: all.length, rows: all.slice((page - 1) * pageSize, page * pageSize) })
}

// --- 644 --- master export + template (door 3188): `GET IdfPriority/masters/{id}/versions/{vid}/export` → that version
// as `.xlsx` (server name `IDF_MASTER_EXPORT_NAME(masterId, versionId)`), `GET IdfPriority/masters/template` → the header.
// `opts.deny` `masterExport` / `masterTemplate` refuse on the JSON 400 envelope; `opts.noFileName` drops the
// `Content-Disposition` name so the client's fallback shows. `opts.reads.masterExport` collects `{ masterId, versionId }`,
// `opts.reads.masterTemplate` counts.
export const IDF_MASTER_EXPORT_NAME = (masterId, versionId) => `idf-${masterId}-${versionId}-20261028.xlsx`
export const IDF_MASTER_TEMPLATE_NAME = 'idf-master-template-20261028.xlsx'
export function idfMasterFilesStub(method, path, opts = {}) {
  const { deny = [], reads = {}, noFileName = false } = opts
  if (method !== 'GET') return null
  const bare = path.split('?')[0]
  const m = /^IdfPriority\/masters\/([^/]+)\/versions\/([^/]+)\/export$/.exec(bare)
  if (!m && bare !== 'IdfPriority/masters/template') return null
  const file = (name) => ({
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ...(noFileName ? {} : { 'Content-Disposition': `attachment; filename="${name}"` }),
    },
    body: Buffer.from('PK stub xlsx'),
  })
  if (!m) {
    reads.masterTemplate = (reads.masterTemplate ?? 0) + 1
    if (deny.includes('masterTemplate')) return envelope(null, { status: 400, success: false, message: 'The template could not be built.', errorCode: 'IDF-00040' })
    return file(IDF_MASTER_TEMPLATE_NAME)
  }
  const masterId = decodeURIComponent(m[1])
  const versionId = decodeURIComponent(m[2])
  ;(reads.masterExport ??= []).push({ masterId, versionId })
  if (deny.includes('masterExport')) return envelope(null, { status: 400, success: false, message: 'This version could not be exported.', errorCode: 'IDF-00041' })
  return file(IDF_MASTER_EXPORT_NAME(masterId, versionId))
}

// --- 645 --- draft (door 3189).
// One open draft per master on `state.drafts[masterId]`. `GET …/draft` → it or null; `POST …/draft` copies the live
// version's `IDF_ENTRIES` (refused while one is open, `data { by, changedAt }`); add / re-rank / remove re-check the
// upload rules and a failing edit is a 400 carrying `data { rule, messageEn, messageAr }` with the draft untouched:
// item `100234` → unknownItem, a group not in IDF_ENTRY_GROUPS → unknownGroup, item `100302` under any group but
// IDF-IBU → itemNotInGroup, a priority not a whole number ≥ 1 → badPriority, an item already in the draft →
// duplicateItem. Publish `{ note }` makes ONE new live version holding the draft's rows (registered in IDF_ENTRIES so
// 643's door reads them) and closes the draft; refused while `isStale` or without a note. `DELETE …/draft` discards.
// `opts.draftWrites` collects every write as `{ method, door, body }`.
const IDF_DRAFT_REFUSAL = 'IDF-00028'
function draftRuleRefusal(rule, messageEn, messageAr) {
  return envelope({ rule, messageEn, messageAr }, { status: 400, success: false, message: messageEn, errorCode: IDF_DRAFT_REFUSAL })
}
function draftPriorityProblem(priority) {
  return Number.isInteger(priority) && priority >= 1
    ? null
    : draftRuleRefusal('badPriority', `Priority "${priority}" is not a whole number of 1 or more.`, `الأولوية "${priority}" ليست عددًا صحيحًا يساوي 1 أو أكثر.`)
}

export function idfDraftStub(method, path, body, opts = {}) {
  const { state = newIdfState(), deny = [], draftWrites = [], published = [] } = opts
  const m = /^IdfPriority\/masters\/([^/]+)\/draft(?:\/(items(?:\/([^/]+))?|publish))?$/.exec(path)
  if (!m) return null
  const masterId = decodeURIComponent(m[1])
  const door = m[2] ? (m[2] === 'publish' ? 'publish' : 'items') : 'draft'
  const itemNumber = m[3] ? decodeURIComponent(m[3]) : null
  state.drafts ??= {}
  const master = state.masters.find((x) => x.masterId === masterId)
  const draft = state.drafts[masterId] ?? null
  if (method !== 'GET') draftWrites.push({ method, door, itemNumber, body })
  if (deny.includes('draft')) return bare403()
  const touch = (d) => {
    d.changedAt = '2026-10-28T10:05:00'
    return envelope(d)
  }

  if (door === 'draft' && method === 'GET') return envelope(draft)
  if (door === 'draft' && method === 'POST') {
    if (draft)
      return envelope({ by: draft.by, changedAt: draft.changedAt }, { status: 400, success: false, message: `A draft is already open by ${draft.by}.`, errorCode: 'IDF-00029' })
    const baseVersionId = master?.liveVersion?.versionId ?? null
    state.drafts[masterId] = {
      draftId: `D-${masterId}`,
      by: 'msartawi',
      startedAt: '2026-10-28T10:00:00',
      changedAt: '2026-10-28T10:00:00',
      baseVersionId,
      isStale: false,
      rows: structuredClone(IDF_ENTRIES[baseVersionId] ?? []),
    }
    return envelope(state.drafts[masterId])
  }
  if (door === 'draft' && method === 'DELETE') {
    if (!draft) return envelope(null, { status: 404, success: false, message: 'No draft is open.', errorCode: 'IDF-00030' })
    delete state.drafts[masterId]
    return envelope({ draftId: draft.draftId })
  }
  if (!draft) return envelope(null, { status: 404, success: false, message: 'No draft is open.', errorCode: 'IDF-00030' })

  if (door === 'items' && method === 'POST') {
    const { itemNumber: item = '', idfNumber = '', priority } = body ?? {}
    if (item === '100234') return draftRuleRefusal('unknownItem', 'Item 100234 does not exist.', 'الصنف 100234 غير موجود.')
    if (!IDF_ENTRY_GROUPS.includes(idfNumber)) return draftRuleRefusal('unknownGroup', `IDF group ${idfNumber} does not exist.`, `مجموعة IDF ${idfNumber} غير موجودة.`)
    if (item === '100302' && idfNumber !== 'IDF-IBU')
      return draftRuleRefusal('itemNotInGroup', `Item 100302 is not in IDF group ${idfNumber}.`, `الصنف 100302 ليس في مجموعة ${idfNumber}.`)
    const bad = draftPriorityProblem(priority)
    if (bad) return bad
    if (draft.rows.some((r) => r.itemNumber === item)) return draftRuleRefusal('duplicateItem', `Item ${item} is already in the draft.`, `الصنف ${item} موجود في المسودة.`)
    draft.rows.push({ itemNumber: item, descriptionEn: `Item ${item}`, descriptionAr: `الصنف ${item}`, idfNumber, priority })
    return touch(draft)
  }
  if (door === 'items' && itemNumber && (method === 'PUT' || method === 'DELETE')) {
    const at = draft.rows.findIndex((r) => r.itemNumber === itemNumber)
    if (at < 0) return envelope(null, { status: 404, success: false, message: `Item ${itemNumber} is not in the draft.`, errorCode: 'IDF-00031' })
    if (method === 'DELETE') draft.rows.splice(at, 1)
    else {
      const bad = draftPriorityProblem(body?.priority)
      if (bad) return bad
      draft.rows[at] = { ...draft.rows[at], priority: body.priority }
    }
    return touch(draft)
  }
  if (door === 'publish' && method === 'POST') {
    if (draft.isStale) return envelope(null, { status: 400, success: false, message: 'The live version has moved; rebase the draft first.', errorCode: 'IDF-00032' })
    if (!String(body?.note ?? '').trim()) return envelope(null, { status: 400, success: false, message: 'A note is required.', errorCode: 'NOTE_REQUIRED' })
    const number = (master?.liveVersion?.number ?? 0) + 1
    const version = { versionId: `V-${masterId}-${number}`, number, by: 'msartawi', at: '2026-10-28T10:30:00', note: body.note, entryCount: draft.rows.length, isLive: true }
    IDF_ENTRIES[version.versionId] = structuredClone(draft.rows)
    if (master) master.liveVersion = version
    delete state.drafts[masterId]
    published.push({ masterId, draftId: draft.draftId, note: body.note })
    return envelope(version)
  }
  return null
}

// --- 646 --- draft owner, rebase, add a group (door 3190).
// `POST …/draft/rebase` re-applies the draft's edits (its rows against `baseVersionId`'s: added / changed rows upserted,
// removed rows dropped) on the master's current live version, then `baseVersionId` = live and `isStale` = false.
// `POST …/draft/groups { idfNumber, priority }` adds every member of the group at that priority, each checked as an
// add: a member already in the draft → duplicateItem; `IDF_GROUP_MEMBERS` fixture members flagged `rule` are refused
// with it. Answers the draft spread with `{ added, rows }` (the brief's "the draft plus …"). An unknown group or a bad
// priority refuses the whole call as a single add does (645's `draftRuleRefusal`). Refusal codes are invented
// (IDF-00051+; the brief names none). Seed `state.drafts[masterId]` from the drive for someone else's / a stale draft.
export const IDF_GROUP_MEMBERS = {
  'IDF-CETI': [
    { itemNumber: '300100', descriptionEn: 'Zyrtec 10 mg', descriptionAr: 'زيرتك ١٠ مجم' },
    { itemNumber: '300110', descriptionEn: 'Cetirizine 10 mg', descriptionAr: 'سيتريزين ١٠ مجم' },
    { itemNumber: '300120', descriptionEn: 'Allercet 10 mg', descriptionAr: 'أليرسيت ١٠ مجم' },
    { itemNumber: '300130', descriptionEn: 'Cetal 10 mg', descriptionAr: 'سيتال ١٠ مجم', rule: 'notInInsurerItems', messageEn: 'Item 300130 is not on the insurer item list.', messageAr: 'الصنف 300130 ليس ضمن أصناف المؤمّن.' },
    { itemNumber: '300140', descriptionEn: 'Old cetirizine', descriptionAr: 'سيتريزين قديم', rule: 'unknownItem', messageEn: 'Item 300140 does not exist.', messageAr: 'الصنف 300140 غير موجود.' },
  ],
}

export function idfDraftOwnerStub(method, path, body, opts = {}) {
  const { state = newIdfState(), deny = [], draftWrites = [] } = opts
  const m = /^IdfPriority\/masters\/([^/]+)\/draft\/(rebase|groups)$/.exec(path)
  if (!m || method !== 'POST') return null
  const masterId = decodeURIComponent(m[1])
  const door = m[2]
  state.drafts ??= {}
  const draft = state.drafts[masterId] ?? null
  draftWrites.push({ method, door, body })
  if (deny.includes('draft')) return bare403()
  if (!draft) return envelope(null, { status: 404, success: false, message: 'No draft is open.', errorCode: 'IDF-00051' })
  draft.changedAt = '2026-10-28T10:20:00'

  if (door === 'rebase') {
    const live = state.masters.find((x) => x.masterId === masterId)?.liveVersion?.versionId ?? null
    const base = new Map((IDF_ENTRIES[draft.baseVersionId] ?? []).map((r) => [r.itemNumber, r]))
    const kept = new Set(draft.rows.map((r) => r.itemNumber))
    const edits = draft.rows.filter((r) => {
      const was = base.get(r.itemNumber)
      return !was || was.idfNumber !== r.idfNumber || was.priority !== r.priority
    })
    const rows = (IDF_ENTRIES[live] ?? []).filter((r) => !(base.has(r.itemNumber) && !kept.has(r.itemNumber))).map((r) => structuredClone(r))
    for (const e of edits) {
      const at = rows.findIndex((r) => r.itemNumber === e.itemNumber)
      if (at < 0) rows.push(structuredClone(e))
      else rows[at] = structuredClone(e)
    }
    Object.assign(draft, { rows, baseVersionId: live, isStale: false })
    return envelope(draft)
  }

  const { idfNumber = '', priority } = body ?? {}
  const members = IDF_GROUP_MEMBERS[idfNumber] ?? (IDF_ENTRY_GROUPS.includes(idfNumber) ? (IDF_ENTRIES['V-11'] ?? []).filter((r) => r.idfNumber === idfNumber) : null)
  if (!members) return draftRuleRefusal('unknownGroup', `IDF group ${idfNumber} does not exist.`, `مجموعة IDF ${idfNumber} غير موجودة.`)
  const bad = draftPriorityProblem(priority)
  if (bad) return bad
  const rows = []
  let added = 0
  for (const mem of members) {
    if (mem.rule) rows.push({ itemNumber: mem.itemNumber, rule: mem.rule, messageEn: mem.messageEn, messageAr: mem.messageAr })
    else if (draft.rows.some((r) => r.itemNumber === mem.itemNumber))
      rows.push({ itemNumber: mem.itemNumber, rule: 'duplicateItem', messageEn: `Item ${mem.itemNumber} is already in the draft.`, messageAr: `الصنف ${mem.itemNumber} موجود في المسودة.` })
    else {
      draft.rows.push({ itemNumber: mem.itemNumber, descriptionEn: mem.descriptionEn, descriptionAr: mem.descriptionAr, idfNumber, priority })
      added += 1
    }
  }
  return envelope({ ...draft, added, rows })
}

// --- 647 --- general master items (door 3191).
// `GET IdfPriority/general/items?search&idf&page&pageSize` → one page `{ page, pageSize, total, rows }` (643's shape),
// filtered and paged like the entries. `IDF_GENERAL_ITEMS` = 40 items over 4 groups (two pages of 25). 648/649 edit a
// copy in `state.general` (`state.general ??= structuredClone(IDF_GENERAL_ITEMS)`), which this read honours.
// `opts.reads.generalItems` collects each read's query string; `deny: ['generalItems']` answers a bare 403.
export const IDF_GENERAL_ITEMS = ['IDF-PARA-500', 'IDF-IBU', 'IDF-AMOX', 'IDF-PPI'].flatMap((idfNumber, g) =>
  IDF_GENERIC.map(([en, ar], i) => ({
    itemNumber: String(300100 + g * 100 + i * 10),
    descriptionEn: `${en} general ${g + 1}${i}`,
    descriptionAr: `${ar} عام ${g + 1}${i}`,
    idfNumber,
    priority: i + 1,
  })),
)

export function idfGeneralItemsStub(method, path, opts = {}) {
  const { state = {}, deny = [], reads = {} } = opts
  const [bare, qs = ''] = path.split('?')
  if (method !== 'GET' || bare !== 'IdfPriority/general/items') return null
  ;(reads.generalItems ??= []).push(qs)
  if (deny.includes('generalItems')) return bare403()
  const q = new URLSearchParams(qs)
  const search = (q.get('search') ?? '').toLowerCase()
  const idf = q.get('idf') ?? ''
  const all = (state.general ?? IDF_GENERAL_ITEMS).filter(
    (r) =>
      (!idf || r.idfNumber === idf) &&
      (!search || r.itemNumber.includes(search) || r.descriptionEn.toLowerCase().includes(search) || r.descriptionAr.includes(search)),
  )
  const pageSize = Number(q.get('pageSize')) || IDF_ENTRIES_PAGE_SIZE
  const page = Math.max(1, Number(q.get('page')) || 1)
  return envelope({ page, pageSize, total: all.length, rows: all.slice((page - 1) * pageSize, page * pageSize) })
}

// --- 648 --- set / clear one general item (door 3192).

// --- 649 --- general upload → preview → apply (door 3193).

// --- 650 --- general change log (door 3194).

// --- 651 --- general export + template (door 3195): `GET IdfPriority/general/export` → the whole general master as
// `.xlsx` (server name `IDF_GENERAL_EXPORT_NAME`), `GET IdfPriority/general/template` → the header. `opts.deny`
// `generalExport` / `generalTemplate` refuse on the JSON 400 envelope; `opts.noFileName` drops the
// `Content-Disposition` name so the client's fallback shows. `opts.reads.generalExport` / `generalTemplate` count.
export const IDF_GENERAL_EXPORT_NAME = 'idf-general-20261028.xlsx'
export const IDF_GENERAL_TEMPLATE_NAME = 'idf-general-template-20261028.xlsx'
export function idfGeneralFilesStub(method, path, opts = {}) {
  const { deny = [], reads = {}, noFileName = false } = opts
  if (method !== 'GET') return null
  const bare = path.split('?')[0]
  const which = bare === 'IdfPriority/general/export' ? 'generalExport' : bare === 'IdfPriority/general/template' ? 'generalTemplate' : null
  if (!which) return null
  reads[which] = (reads[which] ?? 0) + 1
  if (deny.includes(which)) {
    return which === 'generalExport'
      ? envelope(null, { status: 400, success: false, message: 'The general master could not be exported.', errorCode: 'IDF-00095' })
      : envelope(null, { status: 400, success: false, message: 'The general template could not be built.', errorCode: 'IDF-00096' })
  }
  const name = which === 'generalExport' ? IDF_GENERAL_EXPORT_NAME : IDF_GENERAL_TEMPLATE_NAME
  return {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ...(noFileName ? {} : { 'Content-Disposition': `attachment; filename="${name}"` }),
    },
    body: Buffer.from('PK stub xlsx'),
  }
}

// --- 652 --- IDF groups (door 3196, the brief's "Spec 3185" sketch): `GET IdfPriority/groups?search=&page=&pageSize=`
// (paged, search on number or description, page size `opts.groupsPageSize` or 50), `POST`, `PUT …/{idfNumber}`,
// `DELETE …/{idfNumber}` (refused while items point at it, `data.itemCount`), `GET …/export|template` → `.xlsx`.
// `state.groups` is made on first use. A row's `liveCount` is the server's real member count: the list shows
// `itemCount` (as last counted — the WPF may have added members since) until a refused remove re-counts it.
export const IDF_GROUPS = [
  { idfNumber: 'IDF-0101', description: 'Paracetamol 500 mg', dosageForm: 'Tablet', itemCount: 6 },
  { idfNumber: 'IDF-0102', description: 'Ibuprofen 400 mg', dosageForm: 'Tablet', itemCount: 4 },
  { idfNumber: 'IDF-0207', description: 'Amoxicillin 250 mg/5 ml', dosageForm: 'Suspension', itemCount: 3 },
  { idfNumber: 'IDF-0310', description: 'أوميبرازول 20 ملغ', dosageForm: 'Capsule', itemCount: 0 },
  { idfNumber: 'IDF-0399', description: 'Cetirizine 10 mg', dosageForm: '', itemCount: 0, liveCount: 2 },
]
export const IDF_GROUPS_EXPORT_NAME = 'idf-groups-20261028.xlsx'
const xlsx = (name) => ({
  status: 200,
  headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${name}"` },
  body: Buffer.from('PK stub xlsx'),
})

export function idfGroupsStub(method, path, body, opts = {}) {
  const { state = newIdfState(), deny = [], reads = {}, writes = [], groupsPageSize = 50 } = opts
  const [bare, qs = ''] = path.split('?')
  if (bare !== 'IdfPriority/groups' && !bare.startsWith('IdfPriority/groups/')) return null
  if (bare.startsWith('IdfPriority/groups/uploads')) return null // 653
  state.groups ??= structuredClone(IDF_GROUPS)
  const pub = ({ liveCount: _l, ...g }) => g
  if (method === 'GET' && bare === 'IdfPriority/groups') {
    ;(reads.groups ??= []).push(qs)
    if (deny.includes('groups')) return bare403()
    const q = new URLSearchParams(qs)
    const search = (q.get('search') ?? '').toLowerCase()
    const page = Number(q.get('page') ?? 1) || 1
    const all = state.groups.filter((g) => !search || g.idfNumber.toLowerCase().includes(search) || g.description.toLowerCase().includes(search))
    const rows = all.slice((page - 1) * groupsPageSize, page * groupsPageSize).map(pub)
    return envelope({ page, pageSize: groupsPageSize, total: all.length, rows })
  }
  if (method === 'GET' && (bare === 'IdfPriority/groups/export' || bare === 'IdfPriority/groups/template')) {
    const kind = bare.endsWith('/export') ? 'groupsExport' : 'groupsTemplate'
    reads[kind] = (reads[kind] ?? 0) + 1
    if (deny.includes(kind)) return envelope(null, { status: 400, success: false, message: 'The groups file could not be built.', errorCode: 'IDF-00030' })
    return xlsx(kind === 'groupsExport' ? IDF_GROUPS_EXPORT_NAME : 'idf-groups-template.xlsx')
  }
  const refuse = (message, errorCode, data = null) => envelope(data, { status: 400, success: false, message, errorCode })
  if (method === 'POST' && bare === 'IdfPriority/groups') {
    writes.push({ method, path: bare, body })
    const n = String(body?.idfNumber ?? '').trim()
    if (!n || n.length > 26) return refuse('The group number is required, at most 26 characters.', 'IDF-00031')
    if (state.groups.some((g) => g.idfNumber === n)) return refuse('That group number is taken.', 'IDF-00032')
    const row = { idfNumber: n, description: body.description, dosageForm: body.dosageForm ?? '', itemCount: 0 }
    state.groups.push(row)
    return envelope(row)
  }
  const m = /^IdfPriority\/groups\/([^/]+)$/.exec(bare)
  if (!m) return null
  const idfNumber = decodeURIComponent(m[1])
  const i = state.groups.findIndex((g) => g.idfNumber === idfNumber)
  if (method === 'PUT') {
    writes.push({ method, path: bare, body })
    if (i < 0) return refuse('Unknown IDF group.', 'IDF-00033')
    state.groups[i] = { ...state.groups[i], description: body.description, dosageForm: body.dosageForm ?? '' }
    return envelope(pub(state.groups[i]))
  }
  if (method === 'DELETE') {
    writes.push({ method, path: bare, body })
    if (i < 0) return refuse('Unknown IDF group.', 'IDF-00033')
    const g = state.groups[i]
    const count = g.liveCount ?? g.itemCount
    if (count > 0) {
      state.groups[i] = { ...g, itemCount: count }
      return refuse('Items still point at this IDF group; it cannot be removed.', 'IDF-00034', { itemCount: count })
    }
    state.groups.splice(i, 1)
    return envelope({ idfNumber })
  }
  return null
}

// --- 653 --- IDF groups import (door 3197, the brief's "Spec 3185" sketch): `POST IdfPriority/groups/uploads`
// (multipart `file`) → `{ uploadId, ok, rows }` listing EVERY row (`rule` empty on a passing one); `POST
// IdfPriority/groups/uploads/{uploadId}/apply` → `{ added, updated }`, refused unless the upload was `ok`. The report
// depends on the file's NAME: `dirty` → three failing rows among five; `notok` → `ok: false`, rows all passing; any
// other → clean, adding `IDF-0600` and updating `IDF-0101`. `opts.groupUploads` keeps the uploads; `opts.writes` the
// applies; `opts.refuseGroupsApply` refuses a clean apply (as if a concurrent change made it stale).
const pass = (line, idfNumber, action) => ({ line, idfNumber, action, rule: '', messageEn: '', messageAr: '' })
export const IDF_GROUPS_IMPORT_CLEAN = [pass(2, 'IDF-0600', 'add'), pass(3, 'IDF-0101', 'update')]
export const IDF_GROUPS_IMPORT_CLEAN_WRITES = {
  'IDF-0600': { description: 'Loratadine 10 mg', dosageForm: 'Tablet' },
  'IDF-0101': { description: 'Paracetamol 500 mg (film-coated)', dosageForm: 'Tablet' },
}
export const IDF_GROUPS_IMPORT_DIRTY = [
  pass(2, 'IDF-0600', 'add'),
  pass(3, 'IDF-0101', 'update'),
  { line: 4, idfNumber: '', action: 'add', rule: 'missingNumber', messageEn: 'Line 4 has no group number.', messageAr: 'السطر 4 بلا رقم مجموعة.' },
  { line: 5, idfNumber: 'IDF-0101', action: 'update', rule: 'duplicateNumber', messageEn: 'Group IDF-0101 is listed twice (lines 3 and 5).', messageAr: 'المجموعة IDF-0101 مكررة (السطران 3 و5).' },
  { line: 6, idfNumber: 'IDF-0700', action: 'add', rule: 'missingDescription', messageEn: 'Group IDF-0700 has no description.', messageAr: 'المجموعة IDF-0700 بلا وصف.' },
]

export function idfGroupsImportStub(method, path, body, opts = {}) {
  const { state = newIdfState(), groupUploads = {}, writes = [], refuseGroupsApply = false } = opts
  const [bare] = path.split('?')
  if (method !== 'POST' || !bare.startsWith('IdfPriority/groups/uploads')) return null
  state.groups ??= structuredClone(IDF_GROUPS)
  if (bare === 'IdfPriority/groups/uploads') {
    const name = /filename="([^"]*)"/.exec(String(body ?? ''))?.[1] ?? ''
    const uploadId = `G-${Object.keys(groupUploads).length + 1}`
    const dirty = /dirty/i.test(name)
    const report = { uploadId, ok: !dirty && !/notok/i.test(name), rows: dirty ? IDF_GROUPS_IMPORT_DIRTY : IDF_GROUPS_IMPORT_CLEAN }
    groupUploads[uploadId] = { name, report }
    return envelope(report)
  }
  const m = /^IdfPriority\/groups\/uploads\/([^/]+)\/apply$/.exec(bare)
  if (!m) return null
  const uploadId = decodeURIComponent(m[1])
  writes.push({ method, path: bare, body })
  const u = groupUploads[uploadId]
  if (!u || !u.report.ok) return envelope(null, { status: 400, success: false, message: 'This file has failing rows and cannot be applied.', errorCode: 'IDF-00035' })
  if (refuseGroupsApply) return envelope(null, { status: 409, success: false, message: 'The groups changed since this file was checked; upload it again.', errorCode: 'IDF-00036' })
  let added = 0
  let updated = 0
  for (const r of u.report.rows) {
    const w = IDF_GROUPS_IMPORT_CLEAN_WRITES[r.idfNumber] ?? { description: r.idfNumber, dosageForm: '' }
    const i = state.groups.findIndex((g) => g.idfNumber === r.idfNumber)
    if (i < 0) {
      state.groups.push({ idfNumber: r.idfNumber, ...w, itemCount: 0 })
      added++
    } else {
      state.groups[i] = { ...state.groups[i], ...w }
      updated++
    }
  }
  u.applied = true
  return envelope({ added, updated })
}

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
    idfVersionsStub(method, bare, body, opts) ??
    // 624 · exceptions
    idfExceptionsStub(method, path, body, opts) ??
    // 625 · lookup
    idfLookupStub(method, path, opts) ??
    // 626 · events
    idfEventsStub(method, path, opts) ??
    // 627 · swap report
    idfReportStub(method, path, opts) ??
    // 643 · a version's items
    idfEntriesStub(method, path, opts) ??
    // 644 · master export + template
    idfMasterFilesStub(method, path, opts) ??
    // 645 · draft
    idfDraftStub(method, bare, body, opts) ??
    // 646 · draft owner, rebase, add a group
    idfDraftOwnerStub(method, bare, body, opts) ??
    // 647 · general master items
    idfGeneralItemsStub(method, path, opts) ??
    // 648 · set / clear one general item
    // 649 · general upload
    // 650 · general change log
    // 651 · general export + template
    idfGeneralFilesStub(method, path, opts) ??
    // 652 · IDF groups
    idfGroupsStub(method, path, body, opts) ??
    // 653 · IDF groups import
    idfGroupsImportStub(method, path, body, opts) ??
    null
  )
}
