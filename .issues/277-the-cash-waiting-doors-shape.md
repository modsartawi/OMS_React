---
type: wayfinder-ticket
wayfinder: research
map: 275
status: done
blocked-by: —
---

# 277 — The cash-waiting door's shape

## Question

`Settlement/Uncollected` is **drafted and costed but not built** — §2 of
`.afk/BACKOFFICE-TICKET-DRAFT-settlement-reads.md`, one of three asks still outstanding on
BackOffice. This ticket settles its shape before it is asked for, because the draft was written to
close 274's gap and not to serve this map's screen.

The draft asks for:

```
GET Settlement/Uncollected?limit=  →  { documentId, documentNumber, storeId, amount, preparedAt }[]
```

estate-wide, mirroring `Settlement/Orphans` exactly. Three things to settle against the server
source (`SettlementAccountantService.cs`, branch (4) of the fleet query, ~line 215):

1. **It carries no branch name and no `ServedBy`.** Under the map's mine-first ranking the row needs
   both — the name to read, and `IsMine` to rank. `LabelBranchesAsync` (line 490) already adds
   `StoreName` + `CurrencyKey` to ledger rows, and `Settlement/Branches` (lines 916-933) already
   computes `ServedBy` + `IsMine`. 🔑 **Both halves exist; nothing here is new work, only a
   projection nobody has composed.** Confirm that and say so in the ask — a "small" label the server
   author can verify is worth more than a paragraph of justification.
2. ⚠️ **There is no supporting index, and the fleet query says so itself.** That branch is an
   aggregate over the whole journal today, tolerated at fleet volume. Going estate-wide as its own
   enumerating door is a different query plan. Establish what it costs before asking — 274's worst
   find was a door whose default `TOP` silently dropped 894 branches, and it was found by measuring
   rather than by reading.
3. **`documentNumber` is `''` by definition here** (that is what uncollected *means* — a number is
   stamped at collection). So the row has no human-quotable handle at all: no entry number, no
   receipt number. What does an accountant say on the phone to identify it? Compare
   `describeDocument` in 269, which had the same problem for orphans and answered it **in words**
   rather than with a blank cell.

Also worth settling: whether the *not-voided* half of the predicate (`NOT EXISTS` a REVERSE naming
the same document) stays spelled twice. The fleet query's own comment flags it as a deliberate
re-spelling of `SettlementAccountStore`'s correlated version, *"if the meaning ever moves, it moves
in both"* — a third copy would be the point at which that stops being a note and becomes a defect.

## From [276](276-what-an-entrys-age-is-measured-from.md) — a fourth thing to settle, and it moves item 3

276 ruled the clock (`preparedAt`, server-subtracted `ageDays`, calendar days) and in doing so found
that **the clock is not on the table the fleet flag reads**. So this ticket has a live choice of
*table*, not just of projection:

- **`PosSettlementConsumption`** — what branch (4) of the fleet query aggregates today
  (`SettlementAccountantService.cs:216-231`): special-receipt CONSUME, `DocumentNumber = ''`, no
  REVERSE naming the same document. Proven against production data, and the predicate the draft
  mirrors. But the row has **no prepared timestamp at all** — its only clock is `ConsumedAt`, and it
  carries no `PreparedByName`.
- **`PosSettlementDocument`** (`SettlementDocumentEntity.cs`) — `SettlementDocumentId · StoreId ·
  SettlementEntryId · **EntryNumber** · Amount · Note · PreparedByStaffId/Name · **PreparedAt** ·
  DocumentNumber · CollectedAt · CollectedByOperatorId · Status`. Uncollected is `Status == Prepared`
  (`SettlementCollectService.cs:147`; `:367-374` shows collection stamping `CollectedAt` +
  `Status = Collected`). This is a chase row's whole sentence in one row, and `PreparedAt` is stamped
  `_clock.Now` (`SettlementReceiptService.cs:90,106`) — the same local wall clock as `postedAt`.

🔑 **This substantially answers item 3 above.** The premise *"no entry number, no handle at all"* is
true of the consumption row and **false** of the document row, which carries `EntryNumber` — the one
human-quotable id, and the same handle the Owing and Owed tabs use. The words-not-blank-cell fallback
may not be needed at all; settle that before designing it.

