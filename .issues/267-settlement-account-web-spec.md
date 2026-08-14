---
type: spec
status: ready
---

# 267 — The accountant's settlement account — spec

> **The frontend half.** The server half is BackOffice spec
> [1173](file:///C:/Work/DMSCO/BackOffice/.issues/1173-store-settlement-account-spec.md) (wayfinder
> map [1142](file:///C:/Work/DMSCO/BackOffice/.issues/1142-store-settlement-account-map.md)), whose
> *Out of Scope* hands this repo the accountant's screen and nothing above the endpoints.
>
> **The design is already decided and prototyped.** BackOffice ticket
> [1147](file:///C:/Work/DMSCO/BackOffice/.issues/1147-the-accountants-screen.md) rebuilt a spike at
> estate scale and the owner clicked through it on 2026-08-13, ruling the layout, the scoping, the
> posting guard, the correction interaction and the audit pane. The spike is at
> `C:\Work\DMSCO\BackOffice\.scratch\proto\settlement-accountant-screen\` on branch
> `proto/1147-accountant-screen` — one static `index.html`, no build. **`fake.js` is the read model
> this screen binds.**
>
> ⚠ **That spike is not this repo's code and must not be pasted in.** Its tokens were copied *from*
> `src/app/global.css`; the winner is rebuilt here, under this repo's rules and lint gates.

## Problem Statement

An accountant at head office decides that a branch owes money (**عجز**, a shortage found months
later) or may keep money back (**فائض / مرتجع الشبكة**, cash the branch paid out refunding a card
sale). The server can now hold that decision as a per-store ledger, and a till can consume it at a
shift close or through a special receipt the branch prepares.

**Nothing writes into that ledger, and nothing reads it back.** The endpoints have no caller. Without
this screen the whole feature is a database an accountant cannot reach: entries cannot be posted, a
branch's position cannot be seen, a mis-posted entry cannot be corrected, and money a till consumed
onto a close that never completed sits in a table nobody opens.

Two things make this more than a CRUD form, and both were found by rebuilding the prototype at real
estate size:

1. **Nobody browses 1394 branches.** A master–detail branch list is the obvious design and it fails —
   not slowly, but as a way of *finding* anything. An accountant arrives with a **branch** in mind (a
   phone call against an entry number) or with **work** in mind (what moved last night, what is
   stuck), never with a list in mind.
2. **An untriaged "needs you" list is just another list.** The prototype proved it by failing: at
   scale it rendered ~140 cards, of which the four that were actually *wrong* — a consumption with no
   document behind it — sank into 131 that were merely ageing.

## Solution

One feature in the existing **collection** area, beside the four shipped inquiries:

```
src/features/collection/settlement/     →  /collection/settlement
```

Not a new area: same nav group, same URL prefix, and the same access key the Collections group
already probes — the settlement account is a **fifth grant** under it.

**The door is a search box and a triaged worklist. The branch account is the destination.**

```
┌ Settlement account ───────────────────── [ my branches ▾ ] ─┐
│  🔍 branch code, name (either script), city, or entry #     │
├─────────────────────────────────────────────────────────────┤
│  WRONG MONEY            (estate-wide, always)               │
│   · 0331  consumption 4,300.000 with no document — 4 days   │
│           [ Repair ]                                        │
│  CASH WAITING           (estate-wide, always)               │
│   · 0455  receipt #212 prepared 3 days ago, uncollected     │
│  AGEING                 (my branches)                       │
│   · 47 entries open longer than 30 days      [ open ledger ]│
└─────────────────────────────────────────────────────────────┘
```

Triaged **by what it costs**: wrong money first and enumerated in full because it is rare; cash
waiting next; ageing reduced to a **count and a way through**, never a card each.

The **branch account** is where the accountant lands from a search hit or a worklist row: the signed
headline, its two magnitudes, every entry open and closed, and each entry's journal of consumptions.
It is structurally `CashCollectionsPage`, so it costs the accountant no new habit.

Posting is **one form with a kind toggle** — never two forms, because two would make the kind a
navigation choice taken before the accountant has the figures in front of them. The typo guard is a
**review step that reads the amount back in words**, never a numeric cap. A month's audit arrives as
the **spreadsheet finance already produces**, through a second door whose guard is a preview grid
resolving every store code to a branch name plus the file's total in words.

## User Stories

1. As an accountant, I want the Settlement group to appear only when my session is granted it, so that a screen I cannot use is not on my menu.
2. As an accountant, I want to search a branch by code, by name in either script, or by city, so that I reach an account the way I actually know the branch.
3. As an accountant, I want to search by entry number, so that a phone call quoting "entry 143" lands me on the right entry whichever branch it is on.
4. As an accountant, I want the screen to open on my branches, so that the estate does not bury the ones I am responsible for.
5. As an accountant supervising others, I want my reports' branches included, so that I do not open an empty screen.
6. As an accountant with no assignment row, I want the screen to open unfiltered rather than empty, so that a missing seed never blocks me and is never announced as an error.
7. As an accountant, I want to widen to the whole estate in one click and never be locked out of it, so that scoping is a convenience and never a permission.
8. As an accountant, I want wrong money and waiting cash shown estate-wide regardless of my scope, so that the 1255 unassigned branches' money is not on nobody's screen.
9. As an accountant, I want a worklist grouped by what it costs rather than a flat list, so that four real problems are not buried under 131 ageing ones.
10. As an accountant, I want a branch's whole position in one frame — signed headline, both magnitudes, every entry — so that a call with that branch has one shared picture.
11. As an accountant, I want each entry's journal of consumptions with what each one left behind, so that I can answer "was my 500 used?" without reading Z reports.
12. As an accountant, I want a consumption with no document named in words on its row, so that a real repair item is never an empty cell I skim past.
13. As an accountant, I want reversals rendered as restorations rather than spends, so that a repaired entry reads as repaired.
14. As an accountant, I want one posting form with a kind toggle that states the consequence in plain words, so that I choose "the branch must hand this over" rather than a word.
15. As an accountant, I want the branch typed and resolved to exactly one match before I can post, so that a thousand-option dropdown never picks the wrong branch for me.
16. As an accountant, I want the resolved branch's standing open position of the same kind shown before I commit, so that a monthly audit does not repost a shortage the branch already carries.
17. As an accountant, I want the amount read back grouped and in words before I commit, so that fifty thousand is a different sentence from five hundred.
18. As an accountant, I want to see what the branch will read, in the branch's own words, so that I remember the reason is a message a manager reads at a till at 23:00.
19. As an accountant, I want the commit to tell me the amount cannot be changed afterwards, so that immutability is a thing I chose rather than discovered.
20. As an accountant, I want one correction button whose meaning the entry decides, so that a menu offering both never lets me cancel a consumed entry.
21. As an accountant, I want to be told why an entry cannot be cancelled, so that "write off the remaining 400" is an answer rather than a missing button.
22. As an accountant, I want a cancel that lost a race to come back with the new remaining and offer the write-off, so that a till consuming a millisecond earlier is not an error I have to interpret.
23. As an accountant, I want the journal to stay on screen under the correction, so that I can see what a write-off does not touch.
24. As an accountant, I want an audit pane showing posting, consumption, void and correction as one column of time, so that a branch's history reads as a single story.
25. As an accountant, I want to repair an orphan consumption from the worklist, so that money a branch handed over because a close failed goes back onto its entry.
26. As an accountant, I want a repair whose document arrived mid-click to do nothing rather than fail, so that a late sync is not an error message.
27. As an accountant, I want to upload finance's monthly audit sheet, so that forty shortages do not cost forty forms.
28. As an accountant, I want every uploaded row previewed with its store code resolved to a branch name, so that the right amount on the wrong branch is caught before it is money.
29. As an accountant, I want the file's total read back in words at the commit, so that one fat-fingered row is visible in the sentence.
30. As an accountant, I want a file with any bad row refused entirely, so that I never reconcile a half-posted file against my own sheet.
31. As an accountant, I want duplicate-looking rows to warn rather than refuse, so that a genuine second shortage months later is still postable.
32. As an accountant, I want to be told when a file with these same rows was posted minutes ago, so that a second tab does not double a month's audit.
33. As an accountant, I want one kind per file, so that a total in words means something.
34. As an accountant, I want an uploaded batch cancellable as one act, reporting which rows a till already consumed, so that "finance sent the wrong file" is one repair.
35. As an accountant, I want money rendered to the branch's own currency precision, so that a Bahraini branch's fils are not rounded away on screen.

## Implementation Decisions

### D1 — Feature, area, route, gate

`src/features/collection/settlement/` behind **`/collection/settlement`**, one menu item in the
existing Collections group with an `accessProbe`. Not a new area — the `feature-structure` rule opens
one only when a new nav group *and* URL prefix appear, and neither does.

**The gate is the screen grant, and it is the only off-switch** — the pattern
[253](253-the-collections-group-appears-only-for-a-granted-session.md) set: the group and the route
are hidden and refused on an ungranted session, and there is **no feature flag**. The settlement
account is a **fifth grant probed under the Collections access key** (BackOffice
[443](file:///C:/Work/DMSCO/BackOffice/.issues/443-web-screen-gate-new-engine-443.md) — always the new
authz engine, never a legacy table).

⚠ **`ScreenGate` lives in `features/collection/inquiry/` and features never import features.** Copy
its shape, as 254/255 copied the grid template — or, if a second copy is one too many, graduate it to
`@/core/ui`. That is a build-time call for the first ticket, made once and written down, not a
per-screen decision.

### D2 — The door, and its scoping

**Search + triaged worklist is the front page; the branch account is the destination.** The rejected
design (master–detail over the branch list) is kept in the spike only as the argument against it.

Scope control with three states — **my branches** (default), **unassigned**, **all** — resolved from
the assignment tables map
[1153](file:///C:/Work/DMSCO/BackOffice/.issues/1153-collection-assignment-map.md) owns and the four
collection inquiries already read. "Mine" is the **union of own branches + one-level reports**. An
accountant with no staff row opens **unfiltered** — not an error state, and the screen must not
announce it as one. Widening is **never locked**.

🔑 **The wrong-money and cash-waiting lanes are ALWAYS estate-wide, whatever the scope says.** 1255
of 1394 branches are unassigned; under a naive "mine" scope their money is on nobody's screen. Only
the **ageing count and the search ranking** honour the scope. This asymmetry is deliberate and is the
first thing to break if someone "tidies" the scope handling.

Worklist grouping, in this order: **wrong money** (orphan consumptions, enumerated in full, each with
a Repair action), **cash waiting** (prepared-uncollected receipts, showing **age** — they never
expire and are never auto-voided, so age is the only thing this screen owes), **ageing** (a count and
a link into the ledger, never a card each).

**The flat cross-estate ledger keeps its place** as a support/lookup view — capped, paged,
filter-first — answering *"find entry #143, whichever branch it is on"*. It is not the account: it
can only assert a total nobody owes and nobody consumes.

**The estate headline is a report figure and is not actionable.** Render it as such.

### D3 — The branch account

The destination, structurally `CashCollectionsPage`: signed position headline, the two magnitudes,
then the entries grid (open and closed) with each entry's **consumption journal** as a drilldown.

- **`REVERSE` consumptions render as restorations, not spends.**
- ⚠ **A consumption with no document is named in words on the row** — it means either *seconds old*
  or *the close never completed*. A blank cell makes a real repair item invisible.
- ⚠ **Never compute a variance across receipt kinds.** A settlement receipt carries
  `SystemCashTotal = 0`; differencing it against confirmed cash reads as a full overage. This screen
  should not be differencing anything, and that is the point — do not add it.
- **Cap and page like the neighbours**: 50 per page inside the server's 500-row `TOP` cap, with the
  banner when it bites.

### D4 — Posting

**One form, one kind toggle**, stating the consequence rather than the word: *the branch must hand
this money over* / *the branch may keep this money back*.

- **The branch is typed**, not selected — code, name in either script, or city — and resolved to
  exactly one match before anything can be posted.
- **The standing open position of the same kind is shown before the review step**, naming each
  existing entry and its remaining. The duplicate is permitted by design, so only the screen can
  warn.
- 🔑 **The typo guard is a review step, not a cap**: the amount is read back **grouped and in words**.
  A numeric cap was rejected twice — approval limits are an unsettled question, so any threshold is
  invented, and a cap refuses the legitimate large entry while doing nothing about a plausible wrong
  one.
- **The reason is free text (≤200) the branch reads verbatim**, and the form renders *what the branch
  will see* beside it.
- **The commit names the immutability**: once posted the amount cannot be changed, only cancelled
  while untouched or written off once partly consumed.
- ⚠ **Amounts are posted in what the branch can physically count** — whole units for a 2-decimal
  branch (SAR), three decimals for a 3-decimal one (BHD). The server rounds; **the screen shows the
  rounded figure in the in-words read-back**, so the words and the ledger can never disagree.

### D5 — Correction

**One button whose meaning the entry decides.** Untouched ⇒ *Cancel this entry*. Partly consumed ⇒
*Write off the remaining 400.000*, with the reason it cannot be cancelled stated beside it. A menu
offering both is a menu on which someone eventually cancels a consumed entry.

- The **journal stays on screen, unchanged, under the act** — what a write-off does *not* touch is
  the load-bearing property, and it is more convincing shown than asserted.
- *"Changing the amount is not offered at all"* is said out loud beside the button, because its
  absence is otherwise indistinguishable from an oversight.
- The cancel dialog must handle **losing the race**: the server's predicate is inside its UPDATE, so
  a till that consumed a millisecond earlier wins. Come back with *"a till consumed part of this —
  here is the new remaining, write off the rest instead"*, never an error toast.

### D6 — Audit pane

**The entry is the audit** — posting, consumption, void and correction are already stamped with who
and when. The pane is a projection of the two tables into one column of time. It borrows the authz
admin pane's *shape* and **none of its storage**: settlement timestamps are local, `UaAdminAudit`'s
are UTC, and mixing them would put a three-hour lie beside a branch manager's own row.

**"From where"** renders the **store code** for a consumption (it knows its store, and *which branch
spent this* is a real audit question) and the **poster's name** for a posting — there is no
`PostedFrom` column and none is owed.

### D7 — Bulk upload

A second door beside the single form, which is **untouched**.

- **Two calls over the same multipart upload**: preview parses and returns; **commit re-sends the
  file** with the `BatchId` minted at preview. There is no staging table and no client-held row
  state — *what commits is the file*, not a JSON array the browser assembled.
- **The preview grid is the row-level guard**: every parsed row with its store code **resolved to a
  branch name**, plus kind, amount and reason. It catches the error a number-only review cannot — the
  right amount on the wrong branch.
- **The file's total, in words, at the commit button.** One fat-fingered row moves the total by two
  orders of magnitude and the words say so.
- **Hard errors are all-or-nothing** — the preview enumerates the bad rows and nothing commits.
  **Duplicate warnings commit anyway.**
- **One kind per file**, chosen on the screen with the same toggle. A mixed file makes the in-words
  total a *net* figure a typo can hide inside.
- **A content hash warns** — *"a file with these 47 rows was posted 4 minutes ago by ضحى"* — and never
  refuses.
- **XLSX and CSV**, headers by name. The client uploads bytes; parsing is entirely the server's.
- **Cancel-as-a-unit** is the per-entry correction applied across a `BatchId`, reporting the rows a
  till already consumed and could not be cancelled.

### D8 — The wire contract

From BackOffice spec 1173 D13/D14. All calls through `@/core/api` per `api-envelope` — no
hand-rolled `fetch`. The upload needs a **multipart** door; if `core/api.ts` has no `FormData` path,
it gains one there (the same shape [262](262-the-api-client-learns-to-fetch-a-file.md) added for
blobs), never a `fetch` beside it.

```ts
type EntryKind = 'SHORTAGE' | 'SURPLUS'
type EntryStatus = 'OPEN' | 'CONSUMED' | 'CANCELLED' | 'CLOSED_OUT'
type ConsumptionKind = 'CONSUME' | 'REVERSE'
type DocumentType = 'SHIFT_CLOSE' | 'SPECIAL_RECEIPT'

type FleetRow = {                 // one AGGREGATED row per store — never a projection of entries
  storeId: string; storeName: string
  openCount: number
  shortageTotal: number; surplusTotal: number; signedPosition: number
  movedSinceCutoff: number
  hasOrphan: boolean; hasUncollectedReceipt: boolean
}

type Entry = {
  settlementEntryId: string; entryNumber: number
  storeId: string; entryKind: EntryKind
  amount: number; remainingAmount: number
  reason: string; status: EntryStatus
  batchId: string                 // '' = posted singly
  postedByStaffId: string; postedByName: string; postedAt: string   // local time
  closedByStaffId: string; closedAt: string; closedReason: string
}

type Consumption = {
  settlementConsumptionId: string; settlementEntryId: string
  consumptionKind: ConsumptionKind
  storeId: string; amount: number; remainingAfter: number
  documentType: DocumentType
  documentId: string; documentNumber: string   // '' = in flight, or the close never completed
  businessDay: string; consumedByOperatorId: string; consumedAt: string
}
```

| door | call |
|---|---|
| fleet | `GET  Settlement/Fleet?scope=mine\|unassigned\|all&movedSince=…` → `FleetRow[]` |
| account | `GET  Settlement/Account?storeId=…` → `{ entries: Entry[], consumptions: Consumption[] }` |
| post | `POST Settlement/Post { storeId, entryKind, amount, reason }` → `{ entryNumber, settlementEntryId, amount }` (the **rounded** amount) |
| cancel | `POST Settlement/Cancel { settlementEntryId, reason }` → `{ accepted, refusalReason, remainingAmount }` |
| close-out | `POST Settlement/CloseOut { settlementEntryId, reason }` → `{ accepted, remainingAmount }` |
| repair | `POST Settlement/Repair { settlementConsumptionId, reason }` → `{ accepted, noOp, remainingAfter }` |
| bulk preview | `POST Settlement/Bulk/Preview` (multipart + `entryKind`) → `{ batchId, contentHash, rows[], errors[], warnings[], total }` |
| bulk commit | `POST Settlement/Bulk/Commit` (multipart + `batchId` + `entryKind`) → `{ posted, replayed, entryNumbers[] }` |

⚠ **Exact route names and casing are the server's to confirm** — treat this table as the shape, and
settle the strings against SIS.Api in the joining ticket. A cancel/repair **refusal is a 200 with
`accepted: false`**, never an error, exactly as the till's consume is.

### D9 — Language

The app is **en-only, zero-literal** — every string through `t()`. The domain's Arabic terms
(**عجز** / **فائض**) are **domain vocabulary, not translations**: they ride inside the English
namespace's values beside the English word (*"Shortage · عجز"*), the way the prototype rendered them
and the way the branch's own screen says it. Do **not** stand up a second locale for them.

### D10 — Money rendering

Through `@/core/money`, at the **branch's** currency precision — 3 decimals for BHD, 2 for SAR.
Settlement amounts are `DECIMAL(18,3)` on the server for exactly this reason; a screen that formats
to 2 everywhere silently drops a Bahraini branch's fils.

## Testing Decisions

**What makes a good test here**: it asserts behaviour of a **pure module** — scope resolution, row
projection, the in-words read-back, the preview's error/warning partition — against fixtures.
Components stay thin renderers and are verified by **driving the app**, which is this repo's standing
ruling (spec 083: React Testing Library is deliberately not installed; the pure modules are where
regression is silent).

- **`vitest`, node environment**, `src/**/*.test.ts` — the tier every pure module here belongs to.
  Prior art: `acr-scope.test.ts`, `acr-criteria.test.ts`, `acr-columns.test.ts`, `access.test.ts` in
  `features/collection/inquiry/`.
- **Modules that earn a test**, because each encodes a rule that regresses silently:
  - **scope resolution** — mine ∪ one-level reports; no staff row ⇒ unfiltered; and 🔑 **wrong-money
    and cash-waiting ignore the scope entirely**;
  - **worklist triage** — the three groups, wrong money enumerated, ageing collapsed to a count;
  - **the correction decision** — which single button an entry shows, from its status and remaining;
  - **amount-in-words**, including the rounded figure and the grouping;
  - **the preview partition** — hard errors block, duplicate warnings do not;
  - **money formatting** at 2 vs 3 decimals.
- **A Playwright drive** under `tools/settlement-drive.mjs`, the manual-run shape 264–266 use:
  search → account → post → correction → upload preview. ⚠ **Do not repoint a drive at live** — its
  assertions are about behaviour on *specific responses*, and the live estate does not contain most
  of those cases on demand; a live drive asserts them vacuously and goes green proving nothing (the
  ruling [259](259-the-screens-call-the-real-door.md) and [266](266-the-screen-calls-the-real-door.md)
  both reached).
- **`npm run typecheck` and `npm run lint`** (import boundaries, token contrast, colour literals) are
  gates on every slice, not a final step.
- **The joining ticket is manual by nature**: a real grant, a real branch, a real entry posted and
  then cancelled, against live SIS.Api.

## Out of Scope

- **Everything server-side** — the tables, the guarded UPDATE, the endpoints, the till's inquiry and
  consume, the special receipt, the ACR changes, the SAP mint. BackOffice spec 1173.
- **The branch's own Store Account screen** — that is the WPF till, spec 1173 D11.
- **Building the accountant/collector assignment** — its tables, seed and admin screen are BackOffice
  map 1153. ⚠ This screen **consumes** the assignment, so its scoped door needs 1153's migration on
  the sink (not its admin screen — an unmaintained seed still scopes correctly).
- **Approval limits** — whether a large entry needs a second accountant. Unsettled by design; do not
  invent a threshold on this screen.
- **Entry ageing rules and escalation** — the ageing lane shows a count and a way through; no
  threshold logic, no notification, no auto-anything.
- **Any repair the server does not offer.** The screen presses buttons; the rules live in the guarded
  UPDATEs.
- **A second locale.** D9.

## Further Notes

**The prototype is the read model, not a mockup.** `fake.js` carries a decision written at the line
it affects, and its fixture is deliberately hostile: six hand-written branches cover a branch holding
both kinds at once, a surplus consumed to zero last night, an orphan consumption, a
prepared-but-uncollected receipt with a compensating void, a square branch, and one `CLOSED_OUT`
beside one `CANCELLED`. **Build against those six before building against a happy path** — they are
every state this screen must render, chosen because each one broke a layout that looked fine on the
easy case.

⚠ **The fixture says 1000 branches; the estate is 1394, of which 1255 are unassigned.** Any
denominator takes the real numbers.

**Build-order dependency**: BackOffice's settlement migration and endpoints must exist before the
joining ticket; the scoped door additionally needs map 1153's assignment migration on the sink. The
screens before that ticket build against fixtures, exactly as 262–265 did.
