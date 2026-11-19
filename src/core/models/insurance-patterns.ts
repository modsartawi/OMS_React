/**
 * Insurance pattern cases on the wire (oms 922; BackOffice spec 4050, ticket 4053): the case list and one case, as the
 * insurance team works them. A **multi-pharmacy case** is one patient's open run of dispenses across our pharmacies that
 * matched an abuse signal (spec 4050's glossary).
 *
 * 🚩 GUESSED: BackOffice 4053 is not built. These are the shapes the oms-react implementers agreed for spec 4050,
 * camelCased as SIS.Api serialises; reconcile every field when 4053 lands.
 *
 * 🔒 **No patient field exists here, and none may be added** (ticket 922 Boundaries; spec 4050 level 3): no patient key,
 * no member id, no policy. The case number joins everything up. The patient appears only behind an investigator's
 * logged reveal (923), whose answer is held in that dialog's own state and is NOT a model: it never lives in this file,
 * the query cache, the URL or storage. `src/features/insurance/patterns/no-identity.test.ts` holds this file to it.
 *
 * Dates are the server's LOCAL wall clock as ISO strings without a zone (`no-utc-time`); `0001-01-01T00:00:00` = never.
 */
import type { MapsAccess } from '@/core/map/map-panel'

/** The three signals a case scores on (spec 4050): too-fast travel 3, supply overlap 2, pharmacy hopping 1. */
export type PatternSignal = 'travel' | 'overlap' | 'hopping'

/** Where the team stands on a case. `open` is the job's; the other four are a reviewer's mark. */
export type PatternStatus = 'open' | 'watching' | 'cleared' | 'confirmed' | 'closed'

/** `action` for a score of 3 or more, `info` below: the monitor rules' words. */
export type PatternSeverity = 'action' | 'info'

/** A store a case touches. */
export interface PatternCaseStore {
  storeCode: string
  storeName: string
}

/** One case as the list shows it (`GET Insurance/Patterns/Cases`). */
export interface PatternCaseRow {
  caseId: string
  caseNumber: string
  stores: PatternCaseStore[]
  dispenseCount: number
  openedAt: string
  lastDispenseAt: string
  /** `0001-01-01T00:00:00` while the case is open. */
  closedAt: string
  /** First dispense to last. */
  spanMinutes: number
  /** Null: no leg has coordinates at both ends. */
  longestLegKm: number | null
  /** Null: one dispense only. */
  shortestGapMinutes: number | null
  signals: PatternSignal[]
  score: number
  severity: PatternSeverity
  status: PatternStatus
  /** SAR, the dispenses' submitted value. */
  totalValue: number
}

/** A page of the list: the server orders it by score, then by the last dispense, newest first. */
export interface PatternCasesPage {
  items: PatternCaseRow[]
  totalMatches: number
}

/** The list's filters and page, as sent. Empty values are dropped by `@/core/api`. */
export interface PatternCasesQuery {
  storeCode?: string
  /** `yyyy-MM-dd`, local, inclusive. */
  from?: string
  /** `yyyy-MM-dd`, local, inclusive. */
  to?: string
  signal?: PatternSignal
  status?: PatternStatus
  severity?: PatternSeverity
  skip: number
  take: number
}

/** One dispense of a case, in time order. */
export interface PatternDispense {
  eventId: number
  storeCode: string
  storeName: string
  at: string
  itemNumber: string
  itemDescription: string
  sfdaCode: string
  quantity: number
  /** Null: the days' supply is not known. */
  daysSupply: number | null
  payer: string
  channel: string
  /** False for a delivery or online dispense: it says where the medicine left from, so it is a point, never a leg. */
  counter: boolean
  /** The pharmacist's user name: needed to spot a staff pattern, and not the patient's identity (spec 4050). */
  pharmacist: string
}

/** A leg between two consecutive counter dispenses (the server's). */
export interface PatternLeg {
  fromEventId: number
  toEventId: number
  /** Straight-line km; null when a store has no coordinates. */
  km: number | null
  minutes: number
  kmPerHour: number | null
  /** The leg fired the impossible-travel signal. */
  travel: boolean
}

/** A signal that fired, in the server's words in both languages ("312 km in 1 h 40 min"). */
export interface PatternSignalWords {
  kind: PatternSignal
  en: string
  ar: string
}

/** A reviewer's mark: the status set, the note, who and when. */
export interface PatternMark {
  status: PatternStatus
  note: string
  by: string
  at: string
}

/** The statuses a reviewer can set. */
export type PatternMarkStatus = Exclude<PatternStatus, 'open'>

/** `POST …/Cases/{caseId}/Marks`. No actor: the server reads it off the session. */
export interface PatternMarkBody {
  status: PatternMarkStatus
  note: string
}

/** The same patient's earlier case that was cleared, shown at the top of the next one (spec 4050 story 20). */
export interface PatternClearance {
  caseId: string
  caseNumber: string
  note: string
  by: string
  at: string
}

/** One of the same patient's earlier cases, linked. */
export interface PatternPreviousCase {
  caseId: string
  caseNumber: string
  status: PatternStatus
  openedAt: string
  closedAt: string
}

/** A store a case touches, with its coordinates for the route (null: not on the map). */
export interface PatternCaseStorePlace extends PatternCaseStore {
  lat: number | null
  lon: number | null
}

/** One case (`GET Insurance/Patterns/Cases/{caseId}`): the timeline, the legs, the signals, the marks. */
export interface PatternCaseDetail extends PatternCaseRow {
  stores: PatternCaseStorePlace[]
  dispenses: PatternDispense[]
  legs: PatternLeg[]
  signalWords: PatternSignalWords[]
  marks: PatternMark[]
  previousClearance: PatternClearance | null
  previousCases: PatternPreviousCase[]
  /**
   * GUESSED (a BackOffice ask): BackOffice 3986's `maps` part on the case itself, so the case screen draws Google's map
   * without the analytics model. Absent, or an empty key: the map cannot draw and the legs show as a table.
   */
  maps?: MapsAccess
}
