---
status: open
spec: 083
blocked-by: 095
---

# 096 — theRebuiltScreenDrivesEndToEndInBothThemes

## What to build

The acceptance pass for the rework: the part no unit test reaches — that the arrangement *reads*
right, in both themes, and that the action bar's disabled-with-reason states behave.

**`tools/document-detail-drive.mjs`**, modelled directly on `tools/screen1-smoke.mjs` and
`tools/bby-inquiry-drive.mjs`, opens a real document and asserts:

- the identity band's big line is the document number;
- the pill rail's pill count matches the document (090's corpus table is the expectation);
- all four tabs — Items · Header Conditions · Log · Jobs — switch, and the operator's column widths
  and sort survive the switch;
- the summary rail unstacks **above** the work area below 900px;
- the terminal pair renders at the end of the bar, at cluster-button height, and goes disabled while a
  command is busy.

**Manual verification, in both themes**, covers what the drive cannot judge: the identity band's dark
ground against 082's dark page, the five cards on each of the five captured documents (which exercises
every collapse), the pill rail's colours, the items grid's selected row and pinned footer, and the
action bar at a width that forces the cluster group to wrap.

## Spine reach

tooling (Playwright drive) · manual verification across every region

## Proof (→ `tdd` red-green cycles)

- [ ] `documentDetailDrive` — `node tools/document-detail-drive.mjs` completes with every assertion
      above green against a live document · flow (Playwright)
- [ ] Manual both-theme pass on all five captured documents, findings recorded in this ticket's
      Comments · manual

## Boundaries

**Manual-run tool, not a CI gate** — it needs SIS.Api on `:5111`, exactly like its prior art
(`screen1-smoke.mjs`, `bby-inquiry-drive.mjs`). No source change is expected; any defect the pass
surfaces is fixed here if it is a one-line correction to a region already built, and filed as its own
ticket if it is not.

## Done when

`node tools/document-detail-drive.mjs` passes against a live document, and the both-theme manual pass
across all five captured documents is recorded with no outstanding arrangement defect.

## Blocked by

[095](095-rtl-mirroring-and-bidi.md) — and transitively every region ticket; there is nothing to drive
until the screen is whole.
