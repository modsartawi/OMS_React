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
 * Pure — no React, no i18n, no network, and no `new Date()`. Since spec 2423 the
 * screen has no date of its own to read: it opens blank.
 *
 * Two things differ from Cash Collections, and both are the screen's own:
 *
 * 1. **Status** — the WPF's `""` / `OPEN` / `CLOSED` radio group becomes a
 *    segmented control, and `All` sends **nothing**, never the literal `"All"`.
 * 2. **ACR No#** — a filter the WPF does not have, and which the server took at
 *    BackOffice 1993. Text since spec 2423 (ADR 0066). See `buildAcrsParams`.
 *
 * 🚩 **Two ranges, named by what they mean on THIS screen** (ticket 316, BackOffice
 * 1993 — 1992's four-filter contract with spec 1976's per-screen meanings):
 *
 * - **Business date** — the ACR date (`AcrDate`), the collector-chosen business
 *   date.
 * - **Collection date** — the collected-at of **ANY** linked collection: an ACR
 *   matches when at least one of its collections was taken in the range, and then
 *   rows once with its whole aggregate (the range picks ACRs, it never trims their
 *   totals). An idle ACR never matches a collection range.
 *
 * Spec 2423 (ticket 425, BackOffice 2426) adds finance's filters, each applied by
 * the server before the cap: **Amount** From/To on the banked total, **Profit
 * center** (contains, any linked collection's branch), **Collector** text (contains,
 * on the collector's id or name; ANDs with Served by), and **Accountant** through
 * Served by. The screen opens blank and asks nothing until Search.
 */
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
 * Collector · Status (244 §5, ticket 316) · Amount from/to · Profit center ·
 * Collector text (ticket 425).
 *
 * All strings but the status, so each field maps 1:1 onto its input.
 */
export interface AcrsCriteria {
  businessDateFrom: string
  businessDateTo: string
  collectionDateFrom: string
  collectionDateTo: string
  /**
   * ACR No# — **text, sent as typed** (spec 2423, ADR 0066). A new ACR's number is
   * `<collector>-YYMM-NNNN` and an old one's a plain number; the server parses
   * every form (`6498-2610-0001`, `2610-0001`, `0001`). The client never parses,
   * validates or rebuilds it: a malformed value is the door's refusal, shown
   * through `apiErrorMessage`.
   */
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
  /**
   * Amount From/To on the **banked** total (Σ net collected — the grid's *Net
   * Collected*), inclusive, either one optional (BackOffice 2426). Strings as typed:
   * a From above its To goes to the door, which refuses it — the client does not
   * re-implement that rule.
   */
  amountFrom: string
  amountTo: string
  /**
   * A contains match on the profit center of ANY linked collection's branch,
   * case-insensitive, server-side. An ACR carries no store of its own.
   */
  profitCenter: string
  /**
   * Collector — a contains match on the collector's id **or** name (BackOffice
   * 2426). It ANDs with Served by; neither clears the other.
   */
  collectorText: string
}

/**
 * The DRAFT the screen opens on: **every box empty, Status = All**, scoped to the
 * caller's own collections where this screen can scope them.
 *
 * 🚩 Spec 2423 (ticket 425) removed the 2026-09-27 today..today collection-date
 * landing: finance chooses the period instead of first clearing one they never
 * asked for. Served by keeps its default (owner ruling: the date goes, the scope
 * stays).
 *
 * ⚠️ This is the draft only. The screen issues **no request** on landing: the
 * applied criteria start as `null` (`acrsParamsFor` answers `null` for them, and the
 * Page's query is enabled on that), and only Search promotes this draft to a query
 * (Cash Collections' 423 seam, copied).
 */
export function landingCriteria(options?: Partial<AssignmentOptions>): AcrsCriteria {
  return {
    businessDateFrom: '',
    businessDateTo: '',
    collectionDateFrom: '',
    collectionDateTo: '',
    acrNumber: '',
    // 🚩 **Default-to-mine, but only for a caller this screen can scope** (spec D8;
    // BackOffice 1167). `defaultSelection` drops the landing for an ACCOUNTANT
    // caller: their own scope over a collected-by document is provably empty, so
    // they open on the estate. Spec 2423 makes ACCOUNTANT *pickable* here and leaves
    // that landing as it was. `options` is passed in rather than read here so this
    // stays pure and the landing is testable rather than only observable.
    servedBy: defaultSelection('acrs', options),
    status: 'ALL',
    amountFrom: '',
    amountTo: '',
    profitCenter: '',
    collectorText: '',
  }
}

/**
 * The query the Page issues for what has been applied — **`null` is "issue
 * nothing"**. The applied criteria are `null` until the first Search, and the
 * Page's `useQuery` is enabled on a non-null answer, so the open-blank landing
 * (spec 2423) costs no request.
 */
export function acrsParamsFor(applied: AcrsCriteria | null): Record<string, unknown> | null {
  return applied === null ? null : buildAcrsParams(applied)
}

/**
 * Is the query that has actually been **issued** still the landing one — the empty
 * draft, Searched as it stands?
 *
 * Takes the applied params, **not the draft**, for 254's reason: the chip's
 * sentence is about what the grid is showing, and the grid shows the result of
 * the last Search. Before the first Search nothing was issued and the Page shows
 * no chip.
 */
export function isLandingQuery(
  params: Record<string, unknown>,
  options?: Partial<AssignmentOptions>,
): boolean {
  // 🚩 Measured against the landing the screen ACTUALLY opened on, scope and all
  // (1165's ruling, inherited here). Against an unscoped landing the chip would be
  // lit on every collector's first Search, over a grid showing exactly what the
  // screen chose to show them — and its ✕ (Reset) would put the same scope back.
  return sameQuery(params, buildAcrsParams(landingCriteria(options)))
}

/**
 * Are two built queries the same request? Key by key. The Page uses it to tell a
 * repeated Search from a new one. (Cash Collections' own, copied; this screen has
 * no array param, so a plain comparison is the whole rule.)
 */
export function sameQuery(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = Object.keys(b)
  if (Object.keys(a).length !== keys.length) return false
  return keys.every((key) => a[key] === b[key])
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
 * 🚩 **`AcrNo` is the number on the paper, as typed** (BackOffice 2428 added it
 * beside 1993's `AcrNumber`, which stays an `int?` on the server: text sent there
 * fails binding with a bare 400, so the box must never travel under that name). The WPF has no ACR
 * No# box; the web has one because the number is what a supervisor holds in their
 * hand and the ULID is not. It is trimmed and sent: the server parses
 * `6498-2610-0001`, `2610-0001` and a bare `0001` (ADR 0066) and refuses anything
 * else. ⚠️ It is deliberately **not** sent as `AcrId`: the server would compare a
 * ULID column against `"41"` and hand back nothing, silently.
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
  put('AcrNo', criteria.acrNumber)
  // 🚩 **`CollectorOperatorId` is no longer sent from this toolbar** (BackOffice
  // 1167): *Served by* asks the same question of the same column, through the one
  // shared resolver all four screens share, and two toolbar boxes meaning the same
  // thing is how one control starts meaning two. The server parameter stays — its
  // drill-downs and the mobile path still pass it — this screen just stopped.
  Object.assign(params, buildServedByParams(criteria.servedBy))
  if (criteria.status === 'OPEN' || criteria.status === 'CLOSED') params.Status = criteria.status
  // BackOffice 2426's criteria, PascalCase like the rest; an empty box sends nothing.
  put('AmountFrom', criteria.amountFrom)
  put('AmountTo', criteria.amountTo)
  put('ProfitCenter', criteria.profitCenter)
  put('CollectorText', criteria.collectorText)
  return params
}
