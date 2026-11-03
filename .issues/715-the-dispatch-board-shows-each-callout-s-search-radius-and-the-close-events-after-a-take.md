---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3326-a-callout-widens-when-nobody-can-serve-and-a-failed-take-counts-against-the-taker-spec.md
blocked-by: —
---

# 715 — The dispatch board shows each callout's search radius, and the delivery's callout tab shows the closes after a take

## What to build

Backend: BackOffice spec 3326, branch `spec3326` (tip `24035f297`, now reachable from `pricing2`), tickets 3330, 3333. SIS.Api minimal APIs, System.Text.Json web defaults: camelCase fields, dictionary keys as sent.

Doors: `GET DispatchBoard/Board` and `GET SdDocumentWeb/Delivery/{no}/Callout`, which share `DispatchCallout`.
Server: `Sartawi.Retail.Data\Modules\Callouts\Delivery\DispatchBoardModels.cs`, `Callouts\Data\CalloutConstants.cs`.
Client: `src/core/models/dispatch-board.ts`, `src/core/models/delivery-callout.ts`, `src/core/dispatch/view.ts`,
`src/features/oms/dispatch-board/Inspector.tsx`.

New on `DispatchCallout` (not in the TS model today):

- `searchRadiusKm?: number`: the radius behind the callout's result. That is the type's radius, or its wider one when the
  search widened. **`0` = no radius search ran** (no GPS, dead serving list, no radius on the type, or an OTO coverage
  failure or empty answer). Stamped on opened and not-opened callouts alike. Optional, as 572 did: a callout read from a
  server not yet deployed has none, and shows no label.

New `CalloutEventKind`s for `CALLOUT_EVENT_KINDS` (the union is open, so today they render as raw codes). All are callout-level (`bidId` `''`):

- `StoreClosedAfterTake`: `staff` / `register` = the closer; `detail` = `"<outcome>"` or `"<outcome>: <pharmacist's note>"`.
- `CourierCancelledAfterTake`: `staff` = `Outbox`; `detail` = `"<outcome>: <courier's reason> (<courier>)"`, the reason and courier each omitted when absent.
- `OtherClosedAfterTake`: a close nobody scores (HQ, customer channel, system, our OTO auto-cancel, a holder that is not the winner).
- `CloseRefused`: the lock refused the holder's close; `detail` = `"CloseRefused"` or `"CloseRefused: <note>"`.

