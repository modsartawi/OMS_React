# HITL — ticket 286 (cash waiting), decisions taken unattended

Spec 282 · prototype `.afk/PROTO-281-open-settlements.html` · built on top of 285's lane.

## Q: Does the front page's signpost (288) grow a third, cash-waiting link?

**Decision taken:** No. `SettlementDoor` now iterates `OPEN_LANE_ENTRY_TABS` (owing/owed)
explicitly rather than `OPEN_LANE_TABS`, with a comment saying why.
**Why:** the signpost is one reading of the ledger answer that screen already holds; cash
waiting is a **second door**, so counting it there would make the front page fetch the
receipts too. Spec 282 story 46 asks the front page to agree with *the two entry tabs*.
**Revisit if:** the owner wants the estate's uncollected cash visible without opening the
lane — then it is a signpost slice of its own, and it costs the door a second call.

## Q: `WORKLIST_LIMIT` (500) reused, or a new constant for the cash lane?

**Decision taken:** a new `CASH_LANE_LIMIT = 500` in `cap.ts`.
**Why:** that file's own rule is one constant per door, asked for by the query and measured
against the answer; two doors sharing a constant is how one silently inherits the other's cap
the day it changes. The ticket cites `WORKLIST_LIMIT`'s **reasoning**, not its identifier.
**Revisit if:** the two lanes are ever merged into one door.

## Q: Does a settlement write invalidate the cash lane's query?

**Decision taken:** No — `invalidateSettlement` is untouched.
**Why:** no writer on this client changes prepared receipts. Post mints an entry; cancel is
only lawful while nothing was consumed; close-out **touches no consumption** by design; repair
concerns orphan consumptions, which are the ones with no document — a prepared receipt has one.
**Revisit if:** a later slice lets head office void or re-issue a special receipt.

## Q: Whose name is `servedBy` on an uncollected row — the collector, or the branch's accountant?

**Decision taken:** rendered under a **Collector** header, using the door's single `servedBy`
field, exactly as the approved prototype does (`<th>${cash ? 'Collector' : 'Served by'}</th>`).
The blank case keeps `open.row.nobodyAssigned` ("Nobody assigned"), also the prototype's.
**Why:** spec D6 gives the door one name field and D10 says the name column is the collector;
minting a second key or a second field would be inventing contract the server never agreed to.
**Revisit if:** BackOffice §2 comes back with `collectorName` distinct from `servedBy` — then
the model gains a field and the column reads it, with no change to the arrangement.

## Q: How does a refused receipts door word itself?

**Decision taken:** the same rule 285 established — `apiErrorMessage(error, t('open.errors.cashFailed'))`,
so the server's own words win and this screen's sentence is the fallback beneath them.
**Why:** the ticket asks for "the same em-dash-and-refusal rule 285 established", and the two
tabs sit in one component; diverging would mean one screen with two failure idioms.
**Noted for the live ticket:** against a bare 500 the reader sees *"The OMS API encountered an
unexpected error"* — which does not say *this is not "everything has been collected"*. 288 solved
exactly this on the front page by interpolating the server's detail **into** the screen's own
sentence. Doing that here would change both tabs' failure rendering, which is 285's to change,
not 286's.
**Revisit if:** the live door (a later ticket) shows the generic message in practice.

## Q: Is the cash door fetched on every tab, or only when its tab is open?

**Decision taken:** always, alongside the ledger call.
**Why:** the tab strip carries its count, and *Cash waiting* with no number beside it is a job
whose size you have to open it to learn. It is ≤500 narrow rows, measured at 38–76 ms
estate-wide (spec 282 Further Notes).
**Revisit if:** the door turns out to be expensive live.

## Q: Does the cash tab share the *Mine only* chip's state with the entry tabs?

**Decision taken:** yes — one component-state flag across all three tabs.
**Why:** it is a narrowing of what is on screen, and 285 already ruled it component state rather
than an address; a per-tab flag would mean the chip silently resetting as the reader moves.
**Revisit if:** readers report the chip surprising them when switching tabs.

## Q: Does the cash tab strip `currencyKey` before rendering money, per D12?

**Decision taken:** No — `settlementMoney(amount, currencyKey)`, the same call the entry tabs'
*Still open* column already makes.
**Why:** raised by `/standards-review`'s spec axis, on D12's *"`Settlement/Uncollected` carries
`currencyKey` because it is free there; that does not change the rendering rule until the account
and fleet reads carry it too."* Checked rather than assumed: `money-display.ts` is written so that
**every call site passes the code and the code is simply empty today** — *"the day the reads carry a
code this function starts honouring it with no call site changing"* — and the **ledger** door does
carry one, so 285's entry rows already honour it. Passing the receipt's code is therefore the
consistent behaviour; stripping it would make this the one column on the screen that refuses a
precision the branch actually has, which is the rounding spec 267 D10 exists to forbid.
**Revisit if:** the two doors ever disagree about a branch's currency — then the rule belongs in one
place above both columns, not in either of them.

## Q: A subtitle of the cash tab's own, which D13 does not enumerate?

**Decision taken:** added `open.subtitleCash` (and `open.loadingCash`).
**Why:** the standing subtitle reads *"Every entry the estate still has open, oldest first"*, which
is false of a shelf of prepared receipts and states the wrong age. D13 lists the copy the tab's rows
need; the standfirst above them was written before there was a third tab to stand above.
**Revisit if:** the owner wants one standfirst for all three — then it must stop naming *entries*.

## Q: The projection — copy 285's sectioning for the cash rows, or generalise it?

**Decision taken:** generalised. `arrange()` is generic over an `OpenLaneRowFacts` row
(`isMine` / `servedBy` / `ageDays`) and both `buildOpenLane` and `buildCashLane` call it;
`LaneBody` and `Section` are generic the same way.
**Why:** the ticket says the tab reuses 285's projection and grid *with three substitutions and
nothing else*. A second copy would be a second place the *empty ≠ emptied-by-filter ≠ failed*
vocabulary could collapse, and a second chance for one tab to start hiding the estate.
**Revisit if:** the two lanes' arrangements ever genuinely diverge (287's chase column does not
— it is a column).
