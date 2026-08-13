/**
 * Deposits' criteria → `GET CollectionWeb/Deposits` query (ticket 256).
 *
 * A **variation on 254's template**, not an abstraction over it: the toolbar owns
 * a *draft*, this module owns the *query*, and only Search/Reset promote one to
 * the other. ⚠️ **Copied, not extracted** — `collections-criteria.ts` and
 * `acr-criteria.ts` are the shape this follows and neither is imported from,
 * because the shared inquiry shell would be an abstraction designed before the
 * four screens exist to prove it (244 §1, 254's own ruling).
 *
 * Pure — no React, no i18n, no network, and **no `new Date()`**: every function
 * that needs today takes it as an argument.
 *
 * Two filters are this screen's own: **Bank** and the segmented **Status**
 * (All / POSTED / VOID). Both are the WPF's, and the radio group becomes a
 * segmented control exactly as the ACR screen's did.
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
 * `DepositInquiryOptions.Status` compares them (`""` | `"POSTED"` | `"VOID"`).
 * Typed as a union rather than as a bare `string` so a fourth state cannot be
 * introduced at a call site without this line, and the segmented control's own
 * buttons, moving together.
 */
export type DepositStatusFilter = 'ALL' | 'POSTED' | 'VOID'

/** The order the segmented control draws them in — All first, as the landing state. */
export const DEPOSIT_STATUSES = [
  'ALL',
  'POSTED',
  'VOID',
] as const satisfies readonly DepositStatusFilter[]

/**
 * The toolbar draft: From · To · Deposit No# · Collector · Bank · Status
 * (244 §5) — the widest filter strip of the four screens.
 *
 * All strings but the status, so each field maps 1:1 onto its input.
 * `depositNumber` is a string because it is what a text box holds — an empty box
 * is `''`, not `0`, and `0` is a real deposit number's neighbour rather than a way
 * to say "unset".
 */
export interface DepositsCriteria {
  fromDate: string
  toDate: string
  depositNumber: string
  /**
   * The shared *Served by* selection (BackOffice spec 1162 D8, built by 1167 and
   * mounted here by 1168) — **this screen's collector filter**, and the box it
   * replaces.
   *
   * 🔑 It reads the deposit's own `CollectorOperatorId` and joins nothing, exactly
   * as the ACRs list does. That is not an analogy between two screens but ONE fact:
   * a deposit's collector **is** its ACRs' collector by construction — the document
   * records the depositor, and its candidate ACRs are gathered by that very id — so
   * *collected by* and *deposited by* cannot diverge and one control means one thing
   * on both screens.
   *
   * ⚠️ **It replaced `collectorOperatorId` on the toolbar, and that parameter is NOT
   * dead.** The server still binds it for the deposit detail route and the mobile
   * collector path — this screen simply stopped being one of its callers. A typed id
   * here travels as `ServedByKind=COLLECTOR`, whose predicate is byte-identical to
   * the one that box always sent.
   */
  servedBy: ServedBySelection
  bankCode: string
  status: DepositStatusFilter
}

/**
 * The state the screen opens on: **today, on both ends, Status = All, nothing
 * else set** — the same today-defaulted landing 254 settled.
 *
 * ⚠️ The window applies to `DepositedAt`, **the bank-visit day**, not to
 * `CreatedAt`: what an accountant reconciles is the day the money reached the
 * bank, not the day the collector's phone wrote the record.
 */
export function landingCriteria(
  today: Date,
  options?: Partial<AssignmentOptions>,
): DepositsCriteria {
  const day = toIsoDate(today)
  return {
    fromDate: day,
    toDate: day,
    depositNumber: '',
    // 🚩 **Default-to-mine, but only for a caller this screen can scope** (spec D8;
    // BackOffice 1167's ruling, inherited whole). `defaultSelection` drops the
    // landing for an ACCOUNTANT caller — an accountant never collects and never
    // banks, so their own scope over a deposit is provably empty and they open on
    // the estate instead. `options` is passed in rather than read here so this stays
    // pure and the landing is testable rather than only observable.
    servedBy: defaultSelection('deposits', options),
    bankCode: '',
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
  // (1165's ruling, inherited here with 1167's). Against an unscoped landing the
  // chip would be lit on mount for every collector, over a grid showing exactly what
  // the screen chose to show them — and its ✕ (Reset) would put the same scope
  // straight back.
  const landing = buildDepositsParams(landingCriteria(today, options))
  const keys = Object.keys(landing)
  if (Object.keys(params).length !== keys.length) return false
  return keys.every((key) => params[key] === landing[key])
}

/**
 * Map the draft to the endpoint's query object.
 *
 * ⚠️ **PascalCase keys** — `DepositInquiryOptions` binds via `[AsParameters]`, so
 * the parameter names are the C# property names.
 *
 * 🚩 **`Status: 'ALL'` sends nothing at all.** Not `Status=`, not `Status=ALL`.
 * The server compares `Status` against `'POSTED'`/`'VOID'` and treats an unset one
 * as "every status"; the literal `"All"` would match no deposit ever written and
 * the grid would go silently empty while the control said the opposite. This is
 * the assertion the Proof pins, and it is the same rule the ACR screen's
 * `OPEN`/`CLOSED` control follows.
 *
 * 🚩 **`DepositNumber` is a filter the server does not take yet.**
 * `DepositInquiryOptions` carries `DepositId` — the ULID, an exact-row filter —
 * and nothing keyed on the number. The number is what an accountant holds in their
 * hand and the ULID is not, so the web asks for it by number. `CollectionWeb/Deposits`
 * does not exist yet (BackOffice 1090), so this **states the contract** rather than
 * changing a shipped door — and it is logged as a server dependency in
 * `.afk/HITL-256.md`. ⚠️ It is deliberately **not** sent as `DepositId`: the server
 * would compare a ULID column against `"5501"` and hand back nothing, silently.
 * And it is deliberately not filtered client-side, which would narrow only the rows
 * that already came back — the same silent truncation this wave was chartered to end.
 *
 * ⚠️ **The dates travel as a PAIR or not at all** — 254's guard, for 254's reason:
 * a half-open window is not a narrower query but an unbounded one.
 */
export function buildDepositsParams(
  criteria: Partial<DepositsCriteria> = {},
): Record<string, unknown> {
  const params: Record<string, unknown> = { Limit: GRID_LIMIT }
  const put = (key: string, value: string | undefined) => {
    const trimmed = (value ?? '').trim()
    if (trimmed !== '') params[key] = trimmed
  }
  if ((criteria.fromDate ?? '').trim() !== '' && (criteria.toDate ?? '').trim() !== '') {
    put('FromDate', criteria.fromDate)
    put('ToDate', criteria.toDate)
  }
  put('DepositNumber', criteria.depositNumber)
  // 🚩 **`CollectorOperatorId` is no longer sent from this toolbar** (BackOffice
  // 1168): *Served by* asks the same question of the same column, through the one
  // shared resolver all four screens share, and two toolbar boxes meaning the same
  // thing is how one control starts meaning two. The server parameter stays — the
  // detail route and the mobile path still pass it — this screen just stopped.
  Object.assign(params, buildServedByParams(criteria.servedBy))
  put('BankCode', criteria.bankCode)
  if (criteria.status === 'POSTED' || criteria.status === 'VOID') params.Status = criteria.status
  return params
}
