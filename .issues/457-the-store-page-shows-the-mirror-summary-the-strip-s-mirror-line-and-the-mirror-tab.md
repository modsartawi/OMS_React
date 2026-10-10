---
status: done
spec: 444
blocked-by: 456
---

# 457 — The store page shows the mirror summary, the strip's Mirror line and the Mirror tab

BackOffice spec 2563 (doors 2564, 2565, 2567, 2568).

## What to build

On `/admin/sync/store/:code`:

- **Header and health.** A mirror block showing:
  - reachability (connect ok / fail with error);
  - last pull / last good pull;
  - till backlog (count + oldest, "till clock");
  - inbox pending / deferred;
  - open dead letters;
  - the mirror state badges.
- **24 h strip.** A third line, Mirror, drawn from `Store/Hours` `mirror.cell`, using the existing
  `HourCell` legend. Hovering a cell shows the mirror counts.
- **Mirror tab** (from `Store/Mirror`):
  - counts by entity type (pending / deferred / dead letters);
  - the paged dead-letter list, with stage, reason, entity type and id, action, attempts, first and
    last seen, and the error (truncated, expandable);
  - filters for stage and reason, and an "include acknowledged" toggle. Acknowledged rows are shown
    muted, with who, when and why.

  The tab never renders or asks for a payload. There is none on the wire.
- A store with `onMirror: false` shows the tab as "not on mirror", with no requests made.

## Spine reach

UI → app (BackOffice read doors, stubbed)

## Proof (→ `tdd` red-green cycles)

- [x] `deadLetterReasonLabel` / `deadLetterStageLabel`: every enum value gets a label; unknown
  values fall back (vitest).
- [x] `storeTabs(row)`: Mirror present for every store; it shows not-on-mirror when
  `onMirror: false` (vitest).
- [x] `tools/sync-console-store-drive.mjs` extended: the mirror block, the third strip line, the
  Mirror tab paging and filters, include-acknowledged, not-on-mirror. The existing assertions stay
  green.
- [x] Gates green.

## Boundaries

oms-react only.

## Done when

The helpers and the extended drive are green.

## Blocked by

[456](456-the-fleet-page-shows-each-store-s-mirror-lane-and-the-mirror-workers.md) (the models)

## Comments

- 2026-10-10 (AFK): **done**. Every proof is stubbed: BackOffice 2564, 2565, 2567 and 2568 are not built yet.
  - **Mirror block** (`MirrorHealth`). It sits under the health, on every store, a WPF one included (ADR 0073). It shows:
    - reachability, with the connect error in `<bdi>`;
    - the last pull and the last good pull;
    - the till backlog: a `null` count reads "Never measured", which differs from 0, and its oldest time carries "till clock";
    - inbox pending and deferred, with the oldest deferred on the till clock;
    - open dead letters;
    - the door's mirror-set state badges.

    A store not on mirror reads "not on mirror", with no states.
  - **Strip.** A Mirror line from each hour's `mirror.cell`, on the same `hourCellLegend`. The hover is `fsi(formatPair(hour, reading))` followed by the mirror counts. The lines are labelled "Master and counter" and "Mirror". A store not on mirror shows a "Not on mirror" bar instead of cells. A WPF store on mirror draws the Mirror line alone.
  - **Mirror tab** (`MirrorTab`, `mirror-columns.tsx`, `Store/Mirror` via `storeMirrorQuery` under `storeTabKey`, so Refresh re-reads it):
    - the inbox by entity type;
    - the dead letters, paged by the server at 50 through `GridPager`;
    - the door's stage, reason and include-acknowledged filters (`mirrorQuery`);
    - acknowledged rows muted (`opacity-60` through `rowClassRules`), with who, when and why;
    - the error truncated in a `<bdi>`, with the whole error in a modal;
    - no payload anywhere.

    With `onMirror: false` the tab stays visible, shows the note and makes no request, Refresh included.
  - **Helpers:** `isOnMirror`, `deadLetterStageLabel` and `deadLetterReasonLabel` (through `codeBadge`; an unknown value shows its raw code), and `mirrorQuery`.
  - 🚩 **Existing assertions I changed on purpose:**
    - store drive check 3 (six tabs became seven, Mirror last);
    - check 7 (WPF: Counters, Passes, Mirror);
    - the two `storeTabs` vitest expectations.

    The ruling allows changing only the WPF one. Appending Mirror to `STORE_TABS`, as also ruled, makes the worker assertion fail, so it changed too. This is logged in HITL.
  - **Proof.**
    - `store-helpers.test.ts` green; `npm test` 253 files / 4520 tests; typecheck clean; lint 4/4; build green.
    - `sync-console-store-drive` **136/136** (was 68/68).
    - The fleet (72/72), controls (67/67), commands (69/69) and onboard (83/83) drives stay green unchanged.
  - **Outstanding, not mine:**
    - A human's eye on the mirror block, the strip's Mirror line and the Mirror tab (no prototype covers them).
    - The live walk (460).
  - **Rulings** are in `.afk/HITL-457.md` (not committed): the WPF Mirror line, the line labels, the error modal, muting by opacity, the reworded WPF note, all-`mute` stage and reason, "Poison" kept as the contract's reason word, and `includeAcknowledged` always sent.
