---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3326-a-callout-widens-when-nobody-can-serve-and-a-failed-take-counts-against-the-taker-spec.md
blocked-by: —
---

# 713 — The dispatch scorecard ranks failed-take rate, and shows fallback cancels and refused closes beside it

## What to build

Backend: BackOffice spec 3326, branch `spec3326` (tip `24035f297`, now reachable from `pricing2`), tickets 3329, 3330, 3339. SIS.Api minimal APIs, System.Text.Json web defaults: camelCase fields, dictionary keys as sent.

Doors: `GET DispatchScorecard/Grid` (`DispatchScorecardResult`) and `GET DispatchScorecard/StoreCard`
(`DispatchScorecardCard`). Server: `Sartawi.Retail.Data\Modules\Callouts\Scorecard\DispatchScorecardModels.cs`.
Client: `src/core/models/dispatch-scorecard.ts`, `src/features/oms/dispatch-scorecard/figures.ts`.

New on the wire (none of these is in the TS model today):

- `DispatchScorecardMeasure` gains `'failedTakeRate'`, the sixth ranked measure, `better: 'lower'`.
- `DispatchScorecardFigure` gains `'failedTakes' | 'fallbackCancels' | 'refusedCloses'` (the rate is already a figure through the measure).
- `DispatchScorecardStoreRow`:
  - `failedTakeRate: number | null`: failed takes ÷ `won`. `null` when the store won nothing.
  - `failedTakeRank: number | null`. The name is `failedTakeRank`, not `failedTakeRateRank`, like `medianAnswerRank`.
  - `failedTakes: number`
  - `fallbackCancels: number`: fallback deliveries this store then closed. Context only, not in the rate.
  - `refusedCloses: number`: callouts this store won and then tried to close, refused by the lock. Counted once per callout. Context only.
- `DispatchScorecardStaffRow`: `failedTakes: number`, `failedTakeRate: number | null`, `refusedCloses: number`.
  The staff rate is **not ranked** and has no rank field. It is credited to the person who took the delivery, whoever closed it.
- `DispatchScorecardCard.measures` now carries six entries; the sixth is `failedTakeRate` with `rank`, `of`,
  `estateMedian` and `better: 'lower'`, as the door sends it.

Optional fields (`?:`), as 572 did: a server not yet deployed sends none of them, and the screen reads that as a missing figure, never 0.

**Grid.** In `STORE_COLUMNS`, add `ranked('failedTakeRate', 'lower')` after `declineRate`, so it sorts and drills like the other five.
A `null` rate shows as missing ("—"), never `0`; `compareFigures` already sorts an absent value last, so a store with no wins
never ranks best. The 20-bid minimum and `tooFew` apply as sent; the screen computes nothing. Add context columns
`failedTakes` (drills `failedTakes`), `fallbackCancels` (drills `fallbackCancels`) and `refusedCloses` (drills `refusedCloses`),
never sortable, never ranked. Put `refusedCloses` right beside the rate: with the lock on, a store trying to back out mostly
shows there, not in the rate (BO 3339).

In `STAFF_COLUMNS`, add `failedTakes` (drills `failedTakes`), `failedTakeRate` (context, drills `failedTakeRate`) and
`refusedCloses` (drills `refusedCloses`). None rank.

**Store card.** The sixth measure shows with its rank, "#rank of `of`", estate median and direction, like the other five.

**Export.** The grid's `.xlsx` carries the new columns as shown.

**Words.** A failed take is never labelled "no stock" or anything like it. Labels (Arabic drafts, **to be reviewed**):

