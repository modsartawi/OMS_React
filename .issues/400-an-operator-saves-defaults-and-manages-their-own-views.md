---
status: done
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

- [x] `savedViewStoreIsPerUserAndDefensive`: two users' views never mix, a malformed store reads as
  empty, and duplicate names are refused · pure
- [x] `legacyLayoutViewsImportOnceAsLayoutOnly`: the old key's views import once as layout-only
  (lens All, no criteria) and are not re-imported on the next load. The old key is untouched · pure
- [x] `viewDriftDetection`: changing criteria, lens, a column or a grid filter each sets
  "modified". Re-applying clears it · pure
- [x] `tools/deliveries-list-drive.mjs`, extended. Save, star, reload: the default runs on open.
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

## Comments

**Built 2026-10-03 (AFK).**

- **Pure module `saved-views.ts`.**
  - A **saved view** holds 399's `QueryCriteria` (the Date stays relative), the lens, the column
    state and the column filters. `query: null` marks a **layout-only** view.
  - The store lives in `localStorage` under `oms.deliveries.views.v1:<userId>`. No user means no
    store. It is parsed field by field: anything malformed reads as empty, and a repeated id, name
    or column is dropped, so the parse never throws.
  - `readViewStore` imports the old `oms-web.delivery-grid-views` layouts **once** as layout-only
    views (lens All) and records the import in the user's own key. The old key is only read. A
    clashing name takes a free " (n)" within the 60-character cap.
  - Lifecycle: `saveView`, `renameView` (refused `blank` / `taken` / `gone`), `updateView` (makes
    a layout-only view full), `toggleDefault` (one star), and `deleteView` + `restoreView` (Undo
    puts it back in place, with its star).
  - `viewDrift` compares criteria (through 399's `pendingDiff`), lens, columns and filters.
    Columns are compared only where both layouts name them, a flex column by its flex, and the
    grid's own layout stands in for a view saved before any grid mounted. A layout-only view
    drifts on its layout alone.
  - `opensOnDefault` decides "no in-memory search".
- **`view-store.ts`** is the thin zustand edge over `localStorage`. **`search-store.ts`** gains
  `activeViewId`, so returning from Details keeps the active view.
- **UI.**
  - **`MyViews.tsx`** is the rail's My views section. Rows show a star (`--primary`), the `layout`
    tag, and the modified dot (`--attention`) on the active view. The active row takes the
    `--primary-050` + `--cursor` pair, now shared with the lens rows through `ViewsRail`'s
    exports. The ⋯ menu shows on hover or focus, opens at the row's inline end, takes ↓/↑ and
    Esc, and holds Update, Save as new…, Rename…, Make/Remove default and Delete.
    **+ Save current view** sits at the foot.
  - **`ViewNameDialog.tsx`** is on core `Modal`. A taken name is refused inside the dialog.
  - Delete toasts with **Undo** and has no confirm.
  - The grid bar's heading is the active view's name and its dot.
  - `ViewManager.tsx` and `grid-views.ts` are deleted.
  - The rail is `z-20` so its menu opens over the grid.
- **Page.**
  - Applying a view sets its layout, resetting first. A full view then sets its criteria and lens
    and runs its search, superseding one in flight; an older answer that lands later is dropped.
  - The starred default applies and runs once per mount, when `opensOnDefault` holds.
  - Each saved view is an "Apply view: ‹name›" palette row, with no key.
- **i18n.** `deliveries:views.*` is rewritten. The undo toast is `views.deleted.undo`. CONTEXT.md's
  Saved view entry now names the default view and the layout-only view.
- **Proof.**
  - `saved-views.test.ts`: 33 tests. `npm test` passes 3445.
  - `tools/deliveries-list-drive.mjs`: 290/290 in light, dark, LTR and RTL, network stubbed. Its
    new `viewChecks` cover:
    - the import running once, never writing the old key;
    - the layout-only apply sending no request;
    - the Modal refusing a taken name inside itself with no toast;
    - Save capturing all four things;
    - the menu side under RTL, and Update gated on drift (lens and grid filter);
    - re-applying clearing the dot and searching;
    - the star;
    - the default running on reload;
    - Back from Details keeping the in-memory search;
    - Ctrl+K "Apply view";
    - Delete + Undo;
    - Rename;
    - re-saving an imported view as a full view.
  - Other drives updated for the removed ViewManager: command-palette 366/366, and foundation
    1294/1302 (its 8 pre-existing topbar and bell failures). grid-theme 125/125 and oms-access
    28/28 also pass. `screen1-smoke` needs a live SIS.Api login, so it was updated but not run.
  - Lint passes all four gates, with 166 contrast pairs. The new pairs are the star and the
    modified dot on both rail grounds. Typecheck and build are green.
- **Reviews.**
  - /code-review found 4 problems, all fixed:
    - a view applied mid-search ran nothing;
    - a layout was lost after a failed search;
    - a repeated column id threw;
    - a suffixed name over the cap was dropped on reload.
  - /standards-review found Update blocked on imported views (fixed). It also flagged the
    duplicated rail classes, the layout data clump, the dialog taking the whole store, the
    rename refusal reason and the stale CONTEXT entry (all fixed).
- **Outstanding (owner / operator lead):**
  - the S3 live sign-off, including a human eye on Arabic rendering;
  - the operator lead's acceptance that the starred default runs on open (R2).
  
  Neither blocks this ticket. The amber modified dot, the navy star and draft-vs-searched capture
  are logged for a ruling in `.afk/HITL-400.md`.
