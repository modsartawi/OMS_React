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

// --- 623 --- versions and restore (door 3161).

// --- 624 --- exceptions (door 3166).

// --- 625 --- lookup (door 3168).

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
    // 621 · master form
    // 622 · upload
    // 623 · versions
    // 624 · exceptions
    // 625 · lookup
    // 626 · events
    idfEventsStub(method, path, opts) ??
    // 627 · swap report
    null
  )
}
