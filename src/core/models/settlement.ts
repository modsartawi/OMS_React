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
 * ✅ **274, live: `storeId` and `storeName` are real; `currencyKey` is not.** 269
 * added all three to D8's `{ entries, consumptions }` and logged them in
 * `.afk/HITL-269.md`. The live door sends the two identity fields — so a branch
 * reached by a pasted URL still has a name on the page, which was 269's argument for
 * them — and sends no currency.
 *
 * ⚠️ That absence is the money hole recorded at `.afk/FINDINGS-274.md` §B6, and it
 * is **not** worked around by guessing: figures on this screen render through
 * `formatMoneyOfUnknownCurrency`, which shows what is stored and rounds nothing
 * away. 269's reasoning about D10 was right and is why the workaround exists at all.
 */
export type SettlementAccount = {
  storeId: string
  storeName: string
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
 * One aggregated row per store — **BackOffice spec 1173 D13's fleet row, exactly**.
 *
 * ✅ **274 narrowed this back to the contract.** 270 added four fields to D8's row
 * (`city`, `assignment`, `ageingCount`, `currencyKey`) and logged them in
 * `.afk/HITL-270.md` for the joining ticket to settle. Settled: the live door sends
 * none of them, because D13 — the contract BackOffice actually built — never listed
 * them. They are recorded in `.afk/FINDINGS-274.md` §B3–§B6 as decisions for the two
 * specs to make, not as fields to fake here. What each one cost:
 *
 * | dropped | what went with it |
 * |---|---|
 * | `city` | the search's fourth key (§B5). Code, name and entry number still resolve |
 * | `assignment` | the client-side scope **ranking** (§B4). The scope itself moved to the server, where it always belonged |
 * | `ageingCount` | the ageing lane, **removed outright** (§B3) — spec 1173 rules entry staleness *fog*, so there is no threshold to count against |
 * | `currencyKey` | per-branch money precision (§B6). See `formatMoneyOfUnknownCurrency` |
 *
 * 🚩 **Aggregated, never a projection of entries** — D13 says so on the type. One
 * row per store at 1394 stores; the entries behind them are the account's
 * (`Settlement/Account`), never this door's.
 */
/**
 * One **open branch** off the `Store` master — `Settlement/Branches`, the posting
 * form's address book.
 *
 * 🔑 **The estate, which the fleet is not.** Every branch of the fleet door's query
 * drives off the settlement tables, so `SettlementFleetRow[]` is *"branches with
 * settlement activity"* — right for the front page, and on a database where nothing
 * has been posted yet it is **empty**. A picker resolving a typed branch against it
 * could therefore never name the first branch to post to: the only door that mints a
 * settlement row was unreachable without one already existing. Found live by 274 and
 * fixed on the server (BackOffice 1199); this type is that door's answer.
 *
 * ⚠️ `Closed = 0` server-side — a shut branch has no till to consume an entry, so
 * money posted against one can only ever be written off.
 */
export type SettlementBranch = {
  /** The branch code. Named `storeId` on the wire like every other settlement
   *  payload, though the master column is `Store.StoreCode`. */
  storeId: string
  /** Both scripts in one string, as `SettlementAccount.storeName` carries them. */
  storeName: string
  /** 🔑 D2's third search key, back — the fleet row has never carried one. */
  city: string
  area: string
  /**
   * 🔑 **Who serves this branch** — the assigned accountant's display name, or `''`
   * for the ~1255 branches paired to nobody.
   *
   * The pairing master **ranks and labels** this list; it does not gate it. Naming
   * the holder is what makes posting to somebody else's branch a visible act instead
   * of a silent one — the guarantee that replaces refusing it, and it costs no
   * branch its reachability.
   */
  servedBy: string
  /**
   * Whether the **session** serves this branch — own branches ∪ one-level reports',
   * the same reading of *mine* the fleet's `scope` gives, resolved server-side.
   *
   * ⚠️ An **ordering input, never a permission**. Gating on it was considered and
   * refused: 1255 of 1394 branches are paired to nobody, so a filter here would make
   * their shortages unpostable by anyone while the bulk lane kept reaching them —
   * and BackOffice 1173 already ruled the boundary is the screen grant, not the
   * store.
   */
  isMine: boolean
}

export type SettlementFleetRow = {
  storeId: string
  /** Both scripts in one string, as `SettlementAccount.storeName` carries them. */
  storeName: string
  openCount: number
  shortageTotal: number
  surplusTotal: number
  /** `shortageTotal − surplusTotal`, **server-side**. Displayed, never consumed. */
  signedPosition: number
  movedSinceCutoff: number
  hasOrphan: boolean
  /** ⚠️ A **flag**, and there is no door that enumerates the set behind it — which
   *  is why the cash-waiting lane is not on this screen (`FINDINGS-274.md` §B2). */
  hasUncollectedReceipt: boolean
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
 * ⚠️ **274, live: this is a `SettlementConsumption`, and only that.**
 * `Settlement/Orphans` answers the estate's orphan consumptions with the SAME
 * projection the account door uses for its journal — deliberately narrow, because
 * the door is a seek over a filtered index and the four fields 270 asked for would
 * each turn it into a lookup per row. So `entryNumber`, `storeName`, `currencyKey`
 * and `ageDays` are **not on this wire** and are recorded for BackOffice rather
 * than faked here: `ageDays` in particular must stay the server's subtraction (the
 * clock is the server's), and a client that computed it would be inventing the
 * grace period the ticket forbids inventing.
 *
 * The fields the projection DOES cover are the ones the lane cannot act without:
 * `settlementConsumptionId` is what Repair posts, and `amount` is the money.
 */
export type SettlementOrphanRow = {
  settlementConsumptionId: string
  settlementEntryId: string
  storeId: string
  amount: number
  /** Local wall clock, as every timestamp on this contract is. The lane orders on
   *  it — oldest first — which is `ageDays`' job done by the only field there is. */
  consumedAt: string
  /** Always `CONSUME`: a `REVERSE` names a document that did not happen and is
   *  never itself an orphan (the door's own predicate). */
  consumptionKind: SettlementConsumptionKind
  documentType: SettlementDocumentType
  /** Always `''` — being blank is what MAKES these rows orphans. */
  documentId: string
  documentNumber: string
}

/* ⚠️ **Two types stood here until 274 and are deliberately gone**, each because the
 * door behind it does not exist (`.afk/FINDINGS-274.md`):
 *
 * - `SettlementUncollectedRow` — the cash-waiting lane (§B2). The fleet row carries
 *   `hasUncollectedReceipt`, a flag; nothing enumerates the receipts behind it.
 * - `SettlementWorklistResult` — the two-lane worklist (§B2/§B3). What exists is
 *   `Settlement/Orphans`, one lane, typed as `SettlementOrphanRow[]` above.
 *
 * 🚩 They are not commented out and not kept "for later". A type whose door does not
 * exist is a claim about a server that never agreed to it, which is the exact defect
 * 274 was written to find — and the fixtures that fed them were the reason it stayed
 * invisible for five tickets.
 *
 * ✅ **`SettlementLedgerRow` was the third, and it is BACK — as a door.** §B1 was
 * right that D13 specified six doors and the ledger was not among them; the answer
 * was to build the seventh (BackOffice 1199 §3), not to fake it. See below.
 */

/**
 * One entry **anywhere in the estate** — `Settlement/Ledger`.
 *
 * 🔑 **The door exists to resolve the number 1173 mints and never resolves.** The
 * spec calls `entryNumber` *"the handle finance and the branch settle by on the
 * phone"* — and `Settlement/Account` cannot look one up, because it takes the
 * `storeId` the caller is ringing up to **ask for**. So *"entry 143 — which branch
 * is that?"* was the one question the minted number invites and nothing could answer.
 * The number is unique estate-wide (`UX_SettlementEntry_Number`), so the answer is
 * exactly one row.
 *
 * 🚩 **It is `SettlementEntry` plus two fields, by intersection rather than by
 * restatement** — the server subclasses its own account row for the same reason. An
 * entry is one thing; two hand-maintained shapes of it drift, and the drift shows up
 * as a blank cell with nothing failing anywhere.
 */
export type SettlementLedgerRow = SettlementEntry & {
  /** Resolved at read time off the `Store` master, the code echoing back when there
   *  is no master row. 🔑 **The answer, not decoration** — a code only half-answers
   *  the question the phone handle asks. */
  storeName: string
  /**
   * 🔑 **Per row, because this list crosses currencies** — and the reason nothing on
   * this view totals a column.
   *
   * The estate is KSA **and** Bahrain. A cross-branch ledger holds riyals and dinars
   * in one column, so a Σ over it adds the two and is wrong in both; and D15 makes an
   * entry's granularity depend on this field, so drawing both at one precision is
   * wrong for one of them. This is the field the account and fleet rows still lack
   * (BackOffice 1199 §1) — here it arrives because the door was built after the
   * finding rather than before it.
   */
  currencyKey: string
}

/**
 * What the ledger is being asked about — every field optional **individually**, and
 * ⚠️ **at least one required**.
 *
 * 🚩 The server refuses a bare call (`SettlementLedgerCriterionRequired`) rather than
 * capping one, and the reason is worth carrying on the client too: an unfiltered
 * ledger is bounded only by the row cap, so it would answer *"the newest 500 entries
 * in the estate"* while **looking like** the ledger. A cap is honest when it
 * truncates an answer; it is not honest when it makes one.
 *
 * ⚠️ `status: 'OPEN'` alone satisfies it, and that is the ordinary estate-wide call —
 * the refusal is aimed at the empty question, never at breadth.
 */
export type SettlementLedgerCriteria = {
  /** The phone handle. A **one-row** answer whatever else is asked. */
  entryNumber?: number
  storeId?: string
  entryKind?: SettlementEntryKind
  status?: SettlementEntryStatus
  /** One uploaded batch — *"everything finance sent in that file"* (273's `batchId`). */
  batchId?: string
  /** `YYYY-MM-DD`. Inclusive. */
  postedFrom?: string
  /** `YYYY-MM-DD`. ⚠️ **The whole of that day** — the server compares against the
   *  next midnight, exclusively, so a reader who types today does not get an empty
   *  answer because the entries were posted at 14:00. */
  postedTo?: string
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
  /** ✅ 274, live: the entry's status **after** the act — `CANCELLED` when accepted,
   *  and the unchanged status when the race was lost. `SettlementEntryActApiResponse`
   *  carries it on both doors; the screen no longer has to infer it from `accepted`. */
  status: SettlementEntryStatus
}

/**
 * What `Settlement/CloseOut` answers — the write-off, D8's shape unchanged.
 *
 * ✅ **274 settled the asymmetry D8 described: there isn't one.** Cancel and
 * close-out share ONE server type (`SettlementEntryActApiResponse`), so the
 * close-out answers `refusalReason` and `status` too. 272's transcribed two-field
 * shape was the narrower guess of the two, and `.afk/HITL-272.md`'s open question
 * is closed by widening it — a refused close-out now reads the server's own reason
 * rather than the namespace's generic sentence.
 */
export type SettlementCloseOutResult = {
  accepted: boolean
  remainingAmount: number
  /** `''` when accepted. See the type's docblock — this field is 274's, not D8's. */
  refusalReason: string
  status: SettlementEntryStatus
}

/**
 * What `Settlement/Repair` answers.
 *
 * 🔑 **`noOp` is not a failure.** The server's repair is predicated on the
 * consumption still having no document, so a late Z arriving mid-click loses the
 * race and nothing happens — which is the right outcome and must read as one. A
 * refusal (`accepted: false`) is likewise a **200 carrying a reason**, never an
 * error, exactly as the till's own consume is (D8).
 *
 * ⚠️ **`remainingAmount`, not `remainingAfter`.** 270 transcribed the consumption
 * row's field name onto this answer; the wire calls it `remainingAmount`
 * (`SettlementRepairApiResponse`), so the old spelling read `undefined` and would
 * have reached a money formatter the first time anything rendered it. Settled live
 * by 274 — the one field on this contract that was misnamed rather than missing.
 */
export type SettlementRepairResult = {
  accepted: boolean
  noOp: boolean
  /** The entry the money went back onto. `''` on a no-op. */
  settlementEntryId: string
  /** The **compensating** `REVERSE` row the repair wrote — not the orphan it
   *  repaired. `''` on a no-op or a refusal. */
  settlementConsumptionId: string
  /** What was put back. `0` on a no-op — the server's figure, not the lane row's. */
  amount: number
  /** What the entry carries **after** the restoration. */
  remainingAmount: number
  refusalReason: string
}

/* ════════════════════════════════════════════════════════════════════════════
 * The second posting door — ticket 273's half of the contract (spec 267 D7/D8).
 *
 * A month's audit **already ends in a spreadsheet**, so the input shape is found
 * rather than invented. Two calls ride over the same multipart upload: preview
 * parses and returns, and **commit re-sends the file**. There is no staging table
 * and no client-held row state — what commits is the file, not a JSON array the
 * browser assembled and could have diverged from.
 *
 * ⚠️ **Every shape below is an extension of D8**, which gives the two doors a body
 * and the names of their result's arrays and no field list. They are transcribed
 * here and logged in `.afk/HITL-273.md` for 274 to settle against a live SIS.Api —
 * D8's own instruction is to treat its table as *the shape*.
 * ════════════════════════════════════════════════════════════════════════════ */

/**
 * One parsed row of the sheet, as the server resolved it.
 *
 * 🔑 **`storeName` is the guard.** The preview grid's whole claim is that every row
 * shows its store code **resolved to a branch name** — it is what catches the one
 * error a number-only review cannot, *the right amount posted onto the wrong
 * branch*. A blank name is therefore a hard error on this screen (`bulk.ts`), not a
 * cosmetic gap.
 *
 * ⚠️ There is **no kind column**: one kind per file, chosen with 271's toggle at the
 * *file* level (D7). A mixed file would make the in-words total a **net** figure a
 * typo could hide inside.
 */
export type SettlementBulkRow = {
  /** The sheet's own row number, so *"fix row 12"* is actionable in the workbook
   *  the accountant still has open. Headers are read **by name**, so this is a
   *  position in the file and never a position in a schema. */
  rowNumber: number
  /** ⚠️ **`storeCode`, not `storeId`** — settled live by 274. It is the code as the
   *  SHEET spelled it, echoed back whether or not it resolved, which is why the
   *  server names it after the file's column rather than after a branch it may not
   *  have found. Every other door on this contract says `storeId`; this one row type
   *  is the exception, and it is the server's own spelling. */
  storeCode: string
  /** `''` = the code resolved to no branch. See the type's docblock. */
  storeName: string
  /** ISO code — the row's own, per D10: a Bahraini branch's fils are not rounded
   *  away because the rest of the file is Saudi. */
  currencyKey: string
  /** 🔑 The **rounded** amount — what would be posted, at the branch's own
   *  granularity (D15). This is the figure the read-back folds. */
  amount: number
  /** ✅ 274, live: the figure as the SHEET held it, before the server rounded it.
   *  D8 did not know about this field. It is what lets the preview show *"you typed
   *  150.750, this branch posts 151"* instead of silently changing a number finance
   *  will later reconcile against their own file. */
  fileAmount: number
  /** Free text ≤200 the branch reads verbatim, exactly as the single form's. */
  reason: string
}

/**
 * One reason nothing in this file may commit.
 *
 * 🔑 **Hard errors are all-or-nothing** (D7), deliberately stricter than the
 * assignment seed's insert-all-blind precedent — *a seed row is inert and a posted
 * entry is money someone will be asked for*. The preview enumerates the bad rows,
 * finance fixes the sheet and re-uploads.
 */
export type SettlementBulkIssue = {
  /** `0` = the **file's** fault rather than a row's — a missing required header,
   *  which must refuse naming what it expected (the ticket's open question). */
  rowNumber: number
  /** ✅ 274, live: the row's store code, so an issue can name the branch it is
   *  about without the reader cross-referencing the grid. `''` on a file fault. */
  storeCode: string
  /** ⚠️ **`code`, not `column`** — settled live by 274. 273 guessed the fault would
   *  be located by COLUMN; the server locates it by **machine code**
   *  (`SettlementBulkFileParser`'s own vocabulary), which is a thing a client may
   *  branch on rather than a hint about where to look in a spreadsheet. */
  code: string
  /** The server's own words, passed through as data. */
  message: string
}

/**
 * ✅ **274, live: errors and warnings are ONE server type**
 * (`SettlementBulkIssueModel`), not two. 273 modelled them separately because D8
 * names two arrays — but the arrays differ in what they MEAN (all-or-nothing vs
 * look-twice), never in their shape. The aliases are kept so the call sites still
 * read as the two different decisions they are.
 */
export type SettlementBulkError = SettlementBulkIssue

/**
 * One reason to look twice at a row that **still commits**.
 *
 * 🚩 The batch must **never be stricter than the single form** (D7): a branch
 * already carrying an open entry of the same kind is flagged on its row and posts
 * anyway, or a real second shortage months apart becomes unpostable by file.
 */
export type SettlementBulkWarning = SettlementBulkIssue

/** What `Settlement/Bulk/Preview` answers for one uploaded file. */
export type SettlementBulkPreview = {
  /** Minted at preview and handed back at commit. A **handle and a provenance
   *  fact** — never a second lifecycle (D7). */
  batchId: string
  /** The hash of the bytes that were previewed. The commit re-sends the file and
   *  the server compares; a mismatch means the sheet changed between review and
   *  commit and it refuses. Held here so the screen can say which file it read. */
  contentHash: string
  /** Echoed back, because the kind is the FILE's and the screen must be able to
   *  show that what it reviewed is what it chose. */
  entryKind: SettlementEntryKind
  rows: SettlementBulkRow[]
  errors: SettlementBulkError[]
  /**
   * ⚠️ **A warning at `rowNumber: 0` is about the FILE, not a row** — and that is
   * where the replay notice lives. 273 modelled *"a file with these 47 rows was
   * posted 4 minutes ago by ضحى"* as its own `replay` object; the server sends it
   * as a file-level warning carrying that exact sentence
   * (`SettlementBulkIssueCodes.RecentIdenticalBatch`). Settled live by 274 — the
   * capability is D7's, the shape is the server's.
   */
  warnings: SettlementBulkWarning[]
  /** How many rows the server read out of the sheet. */
  rowCount: number
  /** ✅ 274, live: **the server's own verdict** on whether this file may post
   *  (`Errors.Count == 0`). ⚠️ `bulk.ts` still computes its own, because it adds one
   *  client-side blocker the server cannot make — an unresolved branch name — and a
   *  commit is licensed by what the accountant could READ, not only by what parsed. */
  canCommit: boolean
  /** The server's own sum. ⚠️ Used as a **cross-check**, never as the read-back:
   *  the in-words total is folded from the rows, per currency (`bulk.ts`). */
  total: number
}

/**
 * What `Settlement/Bulk/Commit` answers.
 *
 * ⚠️ **`replayed` is a boolean** — *this exact batch was already committed, nothing
 * was doubled, and these are the same entry numbers*. It is the answer to a second
 * tab pressing commit twice; under an all-or-nothing commit a partial replay cannot
 * exist, so a count would have nothing to count. ✅ Confirmed live by 274.
 *
 * 🔑 **274 settled the refusal, and 273 had it backwards.** A sheet edited between
 * review and commit does **not** arrive as a business `ApiError`: it is a **200
 * carrying `accepted: false`** and a `refusalReason`, exactly like cancel and
 * repair. The only non-200 on this door is a MALFORMED upload — no file, too large,
 * an unsupported extension, or bytes that yield no rows — which is a 400 through the
 * envelope. So the screen reads `accepted` and never infers success from the absence
 * of a throw.
 */
export type SettlementBulkCommitResult = {
  batchId: string
  /** 🔑 `false` = nothing was posted. See the type's docblock. */
  accepted: boolean
  /** The server's own words — a hash mismatch, or a row that stopped being postable
   *  between preview and commit. `''` when accepted. */
  refusalReason: string
  posted: number
  replayed: boolean
  /** The handles finance and the branches settle by on the phone. */
  entryNumbers: number[]
  /** Why it refused, per row, when the refusal was a row's. */
  errors: SettlementBulkError[]
  warnings: SettlementBulkWarning[]
}

/**
 * What `Settlement/Bulk/Cancel` answers — ✅ **a door 273 did not know existed**,
 * found live by 274 (BackOffice ticket 1186).
 *
 * 🔑 **It replaces a client-side loop.** 273 withdrew a batch by fetching the
 * cross-estate ledger for a `batchId` and calling `Settlement/Cancel` once per row
 * — N round trips whose partial failure the browser had to summarise itself. The
 * server does the same loop over 1185's per-entry cancel and reports each row's
 * outcome, so the batch is one request and one answer.
 *
 * ⚠️ **A batch is a handle, never a second lifecycle** (D7) — this is the per-entry
 * cancel applied across a `BatchId`, so a row a till already consumed is *refused
 * and named*, never written off as a side effect of sharing a batch.
 */
export type SettlementBulkCancelResult = {
  batchId: string
  /** Every entry the batch minted. */
  total: number
  cancelled: number
  /** 🔑 Named, not merely counted — see `rows`. */
  refused: number
  rows: SettlementBulkCancelRow[]
}

/** One entry of a withdrawn batch, and what became of it. */
export type SettlementBulkCancelRow = {
  settlementEntryId: string
  entryNumber: number
  storeId: string
  amount: number
  accepted: boolean
  /** The server's own words. `''` when accepted. */
  refusalReason: string
  /** The true remaining at the moment of the refusal — 272's rule, per row. */
  remainingAmount: number
  status: SettlementEntryStatus
}
