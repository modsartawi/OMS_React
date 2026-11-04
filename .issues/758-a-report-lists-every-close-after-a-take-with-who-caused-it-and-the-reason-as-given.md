---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3326-a-callout-widens-when-nobody-can-serve-and-a-failed-take-counts-against-the-taker-spec.md
blocked-by: —
---

# 758 — A report lists every close after a take, estate-wide, with who caused it and the reason as given

Asked by the owner on 2026-11-04, after reading a P686 failed-takes drill on production: the team needs one
exportable list of every delivery closed or cancelled after a store took it, by kind, with the reason, so they
can analyse the reasons. Builds on 713/714 (on main).

## What to build

**No backend change.** `GET DispatchScorecard/Drill` answers for the whole estate when neither `store` nor
`staff` is sent (`DispatchScorecardMath.Drill`, BackOffice pricing2). Two reads feed the report:

- `figure=failedTakeRate`: every take won in the range. Each row carries `afterTakeOutcome`, `afterTakeReason`,
  `afterTakeCourier`, `closedBy`, `closedAt`. Keep only rows whose `afterTakeOutcome` is not `''`. `items`,
  `atpShortLines` and `atp` are filled only on a failed take (`StoreClosed`, `CourierBlamedStore`).
- `figure=fallbackCancels`: the `FallbackStoreClosed` rows (callout-level, `bidId` `''`), with items/stock filled.

`figure=refusedCloses` feeds a **second tab**: deliveries a store won and then tried to close, refused by the
lock. Those deliveries were not cancelled; each row lists its `refusedAttempts` (empty past the 6-month sweep:
show the 714 note).

**Where.** Inside `features/oms/dispatch-scorecard/` (it reuses that feature's api, access probe and
`after-take.ts`; features never import features). Its own page at `/oms/dispatch-scorecard/closes` and its own
menu leaf under OMS, "Closes after a take", gated by the same `canOpenDispatchScorecard` probe. No new grant.

**Filters.** The scorecard's: range (the door refuses over 92 days, `CALLOUT-301`), type, channel, city, region,
store. Plus an **outcome** multi-select, defaulting to the two failed-take kinds. All in the URL.

**Who caused it.** A column that says, in plain words, where the close points, so the team can judge at a glance.
A label mapping per outcome, nothing computed:

| `afterTakeOutcome` | What happened (714) | Who caused it | Failed take? |
|---|---|---|---|
| `StoreClosed` | Closed by the store | The store: it closed the delivery itself | Yes |
| `CourierBlamedStore` | Courier cancelled, naming the store | The store, according to the courier | Yes |
| `FallbackStoreClosed` | Closed by the fallback store | The fallback store | No (fallback cancel) |
| `CourierOtherReason` | Courier cancelled, other reason | The courier side: the reason does not name the store | No |
| `CourierNoReason` | Courier cancelled, no reason given | Unclear: the courier gave no reason | No |
| `OtherClose` | Closed by someone else | Someone else (HQ, customer channel or system): see Closed by | No |
| anything else | the raw code | Unclear | No |

Refused-closes tab: "The store tried to back out; the lock refused it".

The reason column is the 714 rule: exactly as sent, never translated, mapped or concluded; "No reason given"
when empty. Never "no stock".

**Columns.** Delivery (opens it), Store, Offered, Answer time, Taken by, Closed by, Closed at, Who caused it,
What happened, Failed take (yes/no), Reason (as given), Courier, Items, Stock at offer.

**Summary above the grid.** Counts per outcome (the chip doubles as the filter), and the reasons ranked by count
of identical text ("Order Not Found in branch × 37"). Counting rows the door sent is display, not a figure.

**Export.** `.xlsx` with the grid's columns as shown (items and attempts one cell each), and a second sheet of the
reason counts.

Labels: en + ar (Arabic drafts, to be reviewed).

## Proof

- [x] Unit: the outcome → who-caused-it mapping (every known outcome + an unknown); the row filter keeps only
      closed rows; reason counting groups identical text and treats empty as "No reason given"
- [x] Stubbed drive, LTR and RTL: estate-wide calls send no store; default shows only failed takes; switching
      outcomes shows the others; an Arabic courier reason shows exactly as sent; refused-closes tab with the swept
      note; export carries the columns
- [ ] Live: the report reads against production with the owner

## Boundaries

No new grant, no backend change. The screen computes no rate, rank or median.

## Done when

An HQ user opens "Closes after a take", sees every close after a take for the range with who caused it and the
reason as given, filters by outcome, and exports it, against production.

## Comments

**2026-11-04 — built (client), stubbed.** Page `/oms/dispatch-scorecard/closes` + OMS leaf "Closes after a take"
right after the scorecard, on the scorecard's own probe/predicate (no new grant, no backend change).

- Pure module `src/features/oms/dispatch-scorecard/closes.ts` (`closes.test.ts`, 18 tests): outcome →
  who-caused-it key (6 known + unknown → "Unclear", refused tab its own label), failed-take yes/no,
  `closedRows` (failedTakeRate rows with an outcome + fallbackCancels rows), outcome chip counts, outcome filter,
  reason counting, and the URL (`tab`, the scorecard filters, `outcome=A,B`; absent = the two failed kinds,
  `outcome=` = none). Columns in `closes-columns.tsx`; the scorecard's filter form lifted to `FilterForm.tsx`
  (shared by both pages; scorecard drive still 150/150). `atpAtOfferColumn` / `refusedAttemptsColumn` exported
  from `columns.tsx` for reuse. Menu test pins the leaf order and that the rail marks it on its own page.
- Drive `tools/closes-after-take-drive.mjs`: **68/68** stubbed, LTR + RTL — estate-wide reads send no
  `store`/`staff`; default = failed takes only; chips count and filter, land in the URL; Arabic courier reason
  exact in a `<bdi>`; reasons ranked; export sheet 1 = the grid's 14 columns (items one cell, no isolates),
  sheet 2 = reason counts; refused tab with attempts + 6-month note + own export; store filter; CALLOUT-301;
  delivery link opens the delivery.

**Judgement calls (overrulable):**
1. A `FallbackStoreClosed` outcome on a *won bid* in the failedTakeRate read is dropped; the fallback close is
   listed once, from the fallbackCancels read, against the fallback store — otherwise the same callout lists
   twice and once against the store that let it go.
2. Reason counting groups text identical **after trimming surrounding spaces** (`"Order Not Found in branch "`
   = `"Order Not Found in branch"`); case and script are never folded. The grid cell still shows the text as sent.
3. The report's Reason column reads "No reason given" on **every** empty reason (the ticket's rule), unlike the
   714 drill, where a store close with no note shows the dash.
4. Reason counts (and their export sheet) follow the outcome chips: they rank the rows listed.
5. Outcome chips list all six known kinds (0 included) plus any unknown code the door sent; "All outcomes" and
   "Failed takes only" are presets.

**Remaining:** the live walk with the owner against production (third proof box).

