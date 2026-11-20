/**
 * The pattern doors' answers, read FIELD BY FIELD (oms 922; reconciled with BackOffice 4053 as built). Nothing is spread
 * from the wire: an object is rebuilt from the agreed fields only, so a field nobody agreed to — above all a patient's
 * identity, should a server ever send one — never reaches the query cache, the screen or a log (ticket 922 Boundaries;
 * spec 4050: identity only behind the investigator's logged reveal). Missing lists read as empty, a missing number as 0
 * or null as its field allows.
 *
 * The wire's shapes are BackOffice's (camelCased C#); the models are the client's (`@/core/models/insurance-patterns`).
 * This module is where the two meet:
 * - the list is `{ page, pageSize, total, rows }` → `{ items, totalMatches }`;
 * - a row's `caseNumber` is an INT → its decimal string; `spanHours` → minutes; `longestLegKm` / `shortestGapMinutes`
 *   of 0 mean "none" → null; `closedAt` null → ''; `signals` is `[{ signal, en, ar }]` → the kinds;
 * - the detail is `{ case, dispenses, legs, marks, previousCases, stores, canReveal }`: the row fields come from `case`,
 *   the signal words from `case.signals`, a dispense's `seq` / `eventTime` / `isCounter` → `eventId` / `at` / `counter`,
 *   a leg's `fromSeq` / `toSeq` → `fromEventId` / `toEventId`, a store's `latitude` / `longitude` → `lat` / `lon`, a
 *   mark's `markedBy` / `markedAt` → `by` / `at`; the previous clearance is DERIVED (the server sends none).
 *
 * Enumerations are kept as sent, lower-cased (a server spelling `Open` still reads `open`); a value the screen does not
 * know falls to the screen's own words for "unknown".
 */
import type { MapsAccess } from '@/core/map/map-panel'
import type {
  PatternCaseDetail,
  PatternCaseRow,
  PatternCasesPage,
  PatternCaseStorePlace,
  PatternClearance,
  PatternDispense,
  PatternLeg,
  PatternMark,
  PatternPreviousCase,
  PatternSeverity,
  PatternSignal,
  PatternSignalWords,
  PatternStatus,
} from '@/core/models/insurance-patterns'

type Raw = Record<string, unknown>

const isRaw = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
/** The server's 0 for "none" (no leg with coordinates, one dispense only) reads as null. */
const positiveOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
const list = <T>(v: unknown, read: (raw: Raw) => T): T[] => (Array.isArray(v) ? v.filter(isRaw).map(read) : [])
const word = <T extends string>(v: unknown): T => str(v).toLowerCase() as T

const readStore = (r: Raw) => ({ storeCode: str(r.storeCode), storeName: str(r.storeName) })

const readStorePlace = (r: Raw): PatternCaseStorePlace => ({ ...readStore(r), lat: numOrNull(r.latitude), lon: numOrNull(r.longitude) })

const readSignalWords = (r: Raw): PatternSignalWords => ({ kind: word<PatternSignal>(r.signal), en: str(r.en), ar: str(r.ar) })

/** One list row (and the detail's `case`). */
export function readCaseRow(r: Raw): PatternCaseRow {
  return {
    caseNumber: str(r.caseNumber),
    stores: list(r.stores, readStore),
    dispenseCount: num(r.dispenseCount),
    openedAt: str(r.openedAt),
    lastDispenseAt: str(r.lastDispenseAt),
    closedAt: str(r.closedAt),
    spanMinutes: num(r.spanHours) * 60,
    longestLegKm: positiveOrNull(r.longestLegKm),
    shortestGapMinutes: positiveOrNull(r.shortestGapMinutes),
    signals: list(r.signals, (s) => str(s.signal).toLowerCase())
      .filter((s) => s !== '')
      .map((s) => s as PatternSignal),
    score: num(r.score),
    severity: word<PatternSeverity>(r.severity),
    status: word<PatternStatus>(r.status),
  }
}

