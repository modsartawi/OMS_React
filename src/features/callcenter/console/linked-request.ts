/**
 * The caller's open sales request, derived once — **whether to volunteer one**,
 * **what the picker shows before it copies anything**, **what the linked order
 * says about itself**, and **which lines did not make it** (ticket 194, contract
 * v1.11, BackOffice [880](C:\Work\DMSCO\BackOffice\.issues\880-cc-linked-sales-request.md)).
 *
 * A pharmacist standing with a customer raises a sales request (category `'Q'`)
 * when the store cannot sell the item right now, or when the customer has paid
 * through Tamara and will collect. The request is unpriced and open, and the
 * console is what turns it into a real order: WPF's `RequestLookup` fills
 * `RefDocumentNo` / `DocumentReason` at submit, where the 055b spine links the
 * request to the order and completes it. On the web those fields exist all the way
 * down to `AddSdDocumentHeader` and nothing filled them.
 *
 * Four rules live here rather than in a component, because they are rules:
 *
 * 1. 🚩 **The reason is never shown as a code.** 880 §3 resolves the SREQ reason
 *    group's curated text server-side precisely so the agent does not read `TMRA`
 *    to a caller — so an unworded reason renders as **nothing**, never as the code
 *    a `??` fallback would leak.
 * 2. 🚩 **The empty-basket rule is the SERVER'S.** `canLinkRequest` carries it
 *    (`LINES_EXIST`, 880 §4.1) and this module reads it; the only place the basket
 *    is inspected directly is the pre-v1.11 fallback, where there is no capability
 *    to read.
 * 3. 🚩 **A below-ATP line is a row with a handle, not a line on the order.**
 *    `HasBelowAtp` is the BackOffice fraud signal and `BelowAtpLedger`'s own
 *    comment is that a client-set boolean cannot prove the agent saw the number —
 *    so the copy reports it and the agent adds it deliberately.
 * 4. **No money anywhere.** The request is unpriced; the order's money lives in
 *    the basket and the receipt, and nothing here invents a figure.
 *
 * It decides nothing about the wire: `linkRequest` is one call with one
 * `requestId` and it answers with the whole `SessionState` (law 2).
 */
import type {
  CustomerRequest,
  CustomerRequestLine,
  LinkRequestResult,
  LinkedRequest,
  SessionCapabilities,
  SessionState,
  SkippedRequestLine,
} from '@/core/models/callcenter'

/**
 * The reason **in words**, or `null`.
 *
 * 🚩 There is deliberately no fallback to `reason`. The code is on the projection
 * because the server needs it on the document, not because it is readable; a
 * console that printed `TMRA` when the description was missing would be quietly
 * re-inventing the thing 880 §3 removed. An absence is honest and a surface can
 * draw it — a code cannot be read to a caller.
 */
export function reasonWords(
  source: { reasonDescription: string | null } | null | undefined,
): string | null {
  const text = (source?.reasonDescription ?? '').trim()
  return text === '' ? null : text
}

/** The deep-dig escape hatch, and the ONLY thing this console says about the OMS
 *  details screen. A URL is not an import: the picker must not become
 *  `DocumentDetailsPage` (no view-only mode, and `callcenter → oms` is a boundary
 *  violation), so the rest of the request lives one tab away. */
export const requestHref = (documentNo: string) => `/oms/document/${documentNo}`

/**
 * The rail's count block — *"2 open requests · view"* — or `null` for silence.
 *
 * **The count is drawn, the modal is not.** An unnoticed request is the failure
 * this whole slice exists to prevent, so the console volunteers it; nothing opens
 * by itself, because the agent is mid-greeting and a picker over the basket takes
 * the call away from them.
 *
 * Silent in five states, each for its own reason:
 *
 * - **no caller** — the read is scoped to whoever is attached (880 §3), so there
 *   is nothing to count and a count would be a claim about somebody the console
 *   has not got;
 * - **no open request** — a plain order gains no furniture;
 * - **the door says no** (`canLinkRequest === false`: `LINES_EXIST`,
 *   `ORDER_CLOSED`, `NO_CUSTOMER`);
 * - **already linked** — one order converts at most one request, and the linked
 *   card is what replaces the count;
 * - **not open** — a submitted order has nothing left to convert.
 */
