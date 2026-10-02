---
status: open
spec: 380
blocked-by: 383, 384, 387, 389, 390
---

# 391 — The screens that are not reworked hold under the foundation

The last ticket of step S1 (Foundation) of [spec 380](380-ops-console-rebuild-spec.md). Spec
decisions **F29, R1, R2, R3**. The rollout ruling is
[361](361-how-the-ops-console-reaches-main.md).

## What to build

**The breakage sweep (R3, F29).** Walk every screen in the menu under the finished foundation (palette
B, Plex, 26px grids, rail shell, overlays, RTL) and fix **only what the foundation broke**:

- clipped heights under the 26px rows, 28px headers and 28px controls;
- contrast failures the gate can't see (literal colours on tokens, text on the rail);
- hard-coded widths and sizes that Plex's metrics disturb (truncation, wrapped buttons);
- the shipped `NoteField` textarea back to the 6px control radius (377);
- any leftover physical utility or literal pinned side found on the way.

There are **no layout redesigns, no shared page-header or toolbar adoption, and no new features**.
Shared pieces move into core only when the reworked screens need them (361). Record each screen's
verdict (clean / fixed: what) under `## Comments`.

**The S1 sign-off drive.** `tools/foundation-drive.mjs` (built up by 381–390) gains a pass that
visits every menu leaf in **light, dark and RTL** and captures each one. It asserts no page errors,
no clipped grid header, the rail's marker on the active leaf, and toasts at the inline end. The
captures go to `.issues/assets/391-shots/` for the owner.

**Sign-off (R2).** S1 is **one merge** to `main` (361 / R1). It merges only after **the owner signs
off S1 live in light, dark and RTL** against the Far prototype. Built unattended, this ticket closes
when the sweep and drive are done, and **owner sign-off is recorded separately** before the S1 merge.

## Spine reach

Any screen the sweep touches (styling only) · drive · captures.

## Proof (→ `tdd` red-green cycles)

- [ ] `tools/foundation-drive.mjs --all-screens` visits every granted menu leaf in light, dark and
  RTL with no page error and no clipped grid header · flow (Playwright)
- [ ] `npm run lint`, `typecheck`, `test` and `build` are all green on the finished S1 · gates

## Boundaries

- Styling fixes only. No i18n keys unless a fix replaces a literal it uncovers.
- No endpoints.

## Done when

Every screen's verdict is recorded, the all-screens drive passes in light, dark and RTL with
captures saved, and all gates are green. S1 is then ready for the owner's sign-off.

## Blocked by

[383](383-every-grid-mirrors-under-rtl-and-isolates-its-values.md),
[384](384-ranges-pairs-and-server-text-read-right-in-rtl.md),
[387](387-below-1280-the-rail-overlays-below-640-a-drawer.md),
[389](389-the-bell-opens-a-dense-dropdown.md),
[390](390-a-dialogs-own-failure-shows-inside-the-dialog.md)

## Open questions

- **Owner sign-off of S1** (light, dark and RTL, live) is owed **before** S1 merges to `main`. It is
  not a blocker for closing this ticket in the worktree.
