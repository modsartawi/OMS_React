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

/* ════════════════════════════════════════════════════════════════════════════
 * The door — ticket 270's half of the contract.
 *
 * Everything below serves the front page: the search, the scope control and the
 * triaged worklist. ⚠️ **Three of these shapes are extensions of spec 267 D8**,
 * made here and logged in `.afk/HITL-270.md` for 274 to settle against a live
 * SIS.Api — D8's own instruction is to treat its table as *the shape*.
 * ════════════════════════════════════════════════════════════════════════════ */

/**
 * The scope control's three states (D2), and the value the fleet door's `scope`
 * parameter takes.
 *
 * 🔑 **It ranks and it counts; it never refuses.** Widening is one click and is
 * never locked, because the scope is a convenience and not a permission — a
 * branch outside the scope is still findable, still openable, and its wrong money
 * is still on this screen.
 */
export type SettlementScope = 'mine' | 'unassigned' | 'all'

/**
 * Where one branch sits in the assignment (map 1153), **as the server resolved it
 * for this session**.
 *
 * ⚠️ Three values against the scope's three states, and the mismatch is the
 * point: `mine` is the union of the accountant's own branches and their
 * one-level reports (D2), `unassigned` is the 1255 nobody owns, and `other` is a
 * colleague's — reachable through *all*, and through any search, but never
 * counted as mine.
 *
 * 🚩 **Resolving "mine" is the server's job and must stay there.** The union of
 * own-plus-reports is a query over the assignment tables; a client that tried to
 * recompute it would be re-implementing an org chart it cannot see.
 */
export type SettlementAssignment = 'mine' | 'unassigned' | 'other'

/**
 * One aggregated row per store — D8's `FleetRow`, **plus the four fields the door
 * cannot be built without** (all four in `.afk/HITL-270.md`):
 *
 * | added | why it could not wait |
 * |---|---|
 * | `city` | the search resolves *branch code, name in either script, **city**, or entry number* (D2). Three of the four are on D8's row; the fourth was not |
 * | `assignment` | the scope has to rank and count **on the client**, because the two estate-wide lanes must not be re-fetched per scope. See `scope.ts` |
 * | `ageingCount` | the ageing lane is *a count and a way through* whose threshold is **the server's** (the ticket forbids inventing one here) — so the server must send the count it computed |
 * | `currencyKey` | D10: every figure at the **branch's own** precision. `SettlementAccount` needed the same field for the same reason at 269 |
 *
 * 🚩 **Aggregated, never a projection of entries** — D8 says so on the type. One
 * row per store at 1394 stores; the entries behind them are the account's
 * (`Settlement/Account`) and the ledger's, never this door's.
 */
export type SettlementFleetRow = {
  storeId: string
  /** Both scripts in one string, as `SettlementAccount.storeName` carries them. */
  storeName: string
  /** ADDED — the search's fourth key. */
  city: string
  /** ADDED — the server's own resolution of this session's assignment. */
  assignment: SettlementAssignment
  /** ADDED — ISO code, per D10. */
  currencyKey: string
  openCount: number
  shortageTotal: number
  surplusTotal: number
  /** `shortageTotal − surplusTotal`, **server-side**. Displayed, never consumed. */
  signedPosition: number
  movedSinceCutoff: number
  hasOrphan: boolean
  hasUncollectedReceipt: boolean
  /** ADDED — entries open longer than the server's own threshold. */
  ageingCount: number
}

/**
 * One **wrong money** row: a consumption a till wrote with no document behind it,
 * past the server's grace period (1146 → 1148's sweep).
 *
 * 🔑 It is a *consumption*, not a branch — which is exactly why D8's aggregated
 * `hasOrphan` boolean cannot carry this lane. Repair is predicated on a
 * `settlementConsumptionId`, and a lane that could only say *"0331 has one
 * somewhere"* would send the accountant hunting through an account for it.
 *
 * ⚠️ **`ageDays` is the server's**, not a subtraction this screen performs. The
 * grace period is the server's rule, the clock is the server's, and a pure module
 * that read `Date.now()` would be a module whose tests changed answer overnight.
 */
export type SettlementOrphanRow = {
  settlementConsumptionId: string
  settlementEntryId: string
  entryNumber: number
  storeId: string
  storeName: string
  currencyKey: string
  amount: number
  ageDays: number
  consumedAt: string
}

/**
 * One **cash waiting** row: a settlement receipt the branch prepared and no
 * collector has taken.
 *
 * They never expire and are never auto-voided, so **age is the only thing this
 * screen owes** (D2) — there is no status to render and nothing to act on here.
 */