/** A page of the list: `{ page, pageSize, total, rows }`. */
export function readCasesPage(raw: unknown): PatternCasesPage {
  if (!isRaw(raw)) return { items: [], totalMatches: 0 }
  return { items: list(raw.rows, readCaseRow), totalMatches: num(raw.total) }
}

const readDispense = (r: Raw): PatternDispense => ({
  eventId: num(r.seq),
  storeCode: str(r.storeCode),
  storeName: str(r.storeName),
  at: str(r.eventTime),
  itemNumber: str(r.itemNumber),
  itemDescription: str(r.itemDescription),
  sfdaCode: str(r.sfdaCode),
  quantity: num(r.quantity),
  daysSupply: numOrNull(r.daysSupply),
  payer: str(r.payer),
  channel: str(r.channel),
  counter: r.isCounter === true,
  pharmacist: str(r.pharmacist),
})

const readLeg = (r: Raw): PatternLeg => ({
  fromEventId: num(r.fromSeq),
  toEventId: num(r.toSeq),
  km: numOrNull(r.km),
  minutes: num(r.minutes),
  kmPerHour: numOrNull(r.kmPerHour),
  counter: r.counter === true,
  travel: r.travel === true,
})

/** A mark, as listed on a case and on each previous case. */
const readMark = (r: Raw): PatternMark => ({ status: word<PatternStatus>(r.status), note: str(r.note), by: str(r.markedBy), at: str(r.markedAt) })

const readPreviousCase = (r: Raw): PatternPreviousCase => ({
  caseNumber: str(r.caseNumber),
  status: word<PatternStatus>(r.status),
  openedAt: str(r.openedAt),
  closedAt: str(r.closedAt),
})

/** Local ISO times without a zone sort as text: newest first. */
const newestFirst = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0)

/**
 * The same patient's last clearance, derived (the server sends none): the newest previous case whose status is
 * `cleared` and that carries a `cleared` mark, with its newest such mark. Null when no previous case was cleared.
 */
function deriveClearance(previous: Raw[]): PatternClearance | null {
  const cleared = previous
    .filter((r) => word(r.status) === 'cleared')
    .sort((a, b) => newestFirst(str(a.lastDispenseAt) || str(a.openedAt), str(b.lastDispenseAt) || str(b.openedAt)))
  for (const r of cleared) {
    const mark = list(r.marks, readMark)
      .filter((m) => m.status === 'cleared')
      .sort((a, b) => newestFirst(a.at, b.at))[0]
    if (mark) return { caseNumber: str(r.caseNumber), note: mark.note, by: mark.by, at: mark.at }
  }
  return null
}

const readMaps = (v: unknown): MapsAccess | undefined => {
  if (!isRaw(v)) return undefined
  const mapId = str(v.mapId)
  return { key: str(v.key), ...(mapId ? { mapId } : {}) }
}

/**
 * One case: `GET …/Cases/{caseNumber}`, and the answer of `POST …/Marks` (the full case again). Throws nothing: an
 * answer that is not an object reads as a case with no facts. BackOffice 4053 sends no `maps` part; one sent later is
 * read here.
 */
export function readCaseDetail(raw: unknown): PatternCaseDetail {
  const r = isRaw(raw) ? raw : {}
  const c = isRaw(r.case) ? r.case : {}
  const previous = Array.isArray(r.previousCases) ? r.previousCases.filter(isRaw) : []
  const maps = readMaps(r.maps)
  return {
    ...readCaseRow(c),
    // The detail's own store list carries the coordinates; the row's is the fallback.
    stores: list(Array.isArray(r.stores) ? r.stores : c.stores, readStorePlace),
    dispenses: list(r.dispenses, readDispense),
    legs: list(r.legs, readLeg),
    signalWords: list(c.signals, readSignalWords),
    marks: list(r.marks, readMark),
    previousClearance: deriveClearance(previous),
    previousCases: previous.map(readPreviousCase),
    ...(maps ? { maps } : {}),
  }
}
