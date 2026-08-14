---
status: open
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

- [ ] The grant proven in **both** directions — unseeded: no menu item, route refused; seeded: the
      screen works. **HALF DONE, live:** unseeded is proven — `CollectionWeb/Access` answers
      `canOpenSettlement: false` and `Settlement/Fleet` answers a bare **403** from
      `SettlementGrantEndpointFilter`. The seeded direction is blocked (see below).
- [ ] A **real entry posted** against a real branch, visible on its account with a minted number.
- [ ] That entry **cancelled** live, and a second one **written off** after a consumption exists
      against it (a till close or a hand-inserted consumption row).
- [ ] A cancel that **loses the race** observed live if it can be arranged; otherwise the refusal
      path is exercised against a real `accepted: false`.
- [ ] A real **`.xlsx` uploaded**, previewed with resolved branch names, and committed — then the
      batch withdrawn as a unit.
- [ ] A **hash mismatch** refused for real (edit the sheet between preview and commit).
- [ ] The estate-wide carve-out confirmed on real data (above).
- [ ] 🔑 **The fleet aggregate's timing measured at estate scale and written into this ticket.**
- [x] `typecheck` + `lint` green — plus `vitest` (1805 tests, 115 files) and
      `tools/settlement-drive.mjs` (**164/164**), both reworked to the narrowed contract.

### ⚠️ Blocked: the grant was never seeded

Everything above the line is **contract work done against the source of a running SIS.Api**; nothing
below it has been driven, because `canOpenSettlement` stayed `false` for the whole session and
`msartawi` cannot self-serve it (`AuthzAdminWeb/Access` → `screenAllowed: false`). The ticket stays
**open** on those bullets.

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
🔑 **The fleet timing at estate scale is still unsettled**, and now needs the grant before it can be:
the door is 403 without it. See the blocked Proof above.

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