export type SettlementUncollectedRow = {
  documentId: string
  documentNumber: string
  storeId: string
  storeName: string
  currencyKey: string
  amount: number
  ageDays: number
  preparedAt: string
}

/**
 * What the worklist door answers — **the two enumerated lanes, and nothing else**.
 *
 * 🔑 **It takes no `scope` parameter, and that absence is the carve-out made
 * structural.** D2's asymmetry — wrong money and cash waiting are *always*
 * estate-wide whatever the control says — is the first thing someone "tidying the
 * scope handling" would break. A door with no scope to pass cannot be narrowed by
 * accident; narrowing it would have to be a deliberate change to the contract,
 * which is a thing a reviewer sees.
 *
 * `ageingThresholdDays` rides along so the ageing lane can say *how long* is long
 * without this screen inventing the number (the ticket's own boundary).
 */
export type SettlementWorklistResult = {
  orphans: SettlementOrphanRow[]
  uncollected: SettlementUncollectedRow[]
  ageingThresholdDays: number
}

/**
 * One row of the **flat cross-estate ledger** — an entry, plus the two fields a
 * row torn out of its branch needs to be readable.
 *
 * ⚠️ **This is not the account** (D2). It answers *"find entry 143, whichever
 * branch it is on"* and then hands the reader to 269's account, which is the only
 * view that can state a position.
 */
export type SettlementLedgerRow = SettlementEntry & {
  storeName: string
  currencyKey: string
}

/**
 * What `Settlement/Post` answers — ticket 271's write, and D8's shape unchanged.
 *
 * 🔑 **`amount` is the amount the SERVER rounded and stored**, not the figure that
 * was typed. Amounts are posted in what the branch can physically count — whole
 * units at a 2-decimal branch, three decimals at a 3-decimal one — and the server
 * owns that rounding (D4). The confirmation therefore reads this field back rather
 * than echoing the form, which is what makes it impossible for the words an
 * accountant approved and the figure in the ledger to disagree.
 *
 * `entryNumber` is **the handle finance and the branch settle by on the phone** —
 * the one human-quotable id, and the reason the success surface is a number rather
 * than a tick.
 */
export type SettlementPostResult = {
  settlementEntryId: string
  entryNumber: number
  amount: number
}

/**
 * What `Settlement/Cancel` answers — ticket 272's first correction, and D8's shape
 * unchanged.
 *
 * 🔑 **`accepted: false` is a 200, and it is the case this contract exists for.**
 * The server's `remaining == amount` predicate sits *inside* its UPDATE, so a till
 * that consumed a millisecond earlier wins the race — and the honest report is not
 * an error but a **new remaining**, on which the write-off is offered instead.
 * Rendering that as a failure would teach an accountant to distrust a screen that is
 * working exactly as designed (spec 267 D5).
 *
 * ⚠️ `remainingAmount` is therefore **the server's own figure at the moment of the
 * refusal**, not the one the screen was drawn with. It is the only trustworthy
 * number on the screen once a race has been lost, and `correction.ts` recomputes
 * the whole affordance from it rather than patching the old one.
 */
export type SettlementCancelResult = {
  accepted: boolean
  /** The server's words for why, passed through as data. `''` when accepted. */
  refusalReason: string
  remainingAmount: number
}

/**
 * What `Settlement/CloseOut` answers — the write-off, D8's shape unchanged.
 *
 * ⚠️ **D8 gives it two fields and no `refusalReason`**, unlike cancel and repair.
 * That asymmetry is transcribed rather than tidied: inventing a third field here
 * would be this screen assuming a wire it has not seen. A refused close-out
 * therefore reads through the namespace's own sentence, and the gap is logged in
 * `.afk/HITL-272.md` for 274 to settle against a live SIS.Api.
 */
export type SettlementCloseOutResult = {
  accepted: boolean
  remainingAmount: number
}

/**
 * What `Settlement/Repair` answers.
 *
 * 🔑 **`noOp` is not a failure.** The server's repair is predicated on the
 * consumption still having no document, so a late Z arriving mid-click loses the
 * race and nothing happens — which is the right outcome and must read as one. A
 * refusal (`accepted: false`) is likewise a **200 carrying a reason**, never an
 * error, exactly as the till's own consume is (D8).
 */
export type SettlementRepairResult = {
  accepted: boolean
  noOp: boolean
  remainingAfter: number
  refusalReason: string
}
