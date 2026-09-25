/**
 * ACRs' criteria → `GET CollectionWeb/Acrs` query (ticket 255).
 *
 * A **variation on 254's template**, not an abstraction over it: the toolbar owns
 * a *draft*, this module owns the *query*, and only Search/Reset promote one to
 * the other. ⚠️ **Copied, not extracted** — `collections-criteria.ts` is the shape
 * this follows and it is deliberately not imported from, because the shared
 * inquiry shell would be an abstraction designed before the four screens exist to
 * prove it (244 §1, 254's own ruling).
 *
 * Pure — no React, no i18n, no network, and **no `new Date()`**: every function
 * that needs today takes it as an argument.
 *
 * Two things differ from Cash Collections, and both are the screen's own:
 *
 * 1. **Status** — the WPF's `""` / `OPEN` / `CLOSED` radio group becomes a
 *    segmented control, and `All` sends **nothing**, never the literal `"All"`.
 * 2. **ACR No#** — a filter the WPF does not have, and which the server took at
 *    BackOffice 1993. See `buildAcrsParams`.
 *
 * 🚩 **Two ranges, named by what they mean on THIS screen** (ticket 316, BackOffice
 * 1993 — 1992's four-filter contract with spec 1976's per-screen meanings):
 *
 * - **Business date** — the ACR date (`AcrDate`), the collector-chosen business
 *   date. The window this screen has always landed on.
 * - **Collection date** — the collected-at of **ANY** linked collection: an ACR
 *   matches when at least one of its collections was taken in the range, and then
 *   rows once with its whole aggregate (the range picks ACRs, it never trims their
 *   totals). An idle ACR never matches a collection range.
 */
import { toIsoDate } from '@/core/util/date-format'
import { GRID_LIMIT } from './cap'
import {
  buildServedByParams,
  defaultSelection,
  type AssignmentOptions,
  type ServedBySelection,
} from './served-by'

/**
 * The three states the segmented Status control can be in.
 *
 * `'ALL'` is the **client's** word for "no status filter" and never reaches the
 * wire; the other two are the server's own strings, spelled exactly as
 * `AcrInquiryOptions.Status` compares them. Typed as a union rather than as a
 * bare `string` so a fourth state cannot be introduced at a call site without
 * this line, and the segmented control's own buttons, moving together.
 */
export type AcrStatusFilter = 'ALL' | 'OPEN' | 'CLOSED'

/** The order the segmented control draws them in — All first, as the landing state. */
export const ACR_STATUSES = ['ALL', 'OPEN', 'CLOSED'] as const satisfies readonly AcrStatusFilter[]

/**
 * The toolbar draft: Business date from/to · Collection date from/to · ACR No# ·
 * Collector · Status (244 §5, ticket 316).
 *
 * All strings but the status, so each field maps 1:1 onto its input. `acrNumber`
 * is a string because it is what a text box holds — an empty box is `''`, not
 * `0`, and `0` is a real ACR number's neighbour rather than a way to say "unset".
 */
export interface AcrsCriteria {
  businessDateFrom: string
  businessDateTo: string
  collectionDateFrom: string
  collectionDateTo: string
  acrNumber: string
  /**
   * The shared *Served by* selection (BackOffice spec 1162 D8, built by 1167) —
   * **this screen's collector filter**, and the box it replaces.
   *
   * 🔑 On the ACRs list *Served by* joins nothing at all: it reads the ACR's own
   * `CollectorOperatorId`, because that is what the document in front of the user
   * records (*who collected*, not *who is assigned*). An ACR spans a whole round
   * and carries no store, so there is no branch to look an assignment up by.
   *
   * ⚠️ **It replaced `collectorOperatorId` on the toolbar, and that parameter is
   * NOT dead.** The server still binds it for the ACR drill-downs, the mobile
   * collector path and the shipped end-to-end tests — this screen simply stopped
   * being one of its callers. A typed id here travels as `ServedByKind=COLLECTOR`,
   * whose predicate is byte-identical to the one that box always sent.
   */
  servedBy: ServedBySelection
  status: AcrStatusFilter
}

/**
 * The state the screen opens on: **a business date of today, on both ends,
 * Status = All, nothing else set** — the same today-defaulted landing 254 settled,
 * with the collection range open.
 *
 * ⚠️ The window applies to `AcrDate`, **the collector-chosen business date**, not
 * to `CreatedAt` — a grilled decision the WPF view carries a comment about. A
 * catch-up ACR raised today for last Thursday's collections answers to last
 * Thursday here. Ticket 316 renamed it on the wire (`BusinessDate*`); it did not
 * move it.
 */