⚠️ **The cost of switching tables is a third spelling of *uncollected*.** The server's own comment at
`:213-219` already flags that the meaning is spelled twice and warns *"if the meaning ever moves, it
moves in both"* — this ticket's closing paragraph names a third copy as the point that becomes a
defect. `Status == Prepared` is a *different* spelling, not a copy of the same one, so if this door
sits on the document table the research must satisfy itself the two predicates **select the same
set** — and say what happens to a document whose consumption was reversed but whose `Status` was
never moved off `Prepared`.

Whichever table wins, 276 fixes this much: **the row carries `preparedAt` and a server-computed
`ageDays`**, and the age is not the client's to derive.

## Output

An updated §2 in the hand-off draft: the exact projection, the ranking fields, the index question
answered or explicitly flagged, and the identification-in-words decision. Not a client change —
this repo is read-only on that side.

## Answer

**The door sits on `PosSettlementConsumption` — the table the fleet flag already reads — and the
choice of table 276 handed forward is closed by measurement rather than by preference: the document
table does not exist at head office until a receipt is *collected*.** Resolved AFK, 2026-08-15,
against `POS_Server` and `POS` on `.\SQLEXPRESS`.

### 🚩 The finding that decides it — `PosSettlementDocument` is a STORE-side table

276 offered `PosSettlementDocument` as the row carrying *"a chase row's whole sentence"* —
`EntryNumber · PreparedByName · PreparedAt · Status`. It does carry all of that. **At the store.**

| database | `Status = PREPARED` | `Status = COLLECTED` |
|---|---|---|
| `POS` (store) | **1** | 1 |
| `POS_Server` (head office) | **0** | 1 |

The server's row is not synced at prepare — it is **created at collection**, by
`CollectionSyncHandler` (`:57-87`): *if the document is unknown, insert it and stamp
`Status = Collected`*. So `Status == Prepared` selects the **empty set** on the server, permanently
and by construction. A door built on it would answer *"no cash is waiting"* on an estate where cash
is waiting — the worst shape of wrong answer this map has, because it is indistinguishable from good
news.

🔑 **This also deletes the third-spelling risk this ticket and 276 both flagged.** There is no
competing predicate to keep in step, because there is no second candidate. The meaning stays spelled
where it is.

### 🔑 And the consumption row's clock is the prepared-at moment after all

276's wrinkle was that the consumption row *"has no prepared timestamp at all; its only clock is
`ConsumedAt`"*. True of the column name and **false of the meaning** —
`SettlementReceiptService`'s own headline is *"**THE CONSUME HAPPENS AT PREPARE, NOT AT COLLECT.**
The manager commits the amount and the collector merely takes it later"*. The CONSUME row is written
during the prepare, so its `ConsumedAt` **is** when the receipt was prepared.

And it is head office's own clock: `SettlementAccountStore.cs:445,572` stamps `ConsumedAt =
DateTime.Now` — the same local wall clock as `PostedAt`, per `no-utc-time`. So 276's one clock rule
covers all three tabs with no exception, and the wire field is named for what it means:

> `preparedAt` = the special-receipt CONSUME row's `ConsumedAt`, `ageDays =
> DATEDIFF(day, c.ConsumedAt, <server now>)`.

⚠️ **The cost accepted, stated plainly:** `PreparedByName` is store-side too, so head office cannot
say *who prepared the receipt*. It does not need to — see item 1: the person to ring is the
**collector on the pairing**, not the manager who prepared it. The lane loses nothing it was going
to say.

### Item 3 — the handle, and it is not words

**`EntryNumber`, reached by the join the row already affords.** The consumption carries
`SettlementEntryId`; joining `PosSettlementEntry` gives the number, the kind, the branch and the
posting. Driven live against the one uncollected receipt on `POS_Server` today:

| consumption | consumedAt | amount | → entryNumber | store | kind | entry status |
|---|---|---|---|---|---|---|
| `06G0AV5T2Y…` | 2026-08-15 15:36 | 100.000 | **1407** | P001 | SHORTAGE | CONSUMED |

So the premise *"no entry number, no handle at all"* is **false**, and 269's `describeDocument`
words-not-a-blank-cell fallback is **not needed here**. The accountant quotes the same handle on all
three tabs — *"entry 1407"* — which is the one thing 1173 minted `EntryNumber` to be.
`documentNumber` is dropped from the draft's projection outright (it is `''` by definition, and a
column that is always blank teaches readers to stop looking at it); `documentId` stays as the machine
handle a later collect/void link would need.

⚠️ **A partly-consumed entry can legitimately appear on Owing *and* on Cash waiting, and must not be
deduplicated.** They are two different sentences about the same money — *"the branch still owes 40"*
and *"a receipt for 60 is prepared and nobody has been to fetch it"*. The live row above happens to
be fully consumed, so its entry is `CONSUMED` and shows only on Cash waiting; that is a coincidence
of one receipt paying one entry off, not a rule. [281](281-the-open-settlements-view.md) draws both.

### Item 1 — the projection, composed

```
GET Settlement/Uncollected?limit=  →
{ settlementConsumptionId, documentId, storeId, storeName, servedBy, isMine,
  entryNumber, entryKind, amount, currencyKey, preparedAt, ageDays }[]
