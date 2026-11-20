/**
 * Insurance pattern cases (oms 922; BackOffice spec 4050, ticket 4053): the case list and one case, as the insurance team
 * works them. A **multi-pharmacy case** is one patient's open run of dispenses across our pharmacies that matched an
 * abuse signal (spec 4050's glossary).
 *
 * Reconciled with BackOffice 4053/4055/4056 as built (routes `InsuranceRules/Patterns/...`). These are the CLIENT's
 * models: the wire's own shapes (`{ page, pageSize, total, rows }`, `{ case, dispenses, legs, ... }`, `seq`,
 * `eventTime`, `markedBy`, ...) are read into them field by field in `features/insurance/patterns/wire.ts`. A case is
 * keyed by its **case number** (the server's INT, held here as its decimal string); the server never sends its ULID.
 *
 * 🔒 **No patient field exists here, and none may be added** (ticket 922 Boundaries; spec 4050 level 3): no patient key,
 * no member id, no policy. The case number joins everything up. The patient appears only behind an investigator's
 * logged reveal (923), whose answer is held in that dialog's own state and is NOT a model: it never lives in this file,
 * the query cache, the URL or storage. `src/features/insurance/patterns/no-identity.test.ts` holds this file to it.
 *
 * Dates are the server's LOCAL wall clock as ISO strings without a zone (`no-utc-time`); '' = never.
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

/** One case as the list shows it (`GET InsuranceRules/Patterns/Cases`, a row). */
export interface PatternCaseRow {
  /** The case's number: the server's INT as a decimal string. The only key a case has on this side. */
  caseNumber: string
  stores: PatternCaseStore[]
  dispenseCount: number
  openedAt: string
  lastDispenseAt: string
  /** '' while the case is open (the server sends null). */
  closedAt: string
  /** First dispense to last (the server counts whole hours: `spanHours` × 60). */
  spanMinutes: number
  /** Null: no leg has coordinates at both ends (the server's 0). */
  longestLegKm: number | null
  /** Null: one dispense only (the server's 0). */
  shortestGapMinutes: number | null
  signals: PatternSignal[]
  score: number
  severity: PatternSeverity
  status: PatternStatus
}

/** A page of the list: the server orders it by score, then by the last dispense, newest first. */
export interface PatternCasesPage {
  items: PatternCaseRow[]
  totalMatches: number
}

/** The list's filters and page, as sent. Empty values are dropped by `@/core/api`. */
export interface PatternCasesQuery {
  /** A store code; a case touching it is listed. */
  store?: string
  /** `yyyy-MM-dd`, local, inclusive. */
  from?: string
  /** `yyyy-MM-dd`, local, inclusive. */
  to?: string
  signal?: PatternSignal
  status?: PatternStatus
  severity?: PatternSeverity
  /** 1-based. */
  page: number
  pageSize: number
}

/** One dispense of a case, in time order. */
export interface PatternDispense {
  /** The dispense's place in the case (the server's `seq`): what a leg names its two ends by. */
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
  /** The server's word that both ends are counter dispenses. A leg without it is never drawn. */
  counter: boolean
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

/** `POST …/Cases/{caseNumber}/Marks`. No actor: the server reads it off the session. */
export interface PatternMarkBody {
  status: PatternMarkStatus
  note: string
}

/**
 * The same patient's earlier case that was cleared, shown at the top of the next one (spec 4050 story 20). The server
 * does not send it: the reader derives it from the previous cases (the newest cleared one, and its newest clearing mark).
 */
export interface PatternClearance {
  caseNumber: string
  note: string
  by: string
  at: string
}

/** One of the same patient's earlier cases, linked. */
export interface PatternPreviousCase {
  caseNumber: string
  status: PatternStatus
  openedAt: string
  /** '' while that case is open. */
  closedAt: string
}

/** A store a case touches, with its coordinates for the route (null: not on the map). */
export interface PatternCaseStorePlace extends PatternCaseStore {
  lat: number | null
  lon: number | null
}

/** One case (`GET InsuranceRules/Patterns/Cases/{caseNumber}`): the timeline, the legs, the signals, the marks. */
export interface PatternCaseDetail extends PatternCaseRow {
  stores: PatternCaseStorePlace[]
  dispenses: PatternDispense[]
  legs: PatternLeg[]
  signalWords: PatternSignalWords[]
  marks: PatternMark[]
  previousClearance: PatternClearance | null
  previousCases: PatternPreviousCase[]
  /**
   * BackOffice 3986's `maps` part, so the case screen draws Google's map. BackOffice 4053 does NOT send one on the case
   * (no key source is decided yet), so today it is always absent and the legs show as a table. Absent, or an empty key:
   * the map cannot draw.
   */
  maps?: MapsAccess
}
