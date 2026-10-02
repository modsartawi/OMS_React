---
status: open
spec: 380
blocked-by: 398, 399
---

# 400 — An operator saves, defaults and manages their own views

## What to build

The views rail gains its **My views** section. A **Saved view** captures four things:

- the 14 `DeliveryFilterCriteria`, with the date range **relative** (from 399);
- the active **Lens**;
- the column state (order, width, visibility, pinning, sort);
- the AG Grid column filters.

**Applying a view runs its search.** Names are unique per user.

- **Storage.** Saved views are **per user**, in `localStorage` keyed by user id, parsed
  defensively. There are no shared views.
- **One-time import.** The existing views (`oms-web.delivery-grid-views`, layout-only, shared with
  the Angular app) are imported **once** into the signed-in user's store as **layout-only** views:
  no criteria, lens All, and a `layout` tag in the rail.
  - Applying one sets the layout, leaves the criteria alone and runs no search.
  - Re-saving one makes it a full view.
  - **The old key is never written or removed.**
- **The rail rows:**
  - a **star** marks the default;
  - a **`layout` tag** marks an imported view;
  - the **modified dot** shows on the active view once its criteria, lens, columns or grid filters
    drift from what was saved;
  - the active row takes the `--primary-050` + `--cursor` pair;
  - **+ Save current view** sits at the foot.
- **The ⋯ menu** (on hover or focus) holds:
  - **Update**, enabled only once the view has drifted;
  - **Save as new…**;
  - **Rename…**;
  - **Make/Remove default**;
  - **Delete**, with **undo from the toast** and no confirm dialog.
- **Default.** One starred default **applies and runs on page open** when there is no in-memory
  search. Returning from Details restores the in-memory search, never the default. Without a
  default, the list opens empty as today.
- **The grid bar** shows the active view's name and its modified dot.
- **Dialog.** The hand-rolled Save-view dialog in `ViewManager` (a `fixed` div with `bg-black/50`)
  moves onto core **`Modal`**. Its own failure (a duplicate name) renders **inside** the dialog.
- **Palette.** Each saved view joins This screen as an "Apply view: ‹name›" row with no key.

**Implements:** spec 380 **L3, L4, L5, L7** (the My views half), **L12** and **L17** (the views
half).

**Rulings:** [366](366-deliveries-views-and-their-counts.md) (saved view, ownership, import,
lifecycle), [368](368-the-deliveries-list-as-one-screen.md) §1 (My views) and §2 (palette rows), and
[377](377-notifications-toasts-and-dialogs-in-the-ops-console.md) (ViewManager → `Modal`; failures
in the dialog). Prototype: branch `prototype/368-deliveries-list` (`9b7f32c`), variant A, with
captures `A-modified.png` and `A-view-actions.png`.

## Spine reach

store/logic (a pure saved-view store: per-user key, parse, import-once, drift, unique names, default)
· component/route (the My views rail, the ⋯ menu, the `Modal` save dialog, delete + undo toast,
the default on open, the palette rows) · i18n (`deliveries:views.*`) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `savedViewStoreIsPerUserAndDefensive`: two users' views never mix, a malformed store reads as
  empty, and duplicate names are refused · pure
- [ ] `legacyLayoutViewsImportOnceAsLayoutOnly`: the old key's views import once as layout-only
  (lens All, no criteria) and are not re-imported on the next load. The old key is untouched · pure
- [ ] `viewDriftDetection`: changing criteria, lens, a column or a grid filter each sets
  "modified". Re-applying clears it · pure
- [ ] `tools/deliveries-list-drive.mjs`, extended. Save, star, reload: the default runs on open.
  Return from Details: the in-memory search wins. Delete, then undo from the toast, restores. An
  imported view applies layout only. "Apply view" from Ctrl+K works. The drive runs in light, dark
  and RTL · flow (Playwright)

## Boundaries

- No new API endpoint. No server store (out of scope per 366).
- New `deliveries:views.*` keys, including the undo toast.
- **The default view running on open is a behaviour change.** The operator lead must accept it at
  S3's sign-off (spec 380 R2).

## Done when

Operators save, default, update, rename and delete their own views. Legacy layouts import once, the
default runs on open, and the proof tests and the drive are green.

## Blocked by

- [398](398-lenses-narrow-the-loaded-rows-with-counts.md)
- [399](399-the-search-is-a-bar-of-tokens.md)

## Open questions

- The operator lead's acceptance of "the starred default runs on open" is owed at S3 sign-off. It is
  not a build blocker.
