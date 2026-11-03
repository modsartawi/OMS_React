---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3326-a-callout-widens-when-nobody-can-serve-and-a-failed-take-counts-against-the-taker-spec.md
blocked-by: 713
---

# 714 — The scorecard drill shows each failed take, fallback cancel and refused close, in the courier's own words

## What to build

Backend: BackOffice spec 3326, branch `spec3326` (tip `24035f297`, now reachable from `pricing2`), tickets 3332, 3339. SIS.Api minimal APIs, System.Text.Json web defaults: camelCase fields, dictionary keys as sent.

Door: `GET DispatchScorecard/Drill?figure=&staff=&from=&to=&type=&channel=&city=&region=&store=` (`DispatchScorecardDrill`).
Server: `DispatchScorecardModels.cs` (`DispatchScorecardDrillRow`, `DispatchScorecardDrillItem`,
`DispatchScorecardRefusedClose`) and `Callouts\Delivery\DeliveryCalloutStock.cs` (`CalloutOfferedLine`).
Client: `src/core/models/dispatch-scorecard.ts`, `src/features/oms/dispatch-scorecard/DrillDrawer.tsx`.
The three new figures are opened from the columns of ticket 713.

New on `DispatchScorecardDrillRow` (none of these is in the TS model today):

- `closedBy: string`: the closer (`'Outbox'` on a courier cancel). `answeredBy` stays the taker.
- `closedAt: string | null`: local time, no offset.
- `afterTakeOutcome: string`: `'StoreClosed' | 'CourierBlamedStore' | 'FallbackStoreClosed' | 'CourierOtherReason' | 'CourierNoReason' | 'OtherClose' | ''`
  (`''` = nothing after the take yet). Open union (`| (string & {})`). Only the first two are failed takes.
- `afterTakeReason: string`: the pharmacist's note, or the courier's exact text. May be Arabic. `''` = none given.
- `afterTakeCourier: string`: the courier as OTO names it (e.g. `alshrouqexpress`). `''` = not a courier cancel.
- `items: DispatchScorecardDrillItem[]`: `{ itemNumber: string, quantity: number, uom: string }`, the delivery's lines.
- `atpShortLineCount: number`: the bid's short-line count at offer. It is the bid's own column, so it holds even when the snapshot cannot be read.
- `atpShortLines: CalloutOfferedLine[]`: `{ line: number, material: string, quantity: number, uom: string, neededBase: number, availableBase: number | null }`.
  `availableBase: null` = no stock row was on record. Do not confuse with `DispatchBid.atpShortLines`, which is a number.
- `refusedAttempts: DispatchScorecardRefusedClose[]`: `{ at: string, closedBy: string, register: string, reason: string }`, oldest first.

`DispatchScorecardBidClass` gains `'FallbackCancel'`, the class of a `fallbackCancels` row. Like `Fallback` and `Released`,
that row is callout-level: `bidId` is `''`.

**What is filled where** (as built):