export function landingCriteria(
  today: Date,
  options?: Partial<AssignmentOptions>,
): AcrsCriteria {
  const day = toIsoDate(today)
  return {
    businessDateFrom: day,
    businessDateTo: day,
    collectionDateFrom: '',
    collectionDateTo: '',
    acrNumber: '',
    // 🚩 **Default-to-mine, but only for a caller this screen can scope** (spec D8;
    // BackOffice 1167). `defaultSelection` drops the landing for an ACCOUNTANT
    // caller, because an accountant never collects and their own scope over a
    // collected-by document is provably empty — they open on the estate instead.
    // `options` is passed in rather than read here so this stays pure and the
    // landing is testable rather than only observable.
    servedBy: defaultSelection('acrs', options),
    status: 'ALL',
  }
}

/**
 * Is the query that has actually been **issued** still the landing one?
 *
 * Takes the applied params, **not the draft**, for 254's reason: the chip's
 * sentence is about what the grid is showing, and the grid shows the result of
 * the last Search.
 */
export function isLandingQuery(
  params: Record<string, unknown>,
  today: Date,
  options?: Partial<AssignmentOptions>,
): boolean {
  // 🚩 Measured against the landing the screen ACTUALLY opened on, scope and all
  // (1165's ruling, inherited here). Against an unscoped landing the chip would be
  // lit on mount for every collector, over a grid showing exactly what the screen
  // chose to show them — and its ✕ (Reset) would put the same scope straight back.
  const landing = buildAcrsParams(landingCriteria(today, options))
  const keys = Object.keys(landing)
  if (Object.keys(params).length !== keys.length) return false
  return keys.every((key) => params[key] === landing[key])
}

/**
 * Map the draft to the endpoint's query object.
 *
 * ⚠️ **PascalCase keys** — `AcrInquiryOptions` binds via `[AsParameters]`, so the
 * parameter names are the C# property names.
 *
 * 🚩 **`Status: 'ALL'` sends nothing at all.** Not `Status=`, not `Status=ALL`.
 * The server compares `Status` against `'OPEN'`/`'CLOSED'` and treats an unset
 * one as "every status"; the literal `"All"` would match no ACR ever written and
 * the grid would go silently empty while the control said the opposite. This is
 * the assertion the Proof pins.
 *
 * 🚩 **`AcrNumber` is the number on the paper, exact** (BackOffice 1993 gave it a
 * server parameter; 255 sent it ahead of the door, logged in `.afk/HITL-255.md`).
 * The WPF has no ACR No# box; the web has one because the number is what a
 * supervisor holds in their hand and the ULID is not. ⚠️ It is deliberately **not**
 * sent as `AcrId`: the server would compare a ULID column against `"41"` and hand
 * back nothing, silently. It is an `int` on the server, so a non-digit box is a
 * binding `400` — the toolbar's `pattern` stops that before Search.
 *
 * 🚩 **Each date end travels on its own** (ticket 316, 315's ruling): the contract
 * makes every end optional and an open-ended range a real question. The day goes as
 * typed — inclusive-by-day is the server's rule, so the client adds no time part.
 *
 * ⚠️ **`FromDate`/`ToDate` are never sent.** The door still honours the legacy pair
 * on the ACR date and intersects it with `BusinessDate*`; the contract tells the web
 * to switch, and sending both would be one window spelt twice.
 */
export function buildAcrsParams(criteria: Partial<AcrsCriteria> = {}): Record<string, unknown> {
  const params: Record<string, unknown> = { Limit: GRID_LIMIT }
  const put = (key: string, value: string | undefined) => {
    const trimmed = (value ?? '').trim()
    if (trimmed !== '') params[key] = trimmed
  }
  put('BusinessDateFrom', criteria.businessDateFrom)
  put('BusinessDateTo', criteria.businessDateTo)
  put('CollectionDateFrom', criteria.collectionDateFrom)
  put('CollectionDateTo', criteria.collectionDateTo)
  put('AcrNumber', criteria.acrNumber)
  // 🚩 **`CollectorOperatorId` is no longer sent from this toolbar** (BackOffice
  // 1167): *Served by* asks the same question of the same column, through the one
  // shared resolver all four screens share, and two toolbar boxes meaning the same
  // thing is how one control starts meaning two. The server parameter stays — its
  // drill-downs and the mobile path still pass it — this screen just stopped.
  Object.assign(params, buildServedByParams(criteria.servedBy))
  if (criteria.status === 'OPEN' || criteria.status === 'CLOSED') params.Status = criteria.status
  return params
}
