---
status: open
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

## Proof

- [ ] All six hostile fixture branches render correctly — each one eyeballed, not just loaded.
- [ ] A consumption with no document says so **in words**; a `REVERSE` row reads as a restoration.
- [ ] A `CLOSED_OUT` entry shows a zero remaining **without** a consumption behind it and does not
      read as consumed.
- [ ] Money renders at **3 decimals for a BHD branch** and 2 for SAR, through `@/core/money`.
- [ ] Unit tests on the row projection and the journal ordering (`vitest`, node) — the pure module,
      not the component.
- [ ] `typecheck` + `lint` green; the drive (or a manual pass) opens an account and a journal.

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
