/**
 * The pattern doors' answers, read FIELD BY FIELD (oms 922). Nothing is spread from the wire: an object is rebuilt from
 * the agreed fields only, so a field nobody agreed to — above all a patient's identity, should a server ever send one —
 * never reaches the query cache, the screen or a log (ticket 922 Boundaries; spec 4050: identity only behind the
 * investigator's logged reveal). Missing lists read as empty, a missing number as 0 or null as its field allows.
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
const list = <T>(v: unknown, read: (raw: Raw) => T): T[] => (Array.isArray(v) ? v.filter(isRaw).map(read) : [])
const word = <T extends string>(v: unknown): T => str(v).toLowerCase() as T

const readStore = (r: Raw) => ({ storeCode: str(r.storeCode), storeName: str(r.storeName) })

const readStorePlace = (r: Raw): PatternCaseStorePlace => ({ ...readStore(r), lat: numOrNull(r.lat), lon: numOrNull(r.lon) })

/** One list row. */
export function readCaseRow(r: Raw): PatternCaseRow {
  return {
    caseId: str(r.caseId),
    caseNumber: str(r.caseNumber),
    stores: list(r.stores, readStore),
    dispenseCount: num(r.dispenseCount),
    openedAt: str(r.openedAt),
    lastDispenseAt: str(r.lastDispenseAt),
    closedAt: str(r.closedAt),
    spanMinutes: num(r.spanMinutes),
    longestLegKm: numOrNull(r.longestLegKm),
    shortestGapMinutes: numOrNull(r.shortestGapMinutes),
    signals: Array.isArray(r.signals) ? r.signals.map((s) => str(s).toLowerCase()).filter((s) => s !== '').map((s) => s as PatternSignal) : [],
    score: num(r.score),
    severity: word<PatternSeverity>(r.severity),
    status: word<PatternStatus>(r.status),
    totalValue: num(r.totalValue),
  }
}

/** A page of the list. */
export function readCasesPage(raw: unknown): PatternCasesPage {
  if (!isRaw(raw)) return { items: [], totalMatches: 0 }
  return { items: list(raw.items, readCaseRow), totalMatches: num(raw.totalMatches) }
}

const readDispense = (r: Raw): PatternDispense => ({
  eventId: num(r.eventId),
  storeCode: str(r.storeCode),
  storeName: str(r.storeName),
  at: str(r.at),
  itemNumber: str(r.itemNumber),
  itemDescription: str(r.itemDescription),
  sfdaCode: str(r.sfdaCode),
  quantity: num(r.quantity),
  daysSupply: numOrNull(r.daysSupply),
  payer: str(r.payer),
  channel: str(r.channel),
  counter: r.counter === true,
  pharmacist: str(r.pharmacist),
})

const readLeg = (r: Raw): PatternLeg => ({
  fromEventId: num(r.fromEventId),
  toEventId: num(r.toEventId),
  km: numOrNull(r.km),
  minutes: num(r.minutes),
  kmPerHour: numOrNull(r.kmPerHour),
  travel: r.travel === true,
})

const readSignalWords = (r: Raw): PatternSignalWords => ({ kind: word<PatternSignal>(r.kind), en: str(r.en), ar: str(r.ar) })

/** A mark, as listed on a case and as `POST …/Marks` answers it. */
export const readMark = (r: Raw): PatternMark => ({ status: word<PatternStatus>(r.status), note: str(r.note), by: str(r.by), at: str(r.at) })

const readClearance = (r: Raw): PatternClearance => ({
  caseId: str(r.caseId),
  caseNumber: str(r.caseNumber),
  note: str(r.note),
  by: str(r.by),
  at: str(r.at),
})

const readPreviousCase = (r: Raw): PatternPreviousCase => ({
  caseId: str(r.caseId),
  caseNumber: str(r.caseNumber),
  status: word<PatternStatus>(r.status),
  openedAt: str(r.openedAt),
  closedAt: str(r.closedAt),
})

const readMaps = (v: unknown): MapsAccess | undefined => {
  if (!isRaw(v)) return undefined
  const mapId = str(v.mapId)
  return { key: str(v.key), ...(mapId ? { mapId } : {}) }
}

/** One case. Throws nothing: an answer that is not an object reads as a case with no facts. */
export function readCaseDetail(raw: unknown): PatternCaseDetail {
  const r = isRaw(raw) ? raw : {}
  const maps = readMaps(r.maps)
  return {
    ...readCaseRow(r),
    stores: list(r.stores, readStorePlace),
    dispenses: list(r.dispenses, readDispense),
    legs: list(r.legs, readLeg),
    signalWords: list(r.signalWords, readSignalWords),
    marks: list(r.marks, readMark),
    previousClearance: isRaw(r.previousClearance) ? readClearance(r.previousClearance) : null,
    previousCases: list(r.previousCases, readPreviousCase),
    ...(maps ? { maps } : {}),
  }
}
