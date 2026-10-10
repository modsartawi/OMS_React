---
status: open
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

- [ ] `deadLetterReasonLabel` / `deadLetterStageLabel`: every enum value gets a label; unknown
  values fall back (vitest).
- [ ] `storeTabs(row)`: Mirror present for every store; it shows not-on-mirror when
  `onMirror: false` (vitest).
- [ ] `tools/sync-console-store-drive.mjs` extended: the mirror block, the third strip line, the
  Mirror tab paging and filters, include-acknowledged, not-on-mirror. The existing assertions stay
  green.
- [ ] Gates green.

## Boundaries

oms-react only.

## Done when

The helpers and the extended drive are green.

## Blocked by

[456](456-the-fleet-page-shows-each-store-s-mirror-lane-and-the-mirror-workers.md) (the models)
