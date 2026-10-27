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
    // 623 · versions
    // 624 · exceptions
    // 625 · lookup
    idfLookupStub(method, path, opts) ??
    // 626 · events
    // 627 · swap report
    null
  )
}