export interface RequestOffer {
  count: number
}

export function requestOffer(
  state: SessionState,
  requests: CustomerRequest[] | null | undefined,
): RequestOffer | null {
  const count = requests?.length ?? 0
  if (count === 0) return null
  if (!state.header.customer) return null
  if (state.status !== 'open') return null
  if (state.header.linkedRequest) return null
  // 🚩 The server's predicate, and the console's only where there is none. On a
  // pre-v1.11 server the capability is absent and §9's rule applies — render what
  // can be seen rather than assume the worst — and what can be seen is the basket,
  // which is the one half of `LINES_EXIST` the projection has always carried.
  const linkable = state.capabilities.canLinkRequest ?? state.lines.length === 0
  if (!linkable) return null
  return { count }
}

/**
 * Whether the picker may link at all, and why not.
 *
 * 🚩 **This is a guard, not the way the refusal normally reaches an agent.** The
 * count block is the only way into the picker and it is already silent while the
 * gate is shut (`requestOffer`), so on the ordinary path a shut gate means the
 * picker was never offered. What this covers is the picker being OPEN when the gate
 * shuts under it — an add landing in a second tab, a caller removed elsewhere —
 * where the alternative is a live *Link* that answers with `LINES_EXIST`. The
 * console's standing rule is that a control the door would refuse is worse than no
 * control, so the button goes and the reason is said in its place.
 */
export interface LinkGate {
  canLink: boolean
  /** The server's own typed code (`LINES_EXIST`, `NO_CUSTOMER`, `ORDER_CLOSED`),
   *  or `null` for the console's general phrase — never silence. */
  reason: string | null
}

export function linkGate(capabilities: SessionCapabilities): LinkGate {
  // Absent means a server older than the field (§9), not a refusal: the door
  // refuses in words if it must. Same posture as `canApplyCoupon`.
  const canLink = capabilities.canLinkRequest !== false
  return {
    canLink,
    reason: canLink ? null : (capabilities.capabilityReasons?.canLinkRequest ?? null),
  }
}

/**
 * One row of the picker — **what the console is about to copy**, said before it
 * copies it.
 *
 * The lines are here because the console needs them anyway (the server copies
 * them, but the agent has to confirm *this is the Mounjaro you paid for on
 * Tuesday* without leaving the call), and `href` is the way to the rest.
 */
export interface RequestRow {
  documentNo: string
  /** The server's own timestamp, passed through as data — formatted where it is
   *  drawn, not here. */
  documentDate: string
  storeCode: string
  /** The reason **in words**, or `null`. Never the code. */
  reason: string | null
  /** The pharmacist's note, as they typed it. Copied onto nothing (880 §4.4). */
  note: string | null
  lines: CustomerRequestLine[]
  href: string
}

export function requestRows(requests: CustomerRequest[] | null | undefined): RequestRow[] {
  return (requests ?? []).map((request) => ({
    documentNo: request.documentNo,
    documentDate: request.documentDate,
    storeCode: request.storeCode,
    reason: reasonWords(request),
    note: request.note,
    lines: request.lines ?? [],
    href: requestHref(request.documentNo),
  }))
}

/**
 * The linked order's own card — request number, reason in words, the store it came
 * from, the pharmacist's note.
 *
 * 🚩 **No money on it at all.** The request is unpriced, so there is no figure to
 * draw; the basket is where the order's money lives. The note is the one field
 * that can *contain* a currency word, because it is the pharmacist's sentence and
 * the console may not sub-edit somebody else's text — which is why the rule is
 * asserted field by field rather than over the card's whole text.
 *
 * *Unlink* is [195](.issues/195-unlinking-and-the-request-that-went-away.md)'s and
 * is not offered here yet.
 */
export interface LinkedCard {
  documentNo: string
  reason: string | null
  storeCode: string
  note: string | null
  href: string
}

