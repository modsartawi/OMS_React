import { roundMoney } from '@/core/money'
import type {
  SettlementAccount,
  SettlementConsumption,
  SettlementEntry,
} from '@/core/models/settlement'

/**
 * The branch account's read model — **the pure module ticket 269 is really about**
 * (spec 267 §Testing Decisions: components stay thin renderers, and the pure
 * modules are where regression is silent).
 *
 * Everything the account screen decides is decided here and nowhere else: the
 * signed headline, which journal rows belong to which entry and in what order, how
 * a zero remaining came about, and — the two rules the ticket calls *the actual
 * work* — that a consumption with **no document** is a named condition and that a
 * `REVERSE` row is a **restoration**.
 *
 * ⚠️ **No variance arithmetic lives here, and none may be added** (spec D3, and the
 * ticket's rule 3). A settlement receipt carries `SystemCashTotal = 0`, so
 * differencing it against confirmed cash across receipt kinds reads as a full
 * overage. This screen computes no variance at all; the rule is written at the one
 * place someone would otherwise add one.
 *
 * 🚩 It is **pure**: no React, no `t()`, no `@/core/api`. Every figure it returns is
 * a number and every condition is a tagged union — the words are the component's,
 * through the `settlement` namespace, which is what keeps the i18n rule and this
 * module's test suite from fighting over the same strings.
 */

/**
 * Settlement money is `DECIMAL(18,3)` on the server (D10 — the GCC has 3-decimal
 * currencies), so sums are rounded back to three places before they are compared or
 * displayed.
 *
 * 🚩 It lived here as a local `round3` until 270 wrote the third copy of it, and it
 * **graduated to `@/core/money`** on the trigger this repo uses for exactly that —
 * the escalation path in `feature-structure`, and the road `ScreenGate` and
 * `distinctCurrencies` each took. The argument for it (an IEEE-754 tail deciding
 * whether a branch reads as *square*) travelled with it and is on `MONEY_SCALE`.
 */
const round3 = roundMoney

/** Which way a branch's signed position points. `square` is a real answer and is
 *  worded as one — the fixture's 0512 exists to prove a layout renders it. */
export type PositionDirection = 'owes' | 'keeps' | 'square'

/**
 * The headline: what this branch owes, what it may keep back, and the net.
 *
 * 🔑 **The position is displayed, never consumed.** Nothing in the model nets a
 * shortage against a surplus — a till consumes one *entry* of one *kind* through
 * one *document*, and the two kinds move through different documents in opposite
 * directions. `signedPosition` is a reading aid for one human on one phone call,
 * and the screen must not imply a branch can settle 500 of shortage by keeping 500
 * of surplus. That is why the two magnitudes are returned **beside** it rather than
 * folded into it, and why the component renders all three.
 *
 * Only **open** entries count. A cancelled entry never was, a consumed one is
 * finished, and a written-off remainder is forgiven — including any of them would
 * make the headline a history rather than a position.
 */
export type AccountHeadline = {
  /** Open `SHORTAGE` remaining — what the branch must hand over. */
  shortageTotal: number
  /** Open `SURPLUS` remaining — what the branch may keep back. */
  surplusTotal: number
  /** `shortageTotal − surplusTotal`. Positive = the branch owes head office. */
  signedPosition: number
  direction: PositionDirection
  /** How many entries are still open, whatever their kind. */
  openCount: number
}

export function accountHeadline(
  entries: readonly SettlementEntry[] | null | undefined,
): AccountHeadline {
  let shortageTotal = 0
  let surplusTotal = 0
  let openCount = 0

  for (const e of entries ?? []) {
    if (e.status !== 'OPEN') continue
    openCount++
    if (e.entryKind === 'SHORTAGE') shortageTotal += e.remainingAmount
    else surplusTotal += e.remainingAmount
  }

  shortageTotal = round3(shortageTotal)
  surplusTotal = round3(surplusTotal)
  const signedPosition = round3(shortageTotal - surplusTotal)

  return {
    shortageTotal,
    surplusTotal,
    signedPosition,
    direction: signedPosition > 0 ? 'owes' : signedPosition < 0 ? 'keeps' : 'square',
    openCount,
  }
}

