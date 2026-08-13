---
status: done
spec: 267
blocked-by: 268
---

# 269 — A branch's account opens, with its journal underneath

## What to build

The **destination** — the view an accountant lands on from a search hit or a worklist row, and the
one every later ticket writes into. It is built before the door (270) deliberately: the door's whole
job is to reach this, and a door onto nothing cannot be judged.

Structurally `CashCollectionsPage` — the accountant already reads that screen every day.

- **The signed headline** and its two magnitudes: what this branch owes, what it may keep back, and
  the signed position. The position is **displayed, never consumed** — nothing in the model nets
  entries, and the headline must not imply otherwise.
- **The entries grid**: number, kind, amount, remaining, reason, status, posted by / at. Open and
  closed both, closed visibly closed.
- **The journal drilldown** per entry: its consumptions, each with amount, **what it left behind**,
  the document that spent it, the day, and who. This is the view that lets an accountant answer *"was
  my 500 used?"* on the phone — the reason the account is per-branch at all.

Read model and fixtures come from the prototype's `fake.js`
(`C:\Work\DMSCO\BackOffice\.scratch\proto\settlement-accountant-screen\`, branch
`proto/1147-accountant-screen`). ⚠ **Read it, do not paste it** — it is another repo's throwaway.

### The three rendering rules that are the actual work

1. 🔑 **A consumption with no document is named in words on its row** — *"no document yet"* — never a
   blank cell. Blank means either *seconds old* or *the close never completed*, and the second is a
   repair item worth real money. A blank cell makes it invisible.
2. 🔑 **`REVERSE` consumptions render as restorations, not spends.** A reversal always means *this
   document did not happen*; rendering it as another spend inverts the branch's position on screen.
3. ⚠ **Never difference confirmed against system cash across receipt kinds.** A settlement receipt
   carries `SystemCashTotal = 0` and a cross-kind variance reads it as a full overage. This screen
   should compute no variance at all — the rule is here so nobody adds one later.

Build against the fixture's **six hostile branches** before any happy path: a branch holding both
kinds at once (with the surplus partly consumed), a surplus consumed to zero last night, an orphan
consumption, a prepared-but-uncollected receipt with a compensating void, a square branch with
history only, and one `CLOSED_OUT` beside one `CANCELLED`.

Paging and caps follow the neighbours — 50 a page inside the server's 500-row `TOP`, with the banner
when it bites.

## Spine reach

An accountant can read one branch's whole position and the history behind every entry.

### What the build settled

**The read model is `src/core/models/settlement.ts`, transcribed from D8 — with three fields D8
does not carry**, and both extensions are logged in `.afk/HITL-269.md` for 274 to settle:

| added | why it could not wait |
|---|---|
| `currencyKey` on the account | D10 requires **the branch's own precision** and nothing on D8's contract carries a currency. Deriving one from the store code is a rule nobody wrote down; defaulting to SAR is exactly the silent rounding D10 forbids |
| `storeName` on the account | 270 arrives here from a search hit that already knows the branch — a pasted address does not, and an account headed by a bare code is a screen you cannot check you are on |

🚩 **The wire has no `consumedByName`**, so the journal renders `Operator {id}`. D8 is the contract
and it carries an id; the prototype's own commentary is explicit that names on a settlement row are a
cross-database question it split two ways (`postedByName` denormalised, `storeName` resolved on
read), and a consumption's operator was on neither side of that split.

**Everything the screen decides lives in `account-projection.ts`, and the three rules are structural
rather than stylistic** — a component cannot get them wrong, because it is never handed the raw
condition:

- rule 1 returns a **tagged union** (`{kind:'orphan'}`), never `''`. A formatter handed an empty
  string renders an empty cell; a formatter handed a case must name it.
- rule 2 is `isRestoration`, computed once. Every call site reads the flag rather than re-testing
  `consumptionKind`, so there is one place the rule can be wrong and one place it is proven.
- rule 3 is enforced by **absence, and the absence is documented at the file someone would add it
  to**. The only subtraction in the feature is `shortageTotal − surplusTotal`, and it is labelled
  *displayed, never consumed*.

**Two findings the fixture produced that the ticket did not name**, both now pinned by tests:

- 🚩 **A `CANCELLED` entry keeps its full `remainingAmount` on the wire** (0688/147 still carries
  180.000 — the cancel closes the row without zeroing the figure). The headline already refused to
  count it; the Remaining **column** now refuses to draw it too (`displayRemaining`), because a grid
  and a headline telling a reader two different things about one entry is worse than either being
  wrong alone. The Amount column still shows 180.000, and correctly: that *is* what was posted.
- 🚩 **`writtenOff` is read back, never differenced.** A `CLOSED_OUT` entry's forgiven remainder is
  the journal's **own last `remainingAfter`** (400.000 on 0688/133), which is a figure the server
  wrote — not a subtraction of two totals, which is the shape rule 3 forbids.

**The two copies this slice made, and why neither graduated.** `cap.ts` and `AccountStates.tsx` are
copied from `features/collection/inquiry/`, since `check-boundaries.mjs` reads the two collection
features as two. That is 268's own rubric applied rather than dodged — *copying is the cheaper
default; graduating is right only if the copy would be the second one and the component is genuinely
identical* — and neither condition holds: this is the **second** copy, the cap **differs** (500, the
account door's `TOP`, against the inquiries' 2,000), and only three of `GridStates`' five pieces came
across (269 is read-only, so there is no `ExportButton`; its empty case is a sentence, not a failed
search). Whichever earns a **third** copy graduates on the trigger `ScreenGate` did.

⚠️ **`?store=` is how a branch is reached, and that is the whole of it** — 257's `?acr=` idiom, the
URL as the only home. The ticket forbids a picker; 270's search hit and worklist rows become ordinary
links to this param, so 270 is a door onto an address rather than a rewiring.

## Proof

- [x] All six hostile fixture branches render correctly — each one eyeballed, not just loaded. —
      screenshotted at 1600×1100 and read, not merely loaded: **0142** (both kinds open, 455.50 owed
      over 575.50/120.00), **0207** (last night's two closes, only the open shortage in the
      position), **0331** (the orphan, amber, in words), **0455** (four rows, the void directly under
      the receipt it voids), **0512** (`square with head office`, and a grid that is **not** empty),
      **0688** (BHD, `Remainder written off` beside `Cancelled`). Two defects were found **by
      eyeballing and by nothing else**: the journal's two numeric columns had no trailing gap
      (`600.00Settlement receipt SR-0455-0011` read as one token) and the shift-close sentence
      doubled its Z (`Z Z-40318`).
- [x] A consumption with no document says so **in words**; a `REVERSE` row reads as a restoration. —
      `settlement-drive` scenarios 0331 and 0455: *"No document — the close never completed"* on an
      amber row, `data-orphan="true"`, and the entry's own Journal cell carrying *"1 · one has no
      document"* so an orphan is findable without opening every entry. The reversal reads **Given
      back** + *"Void of SR-0455-0012"*, is the only `data-restoration="true"` row on the entry, and
      🚩 its `remainingAfter` **rises** 400 → 600 — the tell a spend can never show.
- [x] A `CLOSED_OUT` entry shows a zero remaining **without** a consumption behind it and does not
      read as consumed. — 0688/133: status renders **Remainder written off**, `closure` is
      `'written-off'` and asserted `not.toBe('consumed')`, remaining is 0.000 with **one** journal row
      behind it that left 400.000 standing, and the journal names the write-off *above* itself while
      staying unchanged beneath — the property 272's correction argument rests on, shown a slice
      early.
- [x] Money renders at **3 decimals for a BHD branch** and 2 for SAR, through `@/core/money`. —
      0688 is Al-Muharraq, in Muharraq, and is BHD **deliberately**: `95.250` and `640.000` on screen
      against `75.50` and `1,240.00` on the five SAR branches. A test pins that the fixture holds
      exactly one BHD branch, because a "tidy-up" to SAR would make this bullet unfalsifiable while
      every figure still looked fine.
- [x] Unit tests on the row projection and the journal ordering (`vitest`, node) — the pure module,
      not the component. — `account-projection.test.ts`, **33 assertions across 9 describes**, every
      one against a hostile branch rather than a happy path. Ordering is **oldest first** (272's audit
      pane is a projection of this same journal, and two panes disagreeing about the direction of time
      would be a defect) and **totally ordered** — tie-broken by consumption id, asserted to be stable
      under a reversed input, because two rows can genuinely share a minute-precision stamp.
- [x] `typecheck` + `lint` green; the drive (or a manual pass) opens an account and a journal. —
      `tools/settlement-drive.mjs` **51/51** (extended from 268's 20, not replaced), `npm test`
      **1596** (100 files), 493 files boundary-clean **with the two collection features read as two**,
      117 contrast pairs, 498 files colour-clean, `npm run build` green.

**Four `/code-review` findings, all fixed in-slice.** The two that were real defects rather than
hardening: the Journal column paired `agNumberColumnFilter` with a **string** `filterValueGetter`, so
`equals 4` would match nothing and `lessThan 4` everything — a filter that is confidently wrong
rather than merely unhelpful (the getter is gone; a count filters as a number); and the journal fell
back to `rows[0]` while **no grid row was selected**, so after a reader sorted, the journal described
an entry that was neither highlighted nor on top. The grid now selects its own first *displayed* row
and `onSelectionChanged` is the single source of truth. Plus: `projectAccount`/`accountHeadline` are
null-tolerant, because D8 is **unconfirmed** and this app has no ErrorBoundary — a `data: null` would
have blanked the SPA instead of showing the error banner two lines away; and `hasOrphan` was computed
and test-pinned but rendered nowhere, which is the fix that put rule 1 on the entry row.

**`/standards-review`: no hard violation on either axis.** Three things it raised that were acted on:

- 🚩 **The cap banner was asserting what `cap.ts` says must be a possibility.** It read *"the oldest
  are missing from this page"* — which states a truncation as fact (the door returns rows, not a
  count, so an exact fit is indistinguishable) **and** invents an ordering D8 never gives. Reworded
  to name what is known: the answer came back at the cap, so there may be more.
- The `limit` param the client sends is a **wire extension D8 does not list** and was the one such
  extension not written down; it is now in `.afk/HITL-269.md` with the rest.
- ⚠️ **A live vocabulary conflict, logged rather than resolved unilaterally.** `CONTEXT.md`'s
  **Store** entry says *"Avoid: branch"*, while spec 267 says *branch* in all 35 user stories and D9
  rules this screen speaks the branch's own language. The spec won for the copy and the component
  name; every identifier crossing the API boundary is still `storeId`. `CONTEXT.md` also has no entry
  for *settlement entry*, *consumption*, *journal* or *orphan* — that is a `/domain-modeling` job for
  the wave, and if it rules for "store" the rename should happen in one act across 269–273 rather
  than drifting in slice by slice.

Two departures the spec review flagged as unasked-for and well-argued were **kept**, both recorded
above: `displayRemaining` (the cancelled entry's blank Remaining) and `writtenOff` (the write-off
sentence above an unchanged journal — 272's act, but its *outcome* is already on the wire and a
`CLOSED_OUT` entry is in this ticket's own fixture).

## Boundaries

- **Read-only.** No posting, no cancel, no write of any kind — 271/272 own those.
- **No search and no worklist** — 270's, and this ticket must not grow a branch picker to test itself
  (use a route param or a fixture selector).
- **No variance arithmetic**, per rule 3.

## Done when

A branch's account renders from fixtures with its headline, its entries and every entry's journal,
and the three rendering rules hold on the hostile fixture rather than on a happy path.

## Blocked by

[268](268-the-settlement-screen-appears-for-a-granted-session.md).

## Open questions

None.
