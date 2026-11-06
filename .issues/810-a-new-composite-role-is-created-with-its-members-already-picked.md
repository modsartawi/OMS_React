---
status: done
spec: 805
blocked-by: 806
---

# 810 — A new composite role is created with its members already picked

## What to build

The **New role** dialog, when creating a composite, shows the checklist picker (local mode, single roles
only) so the admin picks the members up front. The picks go to `Roles/CreateComposite` in its existing
member list — **one** write, so the server creates the composite with all of them or refuses the whole
create; a refusal (name taken, nesting, unknown member) renders in the dialog as today and the picks are
kept. A composite created with no picks still works (members added later via 806's dialog).

## Spine reach

store/logic (reuses picker) · component (New role dialog) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `authz-batch-drive` New composite leg — create a composite with 4 picked singles → the stubbed `CreateComposite` body carries those 4, the new role's Members tab lists them; a stubbed refusal keeps the dialog and the picks · flow (Playwright)
  - Red: the leg timed out waiting for a picker in the dialog. Green: `driveNewComposite` 14 checks × LTR+RTL
    (singles only, one write with the 4 in pick order, refusal kept dialog + picks, retry closes and the
    Members tab lists the 4, a no-pick composite still creates empty); whole drive 62/62.

## Boundaries

Existing `Roles/CreateComposite` (already takes `memberSingleRoleNames`). New `authz-admin` keys. The batch
runner is not used here.

## Done when

A composite can be created with its members picked in the create dialog, and the drive leg passes.

## Blocked by

[806](806-a-composite-gets-many-member-roles-in-one-search-and-tick-batch.md)