export function linkedCard(state: SessionState): LinkedCard | null {
  const request: LinkedRequest | null = state.header.linkedRequest ?? null
  if (!request) return null
  return {
    documentNo: request.documentNo,
    reason: reasonWords(request),
    storeCode: request.storeCode,
    note: request.note,
    href: requestHref(request.documentNo),
  }
}

/** Which of the two outcomes kept a line off the order. */
export type SkippedKind = 'belowAtp' | 'refused'

/**
 * One line the copy did not add.
 *
 * The two kinds are **different rows**, not one row with a different sentence:
 * below-ATP carries the two figures and an *add anyway* handle, refused carries
 * the server's own code and nothing to press.
 */
export interface SkippedRow {
  itemNumber: string
  quantity: number
  kind: SkippedKind
  /**
   * The server's own code, on **every** row — 880 §4.5 puts `reason` on all of
   * them, and dropping it on the rows this module classifies as below-ATP would
   * lose the one fact the server actually stated about the line. A row is *worded*
   * from its figures where it has them; it is never *stripped* of its code.
   */
  code: string
  requested: number | null
  available: number | null
  /** The agent may add this line deliberately, through the acceptance path that
   *  already exists (`BelowAtpConfirm`). False on every refused row: a refusal is
   *  not something an agent can accept their way past. */
  addAnyway: boolean
}

/**
 * The answer to `linkRequest`, read as news for the agent.
 *
 * 🚩 **`made` is read off the state's own stamp**, never inferred from the counts:
 * the link stands regardless of how many lines landed (880 §4.5 — a request whose
 * items are all out of stock is still the request this order converts), and an
 * empty `copied[]` must not read as a failed link.
 */
export interface LinkReport {
  made: boolean
  copied: number
  skipped: SkippedRow[]
}

export function skippedReport(result: LinkRequestResult): LinkReport {
  return {
    made: result.state?.header?.linkedRequest != null,
    copied: (result.copied ?? []).length,
    skipped: (result.skipped ?? []).map(skippedRow),
  }
}

/**
 * The report with one item's row taken out — what a landed add leaves behind.
 *
 * 🚩 **A skipped row is news about the copy, and the news stops being true the
 * moment a line for that item is on the order.** The row's whole purpose is to say
 * *this did not land, and here is how to land it*; a banner still claiming it did
 * not, over a basket that now holds it, is the console arguing with the receipt.
 *
 * It prunes on **any** landed add of that item, not only on an *add anyway*: an
 * agent who typed the item into the search box instead has answered the same row.
 *
 * `null` once nothing is left to report — so the banner disappears on its own
 * rather than emptying into a heading with no rows under it.
 */
export function reportWithout(report: LinkReport | null, itemNumber: string): LinkReport | null {
  if (!report) return null
  const skipped = report.skipped.filter((row) => row.itemNumber !== itemNumber)
  if (skipped.length === 0) return null
  return skipped.length === report.skipped.length ? report : { ...report, skipped }
}

function skippedRow(line: SkippedRequestLine): SkippedRow {
  const requested = num(line.requested)
  const available = num(line.available)
  /**
   * 🚩 **A row is below-ATP when it can be STATED as one**, which is exactly
   * `belowAtpAsk`'s rule for the acceptance sheet this handle leads to: two
   * readable figures **and** a real shortfall between them. Not the code's
   * spelling, because the console would then own a copy of a server code; and not
   * the figures' mere presence, because a refusal that happens to ship stock
   * numbers is still a refusal, and *add anyway* on it would be a control that
   * answers with a refusal.
   *
   * Where the figures are missing, unreadable, or do not describe a shortfall, the
   * row keeps the server's code and loses the handle — a sheet asking the agent to
   * accept "6 of —" is a number they cannot have been shown.
   */
  const belowAtp = requested !== null && available !== null && requested > available
  return {
    itemNumber: line.itemNumber,
    quantity: line.quantity,
    kind: belowAtp ? 'belowAtp' : 'refused',
    code: line.reason,
    requested,
    available,
    addAnyway: belowAtp,
  }
}

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null