/**
 * What spent (or gave back) the money on one journal row — as a **tagged union, not
 * a sentence**, so the words stay in the namespace and the rule stays testable.
 *
 * 🔑 `orphan` is the ticket's rule 1 made structural. `documentNumber` is
 * back-stamped, so an empty one means either *seconds old* or *the close never
 * completed* — and the second is money the branch handed over against a document
 * that will never exist. Returning a distinct case forces the component to say so
 * in words; returning `''` would let it render an empty cell, which is exactly how
 * a real repair item goes past unread (270's *wrong money* lane is built on the
 * same condition).
 *
 * ⚠️ A **reversal is never an orphan**, even with no document number: a void's own
 * subject may be an unnumbered receipt, and the row still means something definite.
 * Reversal is checked first for that reason.
 */
export type JournalDocument =
  | { kind: 'orphan' }
  | { kind: 'reversal'; documentNumber: string }
  | { kind: 'receipt'; documentNumber: string }
  | { kind: 'shift-close'; documentNumber: string; businessDay: string }

export function describeDocument(c: SettlementConsumption): JournalDocument {
  if (c.consumptionKind === 'REVERSE')
    return { kind: 'reversal', documentNumber: c.documentNumber }
  if (!c.documentNumber) return { kind: 'orphan' }
  return c.documentType === 'SPECIAL_RECEIPT'
    ? { kind: 'receipt', documentNumber: c.documentNumber }
    : { kind: 'shift-close', documentNumber: c.documentNumber, businessDay: c.businessDay }
}

/**
 * One row of an entry's journal — the view that answers *"was my 500 used?"* on the
 * phone, which is the reason the account is per-branch and not a netted number.
 */
export type JournalRow = {
  consumption: SettlementConsumption
  /**
   * 🔑 The ticket's rule 2, computed once. A `REVERSE` row **restores** money to the
   * entry; rendering it as another spend inverts the branch's position on screen.
   * Every call site reads this flag rather than re-testing `consumptionKind`, so
   * there is one place the rule can be wrong and one place it is proven.
   */
  isRestoration: boolean
  /** Rule 1, as a predicate — a consumption whose document will never arrive. */
  isOrphan: boolean
  document: JournalDocument
}

/**
 * One entry's journal, **oldest first**.
 *
 * Why forward in time: 272's audit pane is a projection of this same journal into
 * one column of time, and two panes on one screen that disagreed about the
 * direction of time would be a defect rather than a preference. It also puts a void
 * directly beneath the receipt it voids — the one row-pair whose meaning depends on
 * adjacency (the fixture's 0455 is that case).
 *
 * 🚩 Tie-broken by `settlementConsumptionId` so the order is **total**: two rows can
 * genuinely share a minute-precision timestamp, and an unstable comparator would let
 * a re-render reshuffle a journal under the reader. Recorded in `.afk/HITL-269.md`.
 */
export function journalFor(
  settlementEntryId: string,
  consumptions: readonly SettlementConsumption[],
): JournalRow[] {
  return consumptions
    .filter((c) => c.settlementEntryId === settlementEntryId)
    .sort(
      (a, b) =>
        (a.consumedAt < b.consumedAt ? -1 : a.consumedAt > b.consumedAt ? 1 : 0) ||
        (a.settlementConsumptionId < b.settlementConsumptionId ? -1 : 1),
    )
    .map((consumption) => {
      const document = describeDocument(consumption)
      return {
        consumption,
        isRestoration: consumption.consumptionKind === 'REVERSE',
        isOrphan: document.kind === 'orphan',
        document,
      }
    })
}

/**
 * How an entry stopped being open — `null` while it still is.
 *
 * ⚠️ **`written-off` is not `consumed`, and that distinction is 269's Proof.** A
 * `CLOSED_OUT` entry shows a zero remaining that **no consumption produced**: an
 * accountant forgave the remainder. Collapsing the two would tell a branch its money
 * was taken by a till when in fact it was written off — a different fact about where
 * the money went, and the one the branch will ask about.
 */
export type EntryClosure = 'consumed' | 'cancelled' | 'written-off' | null

/**
 * One row of the entries grid: the wire entry, its journal, and the three things
 * the grid derives from the pair.
 *
 * Flat (the entry is spread) because AG Grid's `field` addresses a property, and a
 * column list that had to spell `entry.entryNumber` everywhere would put the row
 * shape into every `ColDef` — which is where the neighbours' column completeness
 * proofs would stop being able to see it.
 */