- `closedBy`, `closedAt` and the three `afterTake*` fields: on every bid row and on the callout-level rows, whatever the figure.
- `items`, `atpShortLineCount` and `atpShortLines`: only in the `failedTakes`, `failedTakeRate` and `fallbackCancels` drills,
  and only on a row whose outcome is a failed take or `FallbackStoreClosed`. On a `failedTakeRate` drill the rows are the
  takes won (the rate's denominator), `counted` marks the failed ones, and only those carry lines.
- `atp` on those rows: `'covers' | 'short' | 'unknown'`. **`'unknown'` means the stock check did not run** for that bid: show "Unknown", never "short".
- `refusedAttempts`: only in the `refusedCloses` drill. The figure reads a count on the callout; the list reads the
  `CloseRefused` events, which are swept after **6 months**. So an older row still counts and its list is **empty**. Show
  the row with a note, never as an error.

**The drawer.** For the three new figures, add columns: Taken by (`answeredBy`), Closed by, Closed at, What happened
(`afterTakeOutcome` in words), Reason, Courier, Items (each `itemNumber` with `quantity uom`), Stock at offer (`atp`, and the
short lines when `atpShortLines` has any: `material` needed `neededBase`, on record `availableBase`). On `refusedCloses`, show the
attempts under the row: time, who, till, reason. The `.xlsx` carries the same columns, with items and attempts joined into one cell each.

**Words.** Show the courier's reason **exactly as sent**: no translation, no mapping, no conclusion. Never say "no stock" or
anything like it ("Order Not Found in branch" may mean not ready). A courier cancel with no reason reads "No reason given".
`availableBase: null` reads "Not on record". Labels (Arabic drafts, **to be reviewed**):

| Key | English | Arabic (draft, to review) |
|---|---|---|
| `drill.column.takenBy` | Taken by | أخذه |
| `drill.column.closedBy` | Closed by | أغلقه |
| `drill.column.closedAt` | Closed at | وقت الإغلاق |
| `drill.column.afterTake` | What happened | ما حدث |
| `drill.column.reason` | Reason (as given) | السبب (كما ورد) |
| `drill.column.courier` | Courier | شركة التوصيل |
| `drill.column.items` | Items | الأصناف |
| `drill.column.refusedAttempts` | Refused close attempts | محاولات إغلاق مرفوضة |
| `drill.noReason` | No reason given | لم يُذكر سبب |
| `drill.notOnRecord` | Not on record | غير مسجّل |
| `drill.shortLine` | {{material}}: needed {{needed}}, on record {{available}} | {{material}}: المطلوب {{needed}}، المسجّل {{available}} |
| `drill.attemptsSwept` | Attempts older than 6 months are no longer kept. The count still stands. | لا تُحفظ المحاولات الأقدم من 6 أشهر. ويبقى العدد كما هو. |
| `class.FallbackCancel` | Fallback cancelled | تحويل احتياطي أُلغي |
| `afterTake.StoreClosed` | Closed by the store | أغلقه الفرع |
| `afterTake.CourierBlamedStore` | Courier cancelled, naming the store | ألغاه المندوب مع ذكر الفرع |
| `afterTake.FallbackStoreClosed` | Closed by the fallback store | أغلقه فرع التحويل الاحتياطي |
| `afterTake.CourierOtherReason` | Courier cancelled, other reason | ألغاه المندوب لسبب آخر |
| `afterTake.CourierNoReason` | Courier cancelled, no reason given | ألغاه المندوب دون ذكر سبب |
| `afterTake.OtherClose` | Closed by someone else | أغلقه طرف آخر |

## Proof

- [x] Stubbed drive per figure (`failedTakes`, `failedTakeRate`, `fallbackCancels`, `refusedCloses`), LTR and RTL
- [x] An Arabic courier reason shows exactly as sent; no "no stock" text exists in either locale for these rows
- [x] `atp: 'unknown'` reads Unknown; a `refusedCloses` row with an empty `refusedAttempts` shows the 6-month note
- [ ] Live: the rows read against the deployed door

## Boundaries

No new grant: the same `DispatchScorecard` grant. No till list of failed takes.

## Done when

HQ opens a failed-take, fallback-cancel or refused-close figure and reads each delivery's taker, closer, time, reason, courier, items and stock at offer, against the deployed door.

## Blocked by

713; BackOffice spec 3326 deployed, with HQ SQL `Callouts/Sql/005`–`007` and `Sd/Sql/064` run.

## Comments

**2026-11-03 — built (stubbed), branch `impl/3326-714`.** The drill row model gains spec 3326's fields as built on
pricing2 (`closedBy`, `closedAt`, `afterTakeOutcome` open union, `afterTakeReason`, `afterTakeCourier`, `items`,
`atpShortLineCount`, `atpShortLines: CalloutOfferedLine[]`, `refusedAttempts`), all optional so a server before 3326
reads "—"; `DispatchScorecardBidClass` gains `FallbackCancel`. A `failedTakes` / `failedTakeRate` / `fallbackCancels` /
`refusedCloses` drill adds Closed by, Closed at, What happened, Reason (as given), Courier, Items and a richer Stock at
offer (the label plus each short line, "Not on record" for `availableBase: null`); the person column reads "Taken by".
The reason is the server's text in a `<bdi>`, untouched; a courier cancel with none reads "No reason given". A
`refusedCloses` drill lists the attempts (time · who · till · reason, each isolated by kind) in an auto-height column
right after Outcome; an empty list reads the 6-month note. The `.xlsx` carries the same columns, items and attempts
joined into one cell each (`; `). Pure logic in `after-take.ts` (+ `after-take.test.ts`, 14 tests, incl. both locales
never saying "no stock"); en + ar keys as the ticket's table (ar drafts still to review). The drawer widens to 96rem for
these figures.

Proof: `after-take.test.ts` green; `tools/dispatch-scorecard-drive.mjs` 150/150 (LTR + RTL), with a stubbed drill
envelope per figure: Arabic courier reason exact and isolated, "No reason given", Unknown atp, short lines incl. Not on
record, FallbackCancel class, attempts listed + swept note, no "no stock" text, older figures unchanged. Gates:
typecheck, `npm test` (8478), lint grid-base / contrast / palette / controls green.

**Remains:** the live walk against the deployed door (BO 3326 deployed, HQ SQL `Callouts/Sql/005`–`007`, `Sd/Sql/064`).
Overrulable choice: "attempts under the row" is an auto-height column (AG Grid Community has no master/detail), not a
detail row.
