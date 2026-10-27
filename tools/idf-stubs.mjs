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

// --- 621 --- create / edit a master (door 3161).

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

// --- 625 --- lookup (door 3168).

// --- 626 --- events (door 3167).

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
    // 621 · master form
    // 622 · upload
    idfUploadStub(method, bare, body, opts) ??
    // 623 · versions
    // 624 · exceptions
    // 625 · lookup
    // 626 · events
    // 627 · swap report
    null
  )
}