export type AccountEntryRow = SettlementEntry & {
  journal: JournalRow[]
  journalCount: number
  isOpen: boolean
  closure: EntryClosure
  /** Any `CONSUME` row on this entry whose document will never arrive. Rule 1,
   *  lifted to the entry so a collapsed drilldown can still flag it. */
  hasOrphan: boolean
  /**
   * What the Remaining column actually draws — `null` where the wire's figure is
   * not a claim on anybody.
   *
   * 🚩 **A `CANCELLED` entry keeps its full `remainingAmount` on the wire** (the
   * cancel closes the row without zeroing the figure — the fixture's 0688/147 still
   * carries 180.000). Drawing that number under a Remaining header says the branch
   * owes 180.000 it does not owe, on a row whose whole meaning is *this never
   * happened*. `accountHeadline` already refuses to count it; this is the same
   * refusal one column over, so the grid and the headline cannot tell a reader two
   * different things about one entry.
   */
  displayRemaining: number | null
  /**
   * What a write-off forgave, or `null` for every other status.
   *
   * Read off the journal's **last `remainingAfter`** — the server's own figure at
   * the moment of the close — falling back to the full `amount` for a `CLOSED_OUT`
   * entry no till ever touched. 🚩 It is not a variance and not a difference between
   * two totals: it is one number the server already wrote, read back.
   */
  writtenOff: number | null
}

function closureOf(entry: SettlementEntry): EntryClosure {
  switch (entry.status) {
    case 'OPEN':
      return null
    case 'CONSUMED':
      return 'consumed'
    case 'CANCELLED':
      return 'cancelled'
    case 'CLOSED_OUT':
      return 'written-off'
  }
}

/**
 * The whole grid, from the account envelope's two flat arrays.
 *
 * 🚩 The consumptions are indexed **once** into a `Map` rather than re-filtered per
 * entry. At a branch with three open entries that is a wash; the point is that the
 * shape does not degrade — this is the client-side face of the same mistake the
 * server's read model warns about, and the fixture that will find it is a branch
 * with a year of history, not one of the six.
 *
 * Landing order is **open entries first, then closed**, newest posted first inside
 * each group, tie-broken by entry number so it is total. Open entries are what a
 * phone call is about; the closed ones are the history behind them. Every column is
 * still sortable — this is a landing order, not a constraint (`.afk/HITL-269.md`).
 */
export function projectAccount(account: SettlementAccount | null | undefined): AccountEntryRow[] {
  // ⚠️ Defensive because the contract is **not settled yet** (D8: the route strings
  // and this shape are 274's to confirm). A door that answers `data: null`, or the
  // two arrays under different names, would otherwise throw inside render — and
  // there is no ErrorBoundary in this app, so that blanks the whole SPA rather than
  // showing the error banner two lines away. The neighbours guard the same way
  // (`DepositsPage`, `DepositDetail`); an empty account is a screen that says so.
  const entries = account?.entries ?? []
  const byEntry = new Map<string, SettlementConsumption[]>()
  for (const c of account?.consumptions ?? []) {
    const bucket = byEntry.get(c.settlementEntryId)
    if (bucket) bucket.push(c)
    else byEntry.set(c.settlementEntryId, [c])
  }

  const rows = entries.map((entry) => {
    const journal = journalFor(entry.settlementEntryId, byEntry.get(entry.settlementEntryId) ?? [])
    const last = journal.at(-1)
    return {
      ...entry,
      journal,
      journalCount: journal.length,
      isOpen: entry.status === 'OPEN',
      closure: closureOf(entry),
      hasOrphan: journal.some((r) => r.isOrphan),
      displayRemaining: entry.status === 'CANCELLED' ? null : entry.remainingAmount,
      writtenOff:
        entry.status === 'CLOSED_OUT' ? round3(last ? last.consumption.remainingAfter : entry.amount) : null,
    }
  })

  return rows.sort(
    (a, b) =>
      Number(b.isOpen) - Number(a.isOpen) ||
      (a.postedAt < b.postedAt ? 1 : a.postedAt > b.postedAt ? -1 : 0) ||
      b.entryNumber - a.entryNumber,
  )
}