| Key | English | Arabic (draft, to review) |
|---|---|---|
| `measure.failedTakeRate`, `figure.failedTakeRate` | Failed-take rate | نسبة الأخذ غير المكتمل |
| `column.failedTakes`, `figure.failedTakes` | Failed takes | أخذ غير مكتمل |
| `column.fallbackCancels`, `figure.fallbackCancels` | Fallback cancels | تحويلات احتياطية أُلغيت |
| `column.refusedCloses`, `figure.refusedCloses` | Refused closes | إغلاقات مرفوضة |
| `columnHint.failedTakeRate` | Of the deliveries this store won, how many it then closed itself, or a courier cancelled with a reason that names the store. Lower is better. A store with no wins shows —. | من التوصيلات التي فاز بها هذا الفرع، كم منها أغلقه الفرع بنفسه، أو ألغاه المندوب بسبب يذكر الفرع. الأقل أفضل. الفرع الذي لم يفز بشيء يظهر —. |
| `columnHint.fallbackCancels` | Deliveries this store got as a fallback and then closed. Not in the rate. | توصيلات وصلت إلى هذا الفرع تحويلاً احتياطياً ثم أغلقها. لا تدخل في النسبة. |
| `columnHint.refusedCloses` | Deliveries this store won and then tried to close while the lock held them. Each delivery counts once. Not in the rate. | توصيلات فاز بها هذا الفرع ثم حاول إغلاقها وهي مقفلة. يُحسب كل توصيل مرة واحدة. لا تدخل في النسبة. |

## Proof

- [x] `figures.test.ts`: six ranked store columns, `failedTakeRate` lower-is-better; a `null` rate sorts last both ways; the three context columns never sort
- [x] Stubbed drive: a store with zero wins shows — and is not ranked first; the card shows six measures; the staff tab shows the rate without a rank
- [ ] Live: the columns read against the deployed door

## Boundaries

No new grant: the same `DispatchScorecard` screen grant. The screen computes no figure, rank or median.

## Done when

HQ sorts stores by failed-take rate and sees fallback cancels and refused closes beside it, on store and staff rows, against the deployed door.

## Blocked by

BackOffice spec 3326 deployed, with HQ SQL `Callouts/Sql/005`–`007` and `Sd/Sql/064` run.

## Comments

**2026-11-03, implemented (branch `impl/3326-713`), stubbed proof only.**

Built:
- `core/models/dispatch-scorecard.ts`: `failedTakeRate` is the sixth `DispatchScorecardMeasure`; the three new figures are on `DispatchScorecardFigure`; the store row has `failedTakeRate`, `failedTakeRank`, `failedTakes`, `fallbackCancels` and `refusedCloses`; the staff row has `failedTakes`, `failedTakeRate` and `refusedCloses`. All are optional (`?:`), so a server without them shows "—", never 0.
- `figures.ts`: `ranked('failedTakeRate', 'lower')` after `declineRate`, with `refusedCloses` right beside it. `fallbackCancels` sits next to `fallbacksReceived`, then `failedTakes`. All three are context columns that drill but never sort. The staff tab adds `failedTakes`, `failedTakeRate` and `refusedCloses` as context columns that drill and never rank. `STORE_RANK_FIELD.failedTakeRate = 'failedTakeRank'`. The rate formats as a percent. `isRate()` now does the drawer's rate check, so the `failedTakeRate` drill shows the Counted column.
- `columns.tsx`: header tooltips for the rate, fallback cancels and refused closes. The store card puts its six tiles at `md:grid-cols-3 xl:grid-cols-6`. The `.xlsx` export takes the new columns through `gridSheet` as they are shown.
- The en and ar locales have the ticket's labels and hints. The Arabic is the ticket's draft and **still needs review**.
- 714's drawer columns were not built. The four new figures already open the drawer.

Proof:
- `figures.test.ts`: 23/23 pass (10 were red first). The suite pins six ranked columns with `failedTakeRate` lower-is-better, a null rate last in both directions, the context columns never sorting, the column order, the drill figures, `failedTakeRank`, and the staff rate as context only.
- `tools/dispatch-scorecard-drive.mjs` (stubbed, section 14): 110/110 in LTR and RTL. A store with no wins reads "—" and sorts after the figures in both directions, never first. Refused closes is beside the rate. The three context headers don't sort. Each new figure drills for its store, and the rate's drill shows Counted. The card shows six measures, the sixth as sent. The staff tab shows the rate and failed takes with no direction and no sort, and a pre-3326 row reads "—".
- `typecheck` passes. `npm test` passes 599 files / 8450 tests. Four lint gates pass: grid-base, contrast, palette and controls. `check-boundaries` fails on 4 insurance-rules violations (`aliases/door-shapes.test.ts` importing `../fields` and `../labels`). The bare base `9daf8a54` has the same 4, so 713 didn't cause them.

Remaining: the live walk against the deployed door (BackOffice spec 3326 deployed with HQ SQL `Callouts/Sql/005`–`007` and `Sd/Sql/064` run), and an Arabic review of the drafts.
