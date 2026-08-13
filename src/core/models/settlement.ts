/**
 * The settlement account's wire types — spec 267 D8, which is itself a projection
 * of BackOffice spec 1173 D13/D14.
 *
 * ⚠️ **The route strings and this file's exact casing are the server's to confirm**
 * (D8 says so in as many words). Ticket 274 is the joining event that settles them
 * against a live SIS.Api; until then 269–273 build against fixtures served over the
 * wire, exactly as 262–265 did for the invoice contract.
 *
 * Vocabulary is `CONTEXT.md`'s and BackOffice 1143 A1's, and it is worth stating
 * once here because every field below leans on it:
 *
 * - **SHORTAGE (عجز)** — the branch must hand this money over. A till consumes it
 *   through a **special receipt** the branch prepares for a collector.
 * - **SURPLUS (فائض / مرتجع الشبكة)** — the branch may keep this money back, having
 *   already paid it out of the drawer to refund a card sale. A till consumes it as a
 *   **deduction at shift close**.
 *
 * 🚩 **`amount` is always a positive magnitude; `entryKind` carries the direction.**
 * There is no signed amount anywhere in this contract, so no reader can misread a
 * sign — which is also why the signed position in `account-projection.ts` is
 * computed in one place and labelled rather than stored.
 */

/** Which way the money moves. See the file header — the label is not the direction. */
export type SettlementEntryKind = 'SHORTAGE' | 'SURPLUS'

/**
 * Where an entry has got to.
 *
 * - `OPEN` — posted, remaining > 0.
 * - `CONSUMED` — remaining reached 0 through consumption. Set by the server, never
 *   by a human.
 * - `CANCELLED` — withdrawn while **nothing** had been consumed (1143 A5).
 * - `CLOSED_OUT` — the remainder of a **partly** consumed entry was written off.
 *
 * ⚠️ The last two are the pair 269's Proof turns on: a `CLOSED_OUT` entry shows a
 * zero remaining that **no consumption produced**, and must not read as consumed.
 */
export type SettlementEntryStatus = 'OPEN' | 'CONSUMED' | 'CANCELLED' | 'CLOSED_OUT'

/**
 * A journal row's direction.
 *
 * 🔑 **`REVERSE` is a restoration, not a spend.** It is the compensating row a void
 * writes (1145 A5) and it always means *this document did not happen*. Rendering it
 * as another spend inverts the branch's position on screen, which is why
 * `account-projection.ts` exposes `isRestoration` rather than leaving each call site
 * to remember the rule.
 */
export type SettlementConsumptionKind = 'CONSUME' | 'REVERSE'

/** Which document spent it. A surplus leaves through a shift close, a shortage
 *  through a special receipt — a cross-consume is refused by the server. */
export type SettlementDocumentType = 'SHIFT_CLOSE' | 'SPECIAL_RECEIPT'

/**
 * One posted entry — the accountant's decision, held.
 *
 * `amount` is **immutable once posted** (1143 A4): an entry is cancelled while
 * untouched or written off once partly consumed, and changing the figure is not
 * offered at all. 272 owns those two acts; 269 only renders their outcome.
 *
 * `postedByName` is **denormalised at post time** and is deliberately not resolved
 * on read: it is an audit fact ("who signed this, under the name they had then"),
 * and a later rename or a leaver must not rewrite history.
 *
 * ⚠️ Every timestamp on this contract is **local wall clock**, not UTC. That is the
 * trap D6 names for 272's audit pane: `UaAdminAudit.Timestamp` is UTC, and mixing
 * the two would put a three-hour lie beside a branch manager's own row.
 */
export type SettlementEntry = {
  settlementEntryId: string
  /** The phone-call reference — *"entry 143"* — and the only human-quotable id. */
  entryNumber: number
  storeId: string
  entryKind: SettlementEntryKind
  amount: number
  remainingAmount: number
  /** Free text ≤200 that the **branch reads verbatim** at a till. Server data, so
   *  it passes through unlocalised; every label around it is a `t()` key. */
  reason: string
  status: SettlementEntryStatus
  /** `''` = posted singly. 273's uploaded batch stamps the rest of them. */
  batchId: string
  postedByStaffId: string
  postedByName: string
  postedAt: string
  /** The three below are `''` until a correction closes the entry (272). */
  closedByStaffId: string
  closedAt: string
  closedReason: string
}

/**
 * One journal row — a till taking money against an entry, or giving it back.
 *
 * 🔑 **`documentNumber` is back-stamped**, so `''` is a real and meaningful state
 * rather than missing data: at consume time the Z or the receipt does not exist
 * yet. Seconds later it does — unless the close timed out and the till gave up, in
 * which case it never will and the row is an **orphan** worth real money (1146 →
 * 1148's sweep, and 270's *wrong money* lane). A blank cell makes that invisible,
 * which is why `describeDocument` names the state in words instead.
 */
export type SettlementConsumption = {
  settlementConsumptionId: string
  settlementEntryId: string
  consumptionKind: SettlementConsumptionKind
  storeId: string
  amount: number
  /** What this row **left behind** on the entry — the server's own figure, never a
   *  subtraction this screen performs. */
  remainingAfter: number
  documentType: SettlementDocumentType
  documentId: string
  /** `''` = in flight, or the close never completed. See the type's docblock. */
  documentNumber: string
  businessDay: string
  consumedByOperatorId: string
  consumedAt: string
}

/**
 * What `Settlement/Account` answers for one branch.
 *
 * ⚠️ **The three scalar fields are an extension of spec 267 D8's table, made by
 * ticket 269 and logged in `.afk/HITL-269.md`.** D8 lists the account door as
 * answering `{ entries, consumptions }` and nothing else — but D10 requires every
 * figure to render at **the branch's own currency precision** (3 decimals for BHD,
 * 2 for SAR), and there is no currency anywhere else on this contract. Deriving one
 * from the store code would be a rule nobody wrote down; defaulting to SAR is
 * exactly the silent rounding D10 exists to forbid. `storeName` rides along for the
 * same reason at one remove: 270 reaches this view from a search hit that already
 * knows the branch, but a pasted address does not, and an account headed by a bare
 * code is a screen you cannot check you are on.
 *
 * D8's own instruction is to *"treat this table as the shape, and settle the strings
 * against SIS.Api in the joining ticket"* — so this is 274's to confirm, not a
 * divergence to reconcile later.
 */
export type SettlementAccount = {
  storeId: string
  storeName: string
  /** ISO code — `SAR`, `BHD`. Drives `formatMoneyIn` for every figure on the screen. */
  currencyKey: string
  entries: SettlementEntry[]
  /** **Flat, across every entry**, exactly as D8 has it — the projection indexes
   *  them by `settlementEntryId` once rather than scanning per row. */
  consumptions: SettlementConsumption[]
}
