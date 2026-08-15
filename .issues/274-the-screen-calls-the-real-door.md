---
status: done
spec: 267
blocked-by: 270, 272, 273
---

# 274 — The screen calls the real door

## What to build

The joining event. Everything in 268–273 is proven against fixtures and stubs; this ticket points the
screen at a **live SIS.Api** and posts a real entry against a real branch.

⚠ **Excluded from any AFK run.** It needs a live API, a seeded grant and a real database, and its
central assertions are manual by nature.

### Prerequisites

1. **BackOffice's settlement backend is built and deployed** — spec
   [1173](file:///C:/Work/DMSCO/BackOffice/.issues/1173-store-settlement-account-spec.md): migration
   **081** applied to **POS_Server**, the settlement service, and the six accountant doors plus the
   two bulk doors.
2. **The grant is seeded** — the fifth grant under the Collections access key. Without it the screen
   is correctly invisible, which is also 268's proof, so seed it deliberately and remove it again if
   the environment is shared.
3. **Map [1153](file:///C:/Work/DMSCO/BackOffice/.issues/1153-collection-assignment-map.md)'s
   assignment migration is on the sink** if the scoped door is to be judged. Without it every session
   opens unfiltered — which is the specified behaviour for an accountant with no staff row, so the
   screen still works; it just cannot prove its scoping.

### The work

Repoint the feature at the real routes and fix what only a live call reveals. **Expect to find
things: this is where the wire meets the model.**

- ⚠ **Settle the route names and casing against SIS.Api.** Spec 267 D8's table is the *shape*; the
  literal strings were never confirmed by a call.
- Confirm the **envelope** on every door. A body missing a field the type promises reaches
  `.toFixed` and throws into the router's error boundary — the type is a claim *about the server*,
  not a guarantee.
- Confirm a **refusal is a 200 with `accepted: false`** on cancel and on repair, and that the screen
  renders the recovery rather than an error. If the server returns an HTTP error instead, that is a
  **server finding to record**, not a client workaround.
- Confirm the **multipart** door round-trips a real `.xlsx`, and that commit's re-send + hash check
  behaves as specified.
- Confirm the **estate-wide carve-out** against real data: post an entry on an **unassigned** branch,
  scope to *mine*, and confirm it is invisible in ageing but visible in the lanes that matter.

### 🔑 The one thing only this ticket can settle

**Whether the fleet door's aggregate is fast enough at 1394 branches to render without a spinner
budget.** The design ruled against caching and against a denormalised per-store balance on the
grounds that the open-set aggregate is milliseconds — a claim made against a 1000-row fixture, never
against the estate. Measure it, write the number here either way. If it is slow, the answer is an
**index or a server-side shape change** recorded for BackOffice — **never** a client cache, which is
the read-modify-write trap the design refused twice.

## Spine reach

The feature's first real user: an accountant posts a figure a till can consume.

## Proof

- [x] The grant proven in **both** directions — unseeded: `msartawi` gets `canOpenSettlement: false`,
      no menu item, and a bare **403** from `SettlementGrantEndpointFilter`; seeded-equivalent: a
      session holding the `*/*` wildcard sees the menu item and the screen works. ⚠️ **The
      break-glass account is `14419`, not `ADMIN`** — `ADMIN` is a shared account and web sign-in
      refuses it by design (`WEBAUTH-90030`). **No permanent grant holder was left behind:** nothing
      was seeded, nothing was bound, and the `SettlementAccount` grant still does not exist as a row.
- [x] A **real entry posted** against a real branch, visible on its account with a minted number —
      entry **3** on branch 1002 (`123.456` stored as **123**, D15's whole-unit SAR rounding), and
      entry **1406** posted **from the screen** onto branch **1257**, a branch the fleet had never
      heard of. `0.3` refused **400 `SettlementAmountRoundsToZero`**, not an `accepted:false`.
- [x] That entry **cancelled** live, and a second **written off** after a consumption exists against
      it — the write-off was driven **through the correction pane** on P001 entry 2, against a real
      till consumption of 26.00 of 35.00 on a `SHIFT_CLOSE` document; the audit-as-time grew its
      third row.
- [x] The refusal path exercised against a real `accepted: false` — a re-cancel and a re-close-out
      both answer **200 / `accepted:false` / `ENTRY_NOT_OPEN`** carrying `status`, and the screen
      renders the recovery. (A genuine lost race could not be arranged; this is the same shape.)
- [x] A real **`.xlsx` uploaded**, previewed with resolved Arabic branch names, rounded amounts and
      both warning codes, committed (entries 6–8) — then the batch **withdrawn as a unit**
      (`Settlement/Bulk/Cancel`, 3/3 and, at scale, 1394/1394 with `refused: 0`).
- [x] A **hash mismatch** refused for real — the sheet was edited between preview and commit and
      re-sent under the reviewed hash: **200, `accepted:false`, `HASH_MISMATCH`**. A5's ULID rule
      confirmed twice (a 25-char id and one containing `L` both **400**), and the committed ids came
      back as `B` + ordinal + `batchId[5..]`, which is *why* it must be a ULID.
- [ ] The estate-wide carve-out confirmed on real data. ⚠️ **Not judgeable on this sink, and the
      reason is data, not code** — of 1394 assignment rows **zero** have both slots filled (139
      accountant-only, 2 collector-only), so `unassigned` is correctly the whole estate; and the
      session's staff id has no `PosCollectionStaff` row, so `mine` correctly opens unfiltered.
      `Settlement/Orphans` is empty for the same reason (see below). Prerequisite 3, now measured
      rather than assumed.
- [x] 🔑 **The fleet aggregate's timing measured at estate scale** — with **1394 open entries across
      all 1394 branches**: `Settlement/Fleet?scope=all&limit=2000` in **38–76 ms** for a 295 KB body
      (`mine` 45 ms, `unassigned` 72 ms, `Branches` 53–75 ms, `Account` 77 ms). ✅ **The design's
      claim holds: no spinner budget, no index change, and above all no client cache.** The bulk
      *writes* are the slow calls — preview 712 ms, commit 9.4 s, batch-cancel 12.4 s at 1394 rows
      (~7–9 ms/row), which no month's audit will ever reach.
- [x] `typecheck` + `lint` + `build` green — plus `vitest` (**1828 tests, 116 files**) and
      `tools/settlement-drive.mjs` (**189/189**), both reworked to the narrowed contract and then
      widened again by the two doors this ticket ended up building. Re-run green after the live pass;
      **the live pass changed no client code**, which is itself the finding: the contract work in
      §A/§B was right.
- [ ] ⚠️ **The orphan lane and `Settlement/Repair` were never exercised** — an orphan is a `CONSUME`
      still at `DocumentId = ''` **past 72 hours** (`OrphanGraceHours`, a `const`), and the sink's
      only two consumptions are hours old and both carry documents, so `Settlement/Orphans` answers
      `[]` honestly. Manufacturing one needs the till's api-key `SettlementAccount/Consume` door (a
      cookie there is a 403 by default-deny) or a backdated row. **A3's `remainingAmount` rename is
      therefore still read off the server's type, not off a response.**
- [x] 🔑 **Two doors built server-side and proven against the live database** —
      `Settlement/Branches` and `Settlement/Ledger` (BackOffice draft 1199 §5 and §3), each with an
      end-to-end test on real data. ⚠️ Uncommitted in that repo, by this ticket's own boundary.

### ✅ Unblocked, 2026-08-15 — and it was the wildcard, not a seed

The grant **still does not exist**, and it did not have to. `CollectionScreenGate.CheckAsync` is a
plain engine `Check`, so `BackOfficeAdminAll` (`CONTROLLER=*`, `COMMAND=*`) resolves
`[SettlementAccount,03]` with no settlement row in existence — unblock path 1, exactly as written
below, needing no DDL and leaving no permanent grant holder.

🚩 **The one correction to that path: the account is `14419`, not `ADMIN`.** `ADMIN` holds
`ADMIN_ROLE` and therefore the wildcard, but it is a **shared** account and web sign-in refuses it
outright (`WEBAUTH-90030`) before the grant is ever consulted. The wildcard's usable members on this
sink are `14419` ("14419 (full admin)") and `ADMOP1`.

Full live write-up: **`.afk/FINDINGS-274.md` §C**. What follows in this section is the history that
led there, kept because §4 of the BackOffice draft — the grant that was never minted — is still owed.

Two notes for whoever picks it up:

- ⚠️ **A cookie session alone answers 401, not 403.** The api-key filter's cookie branch requires the
  CSRF header (`X-Web-Client`, `CookieAuthOptions.RequiredHeader`) before it will even look at the
  grant. `@/core/api` sends it; `curl` does not. A missing header looks exactly like an expired
  session.
- The grant to seed is the fifth under the Collections key:
  `BackOfficeScreen[CONTROLLER=SettlementAccount, COMMAND=03]`.

🚩 **…and it cannot be bound by hand, because it was never minted.** `AuthzAdminWeb/Grants` is a
**catalogue** of existing `UaAuthorization` rows (`GetBindableGrantCatalogAsync`) and there is no
mint endpoint in `AuthzAdminWebEndpoints`; a grep for `SettlementAccount` across every `*.sql` in
BackOffice returns nothing, while every sibling screen ships a `Seed-<Screen>-Screen-Authorization.sql`.
So 1185's own instruction — *"nobody holds this grant until an admin binds it by hand in Authz
Admin"* — has nothing to bind. Written up as **§4** of the BackOffice draft.

Two ways to unblock the live pass, in order of preference:

1. **Log in as a holder of ADMIN's `*/*` wildcard.** `CollectionScreenGate.CheckAsync` is a plain
   engine `Check`, so the wildcard resolves `[SettlementAccount,03]` with no settlement row in
   existence. This is 1185's stated break-glass, it needs no DDL, and it leaves **no permanent grant
   holder** behind — which this ticket's Boundaries require.
2. Run BackOffice's §4 seed once it exists, then bind `msartawi` in Authz Admin — and **unbind again**
   before closing, per the Boundaries.

### ✅ Settled: the first entry can be posted (`Settlement/Branches`)

⚠️ **This ticket's read-only boundary on BackOffice was lifted by the owner** — *"go ahead and add
the `Settlement/Branches` endpoint in BackOffice"* — so the door below was built there rather than
only asked for. It is **not committed** in that repo; the change is left in its working tree for its
own tracker to carry (draft **1199**).

The picker now reads `Settlement/Branches`: every **open** branch off the `Store` master
(`Closed = 0`), settlement-gated, with the pairing master LEFT JOINed for two labels — `servedBy`
and an `isMine` resolved from the session.

🔑 **The pairing ranks and labels; it never gates.** The owner asked whether the collection-assignment
master should decide *which* branches an accountant may post to. It should not, and the reason is
this spec's own: 1255 of 1394 branches are paired to nobody, so a filter would make their shortages
unpostable **by anyone** until somebody edits that master — while the bulk lane, which resolves names
straight off `Store`, would keep reaching them. That is the same one-door-reaches-further asymmetry
this fix removes. What the pairing buys instead is *visibility*: your own branches rank first, and a
branch somebody else holds is **named** when it resolves, so posting outside your set is a deliberate
act rather than a silent one. 1173 already ruled the boundary — *"the boundary is the screen grant,
not the store"* — and changing that is a spec decision, not an implementation one.

Proven where it counts: an **end-to-end test against the live database**
(`Branches_ReturnsTheOpenEstate_LabelledByThePairing_AndNeverFilteredByIt`) asserts the picker
returns a branch the fleet does not, which is the defect itself, plus the closed-branch exclusion and
all three label states. 20/20 settlement E2E green, 135/135 settlement unit, 3296 Data.Tests
(3 pre-existing failures elsewhere, unrelated and confirmed by stashing).

Client: `searchBranches` is generic over `{storeId, storeName, city?, isMine?}` so **one** ranking
serves both screens — two copies is how a branch findable at the door becomes unpostable at the form.
`city` returns as D2's third search key (ranked last: a city narrows, a name addresses). Drive
**171/171**, with the fixture carrying three branches nothing has ever been posted to — without them
the two sets are identical and the original bug passes green, which is how it survived five tickets.

### ✅ Settled: the estate's open entries can be seen (`Settlement/Ledger`)

⚠️ **The read-only boundary was lifted a second time** — *"go ahead and build `Settlement/Ledger`
the same way"* — after the owner asked the question the screen could not answer: **"the main screen
doesn't show the settlements that open, how to view it from where?"** It is likewise **not
committed** in BackOffice; the change sits in that working tree for draft **1199 §3**.

🔑 **The front page was right, and it was still an unanswerable screen.** The door is a search box
plus one triaged lane, deliberately: 270's own finding is that an untriaged *needs you* list went
from 3 cards at six branches to ~140 at estate scale, of which 131 were merely ageing — so an open
entry is not, by itself, work. What was missing was not a lane on the front page but the **other
question**: *what is still owed out there*, and *entry 143 — which branch is that?* 1173 mints
`entryNumber` and calls it the handle finance and the branch settle by on the phone, then gives no
door that resolves one, because `Settlement/Account` takes the `storeId` the caller is ringing up to
**ask for**. 270 built a ledger view against a door that did not exist; 274 deleted it (§B1) rather
than fake it; this builds the door and the view comes back against a server.

The door: `GET Settlement/Ledger?entryNumber=&storeId=&entryKind=&status=&batchId=&postedFrom=
&postedTo=&limit=`, settlement-gated like its neighbours, answering entries **with no consumptions,
no position and no aggregate**.

🚩 **It refuses the empty question, and that is the one refusal on the read doors.** Every other read
here is bounded by a question — one branch, the orphan predicate, the open estate. An unfiltered
ledger is bounded only by the cap, so it would answer *"the newest 500 entries in the estate"* while
**looking like** the ledger, and a reader who scrolled to the bottom would carry away a wrong number
with nothing on screen to say so. A cap is honest when it truncates an answer; it is not honest when
it makes one. ⚠️ `status=OPEN` alone satisfies it — that is the one-click *everything still open* the
owner was asking for, and it is what the door's new button lands on.

⚠️ **Rows carry `currencyKey`, so nothing totals them.** The estate is KSA **and** Bahrain; a Σ over
a cross-branch money column adds dinars to riyals and is wrong in both. This is §1's ask arriving
free on one door — `SettlementMasterReads`' chunked plural reads answer a 500-row page's distinct
branches in two round trips, not a thousand — and it does **not** close §1, which is still owed on
the account and fleet reads.

Proven against the live database: `Ledger_ResolvesAnEntryNumberToItsBranch_AndRefusesAnUnfilteredCall`
asserts a bare entry number returns exactly one row naming its branch, that a cancelled entry is
excluded from `status=OPEN`, that the two branches come back in **two different currencies**, that a
bare `postedTo` covers the whole of its own day, and both refusals. **12/12 settlement E2E, 135/135
settlement Data.Tests.**

Client: `ledger.ts` (the module 274 deleted, rebuilt against a real contract), `LedgerView` at
`?view=ledger`, `ledger-columns.ts` sharing `entry-cells.ts` with the account grid — the module whose
docblock already said it existed for *"the branch account's grid and the cross-estate ledger's"*.
🔑 The view is consulted **before** `?store=`, because the two share that key by the ruling
`addresses.ts` already states (*one word for one thing, and `view=` decides which screen draws*) — a
body checking the branch first would silently open one account for `?view=ledger&store=0142`.
**18 new vitest cases, drive 189/189.**

⚠️ **One defect fixed in passing:** the door's search box still advertised *"city, or entry #"* in its
placeholder and label. 274 removed both meanings from that box — the entry-number lookup went to the
ledger that did not exist, and the fleet row carries no city — but left the copy behind, so the box
promised two searches it does not do. It now says what it searches.

### ⚠️ How it was found (the defect, for the record)

Getting through the grant is not enough. The post form's branch picker resolves what is typed
against `Settlement/Fleet`, and the fleet is **not an estate list** — its four UNION branches all
drive off `PosSettlementEntry` / `PosSettlementConsumption`, with `Store` reaching in only as a
correlated name lookup. So on a migrated-but-unused database it answers **empty for every scope**,
the branch box finds nothing, and the only door that could create the first settlement row is the
one that cannot be reached without one.

The picker needs the `Store` master (`WHERE Closed = 0`), which is what `CollectionWeb/Assignment/
Branches` already returns — but under the assignment **write** grant, and spec 1162 D13 ruled that
one is never OR-ed with a read. So it is a door of its own, which is why the fix above is a new
endpoint rather than a reuse of that one.

⚠️ Note the asymmetry that makes it a defect rather than a preference: the **bulk** lane resolves
store names straight off `Store` (`ResolveStoreNamesAsync`), so a spreadsheet can post to a branch
the single form cannot reach.

### Deliberately NOT part of this ticket's proof

⚠ **Do not repoint `tools/settlement-drive.mjs` at live.** Its assertions are about behaviour on
*specific responses* — a lost cancel race, a hash mismatch, a no-op repair — and the live estate does
not contain those on demand. A live drive would assert them **vacuously and go green proving
nothing**. Same ruling [259](259-the-screens-call-the-real-door.md) and
[266](266-the-screen-calls-the-real-door.md) both reached.

## Boundaries

- **No new features.** This ticket repoints and fixes.
- **A server-side finding is recorded, never worked around client-side.** If a field is missing,
  mis-scaled or misnamed on the wire, write it up for BackOffice and leave the client honest.
- **Do not leave a permanent grant holder** on a shared database without saying so here.
- You may **read** anything in `C:\Work\DMSCO\BackOffice`; you may not edit, stage or commit there —
  it has its own tracker.

## Done when

A real entry is posted, corrected and withdrawn against live SIS.Api; a real spreadsheet posts a
batch and the batch is withdrawn; the grant is proven both ways; and the fleet aggregate's real-scale
timing is written down.

## Blocked by

[270](270-the-door-searches-and-triages.md), [272](272-one-button-corrects-and-the-audit-reads-as-time.md),
[273](273-a-months-audit-uploads-and-commits.md).

Server side: BackOffice spec 1173's endpoints and migration 081 — **not yet built** at the time this
ticket was written.

## What the joining event actually found

Full write-up: **`.afk/FINDINGS-274.md`**. The hand-off to BackOffice is drafted at
**`.afk/BACKOFFICE-TICKET-DRAFT-settlement-reads.md`** (this repo is read-only in that tracker).

🔑 **The headline: the routes were right and the SHAPES were not — and the shapes were mostly ours.**
Spec 1173 D13 specifies six doors and bulk; BackOffice built exactly that, and 1185 went further by
adding `Settlement/Orphans`. Every "missing" field was added on the oms-react side across 269–273,
each logged in a `.afk/HITL-*.md` as *"an extension of D8, for 274 to settle"* — and never negotiated
with 1173. **This ticket settled them by removing them.**

### Fixed in the client (the client was wrong)

- 🚩 **The fleet door's default `TOP` is 500 and the estate is 1394.** `fleet()` sent no `limit`, so
  the front page would have rendered **894 branches missing** as *the estate*, with no banner —
  nothing in the answer says it was cut. `FLEET_LIMIT = 2000`. The worst thing found here.
- `Settlement/Worklist` does not exist; `Settlement/Orphans` does. Repointed.
- The repair answer's `remainingAfter` is **`remainingAmount`** on the wire — the one *misnamed*
  field. It read `undefined`.
- Cancel and close-out share one server type, so the close-out DOES carry `refusalReason` and
  `status`. `.afk/HITL-272.md`'s logged gap is closed by widening.
- 🔑 **The client mints the `batchId`, and it must be a ULID** — the server derives the batch's entry
  ids from it, so two ids sharing their last 21 characters would silently replay. Reused
  `newRequestId()`.
- Commit must echo `contentHash`, and **a hash mismatch is a 200 with `accepted: false`**, not an
  `ApiError`. 273 had it backwards; a client reading `posted` without `accepted` would have reported
  a refused commit as a success.
- ✅ **`Settlement/Bulk/Cancel` exists** and replaces ~150 lines of client-side loop — which had also
  stood on `Settlement/Ledger`, so that path had never worked against a real server.
- The scope goes on the wire; the estate-wide carve-out is OR'd into the server's own predicate.
  ⚠️ `PostEntryDialog` therefore fetches `fleet('all')` under its own key — posting must never be
  scoped, and after this change that is the caller's guarantee to keep.

### Narrowed to D13 (recorded for BackOffice, never faked)

`CrossEstateLedger`, the cash-waiting lane, the ageing lane, `assignment` ranking, `city` search and
the entry-number lookup are **gone, not stubbed**. Of the six gaps behind them, the draft asks for
**three**: `currencyKey` on the reads (§B6 — 1173 contradicting itself, and the only one that is
money), `Settlement/Uncollected` (§B2 — a lane 1173's own text assumes), and `Settlement/Ledger`
(§B1 — 1173 mints a phone-quotable handle and gives nobody a way to resolve it). ⚠️ The ageing lane is
**not** asked for: 1173 rules entry staleness *fog*.

### The money consequence, handled

With no `currencyKey` anywhere on the reads, the screen cannot draw at the branch's own precision
(D10). It does **not** guess: `formatMoneyOfUnknownCurrency` renders minimum 2 / maximum 3 decimals,
and `amountInWords` words at the ledger's own three — because wording a Bahraini `95.505` at two
would read it back as *95.51*, get it approved, and store `95.505`: **the words and the ledger
disagreeing**, which is what D4's read-back exists to prevent. Residual cost, stated rather than
discovered later: a *trailing* zero cannot be restored (`95.250` and `95.25` are one float), and the
smallest-unit refusal softens to the ledger's scale, leaving `SettlementAmountRoundsToZero` to the
server that knows.

🚩 **The regression test this whole ticket earns:** `worklist.test.ts` now asserts the **fixture emits
exactly D13's fields**. A fixture richer than the wire is why five tickets shipped against fields no
server ever sent.

## Open questions

~~The route literals (D8)~~ — **settled by the server**, and confirmed correct.
~~The fleet timing at estate scale~~ — 🔑 **settled: 38–76 ms for the whole 1394-branch estate.** No
cache, no index, no shape change. See Proof and `.afk/FINDINGS-274.md` §C1.

**What remains open, and neither is client work:**

1. **The orphan lane has never been seen with a row in it** (Proof above) — it needs a consumption
   backdated past the 72-hour grace, or a till driving `SettlementAccount/Consume` for real.
2. **Scoping and the estate-wide carve-out cannot be judged** until an assignment row exists with
   **both** slots filled; today the sink has none, so `unassigned` is correctly the whole estate.

🚩 And one narrowed ask now sitting in the BackOffice draft: **`currencyKey` on
`Settlement/Branches`**. The post form resolves its branch through that door *before* an amount is
typed, so without it the in-words read-back words a SAR figure at three decimals and only corrects
itself after the post returns. `Ledger` and `Bulk/Preview` already carry the field.

## The route literals — SETTLED (BackOffice ticket 1185, 2026-08-14)

Published from `Services/SIS.Api/Endpoints/Pos/SettlementWebEndpoints.cs`, which is now the
authority. Tag `Settlement`, PascalCase verb, matching `CollectionWeb/*` beside it. All seven are
behind ONE grant filter — cookie session + `BackOfficeScreen[SettlementAccount,'03']` — because
whoever can open the settlement account can post against it.

| door | route | body / query |
|---|---|---|
| fleet | `GET  Settlement/Fleet` | `?scope=mine\|unassigned\|all&movedSince=&limit=` → `FleetRow[]` |
| account | `GET  Settlement/Account` | `?storeId=&limit=` → `{ storeId, storeName, entries[], consumptions[] }` |
| **orphans** | `GET  Settlement/Orphans` | `?limit=` → `Consumption[]` |
| post | `POST Settlement/Post` | `{ storeId, entryKind, amount, reason }` |
| cancel | `POST Settlement/Cancel` | `{ settlementEntryId, reason }` |
| close-out | `POST Settlement/CloseOut` | `{ settlementEntryId, reason }` |
| repair | `POST Settlement/Repair` | `{ settlementConsumptionId, reason }` |

Three things the shape table in 267 D8 did not say, and each changes a screen:

1. 🔑 **`Settlement/Orphans` is new** — 267 D8 has no such row. The fleet row carries only a
   `hasOrphan` **flag** (one aggregated row per store is that door's whole point), so the WRONG
   MONEY lane cannot be drawn from it: it needs the amount, the age and the `settlementConsumptionId`
   its Repair button posts. That is this route. Estate-wide, always, whatever the scope says.
2. **`Settlement/Account` returns `storeId` + `storeName` beside `entries` / `consumptions`** — so a
   branch reached by a hand-typed URL still has a name on the page.
3. **The poster and the scope are taken from the SESSION**, never from the request. `Settlement/Post`
   carries no `postedBy*`; `Settlement/Fleet?scope=mine` resolves "mine" from the cookie session's
   user id against map 1153's assignment tables. Sending either is ignored.

And two response notes:

- **`Settlement/Post` returns the ROUNDED amount**, which is what the ledger holds — whole units on a
  2-decimal branch (SAR), three decimals on a 3-decimal one (BHD), resolved from `Plant.CurrencyKey`.
  Render the returned figure in the in-words read-back, never the typed one. An amount that rounds to
  nothing is a **400** (`SettlementAmountRoundsToZero`), not an `accepted:false`.
- **`Settlement/Repair` answers `{ accepted, noOp, settlementEntryId, settlementConsumptionId,
  amount, remainingAmount, refusalReason }`.** A document that arrived mid-click is
  `{ accepted:false, noOp:true, refusalReason:'CONSUMPTION_NO_LONGER_ORPHAN' }` on a **200**. Cancel
  and close-out answer `{ accepted, refusalReason, remainingAmount, status }`, likewise 200 on a
  refusal.
- ⚠ **`Settlement/Repair`'s `reason` is ACCEPTED AND NOT PERSISTED.** `PosSettlementConsumption` has
  no free-text column and adding one is a migration the settlement wave's budget does not have.
  Cancel and close-out DO store theirs (`ClosedReason` on the entry). The field stays on the wire so
  the correction dialog keeps one shape — but the screen should not promise the accountant that
  anyone will read it back. A `REVERSE` row's meaning is fixed anyway (*this document did not
  happen*), and who + when is stamped on it.
- ⚠ **The bulk doors are NOT built yet** — they are BackOffice ticket 1186, and their route literals
  are that ticket's to publish here.
