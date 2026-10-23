---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\2952-competed-delivery-callout-spec.md
blocked-by: — (live: BackOffice 2959, 2964)
---

# 541 — HQ watches the dispatch board and releases a locked delivery

## What to build

**The Dispatch board** for BackOffice spec 2952 (competed delivery callout: one delivery offered to the stores
around it, the first store to Take it wins). The spec's `## Comments` → "oms-react hand-off" is the brief; the
screen was prototyped and picked in BackOffice
`C:\Work\DMSCO\BackOffice\.issues\2950-the-oms-react-dispatch-visibility-screens.md` (`## Answer`, points 1, 4, 5),
prototype `C:\Work\DMSCO\BackOffice\.scratch\proto\2950-dispatch-visibility-screens\index.html` (board = variant A).
Words: callout, callout bid, Take, Pass, award, fallback, lock (BackOffice `CONTEXT.md` § Callout); never "offer"
(that is a promotion here).

- **Model** `core/models/dispatch-board.ts`, field for field from BackOffice
  `Sartawi.Retail.Data\Modules\Callouts\Delivery\DispatchBoardModels.cs`: `DispatchBoard { asOf, windowMinutes, tiles,
  open[], closed[] }`, the tiles, `DispatchCallout` (outcome `Open|Taken|FellBack|Withdrawn|NotCompeted`, `locked`,
  `secondsLeft`, the delivery's channel / type / city / district / value / line count, `bids[]`) and `DispatchBid`
  (store, status `OPEN|TAKEN|PASSED|LOST|EXPIRED|WITHDRAWN`, km, ATP known / covers / short lines, online / signed-in
  tills, `dark`, delivered / shown / opened / answered at + staff + register, `closedAt`, `ignoreReason`). Never-stamped
  dates arrive `null`. String unions plus `string`, so an unlisted value still parses.
- **Feature** `features/oms/dispatch-board/` (own i18n namespace, EN + AR), `api.ts`:
  - `GET DispatchBoard/Board?channel=&city=&store=` (Display 03);
  - `POST DispatchBoard/ReleaseLock` `{ deliveryNumber, reason, note? }` (Execute 06);
  - `GET DispatchBoard/Access` → `{ canOpenDispatchBoard, canReleaseLock }` (cookie-only probe).
- **Page** `/oms/dispatch-board`, the fleet-board shape: a tile row (on callout now + oldest age, bids awaiting an
  answer + how many at a dark store, taken in the last 60 min + median time to take, fell back, not competed,
  withdrawn); an **On callout now** grid with a live countdown; a **Closed · last 60 min** grid with the outcome;
  a **bid inspector** beside them, one row per bid. Filters channel, city / region, store, kept in the URL.
- **Polling:** 30 s `refetchInterval`, paused in a hidden tab (the sync-console pattern); a 1 s clock moves the
  countdowns between fetches; `asOf` shown.
- **Release lock** (inspector of a `locked` callout, only when `canReleaseLock`): a reason picker
  `NoStock | CustomerChange | StoreCannotFulfil | Other`, `Other` needs a note; refusals in the dialog:
  `CALLOUT-102` reason missing, `CALLOUT-103` note missing, `CALLOUT-104` not locked (already released / closed).
  One-way: no undo. After a release, a **Change store** link opens the delivery's Delivery details (the move is the
  existing `change-store` action; there is no move on the board).