```

Estate-wide, no scope parameter — `Settlement/Orphans`' shape exactly, for
`GetFleetAsync`'s stated reason: *"1255 of the estate's 1394 branches are unassigned, so under a
naive mine their money would be on nobody's screen"*. `servedBy`/`isMine` **rank and label; they
never filter** — the ruling `Settlement/Branches` already carries (§5 of the draft).

Confirmed as this ticket asked: **both halves exist and neither is new work.** `LabelBranchesAsync`
(`:490`) already adds `StoreName` + `CurrencyKey` to ledger rows by chunked plural read, and
`GetBranchesAsync` (`:916-933`) already computes `ServedBy` + `IsMine`. This is those two applied to
a third row shape. ✅ `currencyKey` rides along for free the way it did on the ledger, which is §1 of
the draft partially satisfied on a door that does not exist yet rather than a new ask.

### Item 2 — the index question, answered by measurement rather than flagged

**No index is asked for.** The fleet query's *"⚠ NO SUPPORTING INDEX, and none is minted"* remark is
about branches (2) and (4) scanning `PosSettlementConsumption`, and its own reasoning holds: *"the
journal grows by a handful of rows per branch per MONTH … low tens of thousands of narrow rows"*.
274 then measured the fleet door — which **contains this branch** — at **38–76 ms** for the whole
estate. Enumerating branch (4) on its own is strictly cheaper than the aggregate that already runs
it, so an estate-wide door costs less than the flag it replaces, not more.

The revisit trigger is worth writing into the ask so it is not rediscovered: if
`PosSettlementConsumption` ever reaches millions of rows, the right index is a **filtered**
one — `WHERE DocumentType = 'SPECIAL_RECEIPT' AND DocumentNumber = ''`, keyed on `ConsumedAt` —
mirroring `IX_SettlementConsumption_Orphan`'s shape (filtered on `DocumentId = ''`, keyed on
`ConsumedAt`), which is the pattern this table already proves.

**Cap:** the estate's uncollected population is bounded by *receipts prepared and not yet fetched*,
which is a handful per branch at worst. `WORKLIST_LIMIT`'s 500 is the right ceiling and the same
banner watches it. Not the fleet's 2,000 — this is a rare event, not a population.

### The re-spelling question, closed

The predicate stays spelled **once more, not twice more**: lift branch (4)'s WHERE into a
`private const string UncollectedPredicate` beside `OrphanPredicate` (`:84`) and bind it from both
the fleet query and this door — which is exactly the discipline `OrphanPredicate` was written to
enforce (*"two copies of a money predicate drift, and the drift is invisible from either side"*).
`SettlementAccountStore`'s NHibernate correlated copy remains the known, documented second spelling;
this ticket adds none.

### What goes into the hand-off draft

§2 is rewritten to the projection above, with the store-side finding as its opening paragraph —
because the next person to read *"`PosSettlementDocument` has everything you want"* will otherwise
reach the same wrong conclusion 276 did, and it takes a two-database query to see why it is wrong.