Show `detail` **as sent** (the courier's words), never reworded, and never "no stock".

**Board and Inspector.** Show the radius as a quiet label on the row and in the Inspector, beside the serving list and the
duty count: "Searched {km} km", or "No radius search" at `0`. The same label on the delivery's Callout sub-tab.

**Marking a widened delivery.** The door does not say whether a callout widened: it carries the radius used but not the
type's normal radius, and the board has no read of the type. **Open question → BackOffice ask:** add `widened: boolean`
(or the type's `calloutRadiusKm`) to `DispatchCallout`. Until it exists, show the radius label only. Do not guess the
normal radius on the client. With the field, mark a widened row "Widened to {km} km".

Labels (Arabic drafts, **to be reviewed**):

| Key | English | Arabic (draft, to review) |
|---|---|---|
| `inspector.searchRadius` | Searched {{km}} km | نطاق البحث {{km}} كم |
| `inspector.noRadiusSearch` | No radius search | لم يجرِ بحث بالنطاق |
| `inspector.widened` | Widened to {{km}} km | وُسّع إلى {{km}} كم |
| `event.StoreClosedAfterTake` | Store closed it after the take | أغلقه الفرع بعد الأخذ |
| `event.CourierCancelledAfterTake` | Courier cancelled it after the take | ألغاه المندوب بعد الأخذ |
| `event.OtherClosedAfterTake` | Closed by someone else after the take | أغلقه طرف آخر بعد الأخذ |
| `event.CloseRefused` | Close refused: the delivery is locked | رُفض الإغلاق: التوصيل مقفل |

## Proof

- [x] `view.ts` test: `0` reads "No radius search", absent shows nothing, `10` reads "Searched 10 km"
- [x] Stubbed board and Callout sub-tab drive, LTR and RTL, with the four event kinds and an Arabic courier reason shown as sent
- [ ] Live: the label reads against the deployed door

## Boundaries

No new grant: the same `DispatchBoard` gate.

## Done when

The board, the Inspector and the delivery's Callout sub-tab show the search radius and the four close events, against the deployed door. The widened marker is in only if BackOffice adds the field.

## Blocked by

BackOffice spec 3326 deployed, with HQ SQL `Callouts/Sql/005`–`007` and `Sd/Sql/064` run.

## Comments

**2026-11-03 — built on `impl/3326-715` (stubbed; live proof open).**

What was built:
- `DispatchCallout.searchRadiusKm?: number` (matches `DispatchBoardModels.cs` on pricing2, decimal → number, optional for a
  pre-3326 server). The four `CalloutEventKinds` (`StoreClosedAfterTake`, `CourierCancelledAfterTake`, `OtherClosedAfterTake`,
  `CloseRefused`) are added to `CALLOUT_EVENT_KINDS`, plus `CALLOUT_CLOSE_EVENT_KINDS`.
- `searchRadiusView` in `src/core/dispatch/view.ts` (pure): `> 0` → searched n km, `0` → no radius search, absent → `null` (no label).
- Board: a quiet **Radius** column on both grids (renderer, km an `Ltr` isolate). Inspector: the label beside the serving list and
  duty count, in `[data-inspector-serving]`. Callout sub-tab: the same label in the header beside serving list / duty.
- Callout sub-tab event log: the four close kinds read in words (`document:callout.event.*`); every other kind stays its raw code,
  as the log is for disputes. `detail` is shown as sent in a `<bdi>` (an Arabic courier reason untouched, never reworded).
- Locales en + ar (`dispatch-board`: `columns.radius`, `inspector.searchRadius`, `inspector.noRadiusSearch`; `document`:
  `callout.panel.searchRadius`, `callout.panel.noRadiusSearch`, `callout.event.*`). Arabic is the ticket's draft, **still to review**.
  The labels take the km through a `<n>` slot (`Searched <n>{{km}}</n> km`), not a bare `{{km}}`, so it is isolated.

Proof:
- `view.test.ts` — 4 new cases (10 → "10", 7.5 keeps decimals, 0 → none, absent → null), red then green.
- `tools/dispatch-board-drive.mjs` 128/128 LTR+RTL (row + inspector: 7.5 km, 0, older payload). 
- `tools/delivery-callout-drive.mjs` 112/112 LTR+RTL (case 8000000610: radius 10, the four kinds in words, details incl. an Arabic
  courier reason as sent; 0 on 8000000608; none on an older payload). Screenshot `tools/.delivery-callout-shots/*-715-closes.png`.
- Gates: typecheck green; `npm test` 599 files / 8449 tests green; lint gates grid-base, contrast, palette, controls green.
  `check-boundaries` fails on main already (`src/features/insurance-rules/aliases/door-shapes.test.ts` imports sibling
  features) — not this ticket's.

What remains:
- **Live**: the label against the deployed door (BackOffice spec 3326 deployed, HQ SQL `Callouts/Sql/005`–`007`, `Sd/Sql/064`).
- **BackOffice ask (not filed):** add `widened: boolean` (or the type's `calloutRadiusKm`) to `DispatchCallout` so the board can
  mark "Widened to {{km}} km". Not built: no field, and the client does not guess the normal radius. `inspector.widened` was not
  added to the locales (no consumer yet).
- The Activity spine still draws the four new kinds as its generic "Callout event <kind>" moment with the detail; words on the
  spine would be a small follow-up (four `CALLOUT_MOMENTS` kinds) if wanted.