- **Gate:** the menu leaf and a `ScreenGate` share the one `canOpenDispatchBoard` predicate and fail closed
  (BackOffice 2949's pattern). A bare 403 reads "You do not have access", never an empty board.

## Spine reach

model · api · logic (tile / countdown / outcome / inspector row views, release form validation) · route + menu +
gate + page · i18n EN + AR · test

## Proof (→ `tdd` red-green cycles)

- [x] view logic: an open callout's countdown from `secondsLeft` + the 1 s clock never goes below 0; each outcome
      gives its label; a bid row shows dark / ATP (covers · short n · unknown) / the four moments with seconds from
      offer; an unknown status still renders (vitest)
- [x] release form: no reason → blocked; `Other` without a note → blocked; each `CALLOUT-10x` maps to its message (vitest)
- [x] drive script, LTR and RTL, against a stub serving Board (open + closed + locked rows), Access (both flag
      combinations), ReleaseLock (ok and each refusal) and a bare 403: tiles, countdown, inspector, Release lock only
      with Execute, the Change store link after release, filters in the URL
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Doors: BackOffice 2959 (ReleaseLock) and 2964 (Board, Access), built and merged on `pricing2`; stubbed until
  deployed with the owner's SQL (`Modules/Sd/Sql/056`, `Modules/Callouts/Sql/001`) and
  `Seed-DispatchBoard-Screen-Authorization.sql`.
- No early hand-over or withdraw of an open callout (ruled out of scope in 2950).
- The delivery-type filter appears only once a second type is competed: not built now.

## Done when

The Proof boxes are ticked: on the running app (stubbed), the board polls, counts down, shows each bid's story, and an
Execute holder releases a locked delivery with a reason.

## Blocked by

— (live: BackOffice 2959, 2964 deployed)

## Open questions

- City / region: the board door filters on the delivery address's city (code or name); the scorecard (543) filters
  on the store's area. The owner has not ruled which reading is wanted; build to the door as it is.

## Comments

### Built (2026-10-23)

- **Shared core** (for 542): `core/models/dispatch-board.ts` (`DispatchBoard`, `DispatchCallout`, `DispatchBid`, the
  release request/answer, `RELEASE_REASONS`, `CALLOUT_LOCK_ERRORS`); `core/dispatch/access.ts` (the probe's key, query
  and the two predicates `canOpenDispatchBoard` / `canReleaseLock`, plus `dispatchApi.releaseLock`);
  `core/dispatch/release.ts` (form validation + `CALLOUT-102/103/104` refusal map); `core/dispatch/view.ts`
  (countdown, outcome / bid-status labels, ATP, a bid row's four moments with seconds from offer — 542's ledger rows
  can reuse `bidRow`); `core/dispatch/ReleaseLockDialog.tsx` (owns its mutation, speaks in `dispatch-board`, the
  `central-invoice` precedent).
- **Feature** `features/oms/dispatch-board/`: Page behind `ScreenGate`, tiles, two AG Grids, inspector, filters in
  the URL (`useUrlQuery`), 30 s poll (hidden tab paused by TanStack's default), 1 s clock. Menu leaf in the OMS group
  before Pick support, on the same key/predicate as the gate. EN + AR namespace `dispatch-board`.
- **Proof:** vitest 3 files / 52 tests (`core/dispatch/{release,view,access}.test.ts`,
  `features/oms/dispatch-board/board-view.test.ts`); `tools/dispatch-board-drive.mjs` **101/101** LTR + RTL
  (port 5201), **all stubbed** — no live SIS.Api; typecheck, lint, `npm test` (5828) green.

### Decisions (overrulable)

- **City / region** (open question): built to the door as it is — the board's `city` filter is the delivery
  address's city (code or name), a free-text field. Not reconciled with 543's store-area reading; owner to rule.
- Filters are three free-text fields applied together (Enter / Apply), not pick-lists: the door matches
  case-insensitively and there is no lookup door for channels / cities yet.
- The countdown counts from the client's receipt time of each read (`dataUpdatedAt`), not from `asOf`, so a server
  clock skew never moves it.
- The RTL pass is the direction only: the app's `lng` stays `en` until Arabic is switched on, so the AR bundle ships
  but the drive reads English words mirrored (the repo's existing RTL drives do the same).
- A bare 403 on the board door (probe said yes) shows the gate's "You do not have access" sentence in place of the
  board.

