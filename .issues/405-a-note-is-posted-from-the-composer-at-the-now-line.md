---
status: done
spec: 380
blocked-by: 404
---

# 405 — A note is posted from the composer at the Now line, and Delivery details is keyed

## What to build

The last S4 slice. Add note moves from a dialog to a **composer at the spine's Now line**, and
Delivery details gets its keys (spec 380 **D8**, **D10**; ruled in
[371](371-the-delivery-details-record-page.md) "Notes" and [365](365-keyboard-shortcuts-that-work-for-everyone.md) §6).

**The composer (D8):**

- **Add note posts from the composer.** This amends 083 D-11 **for Add note only**.
- **An empty composer cannot post.**
- The command bar's **Add note…** button focuses the composer rather than opening a dialog.
- **Cancel order, Force cancel and Request cancellation keep their notes inside their own dialogs**,
  so `pendingNote`'s ambiguity does not come back.
- On a successful post, the spine re-reads and the note appears as an event row.
- **A failed post shows inline** under the composer (`ErrorBanner` / `apiErrorMessage`), never as a
  bare string.

**Keys (D10), registered through `useCommands` with `keys`:**

| Key | Does |
|---|---|
| `N` | Focuses the composer. |
| `Ctrl+Enter` (in the composer) | Posts the note. This is the form's own submit. |
| `R` / `C` | Open Reschedule and Request cancellation through the command bar's gate. A refused one toasts its reason. |
| `Esc` | **Back to the list**, restoring its query and current row: history-back when we came from the list, otherwise `/oms/deliveries`. Esc inside a text box only blurs it, and a second Esc goes back. **It is refused while the composer holds unsent text**, with a toast. |
| `?` | Opens the help sheet. |

- **No J/K next/previous delivery** on details.
- The add-note intent from the list (401) now **focuses the composer**, not a dialog.

## Spine reach

api (today's add-note post via `buildUpdateHeader`) · logic (composer state: empty/unsent/posting) ·
component (composer at the Now line, Add note button) · keys (`useCommands`) · i18n (`document`) · test

## Proof (→ `tdd` red-green cycles)

- [x] `composer can post only when non-empty, and Esc-back is refused while it holds unsent text` (a pure composer-state module) · pure
- [x] `the add-note intent focuses the composer; reschedule and request-close still open their dialogs` (extends 401's intent tests) · pure
- [x] `tools/document-composer-drive.mjs`: light, dark and RTL; N focuses, Ctrl+Enter posts (stubbed envelope) and the note joins the spine; Esc with text toasts and stays; Esc-Esc from a text box goes back to the list with the query and current row restored; R/C open their dialogs; a failed post shows inline · flow (Playwright)

## Boundaries

- **No new endpoint.** It posts today's add-note body (`documentNo` + note).
- **Envelope:** a `success:false` business outcome shows its message and code inline. 401 is not
  handled here.
- **i18n (`document`):** `composer.placeholder`, `composer.post`, `composer.unsentRefusal` (toast),
  and the key-command labels for the help sheet.
- **Retires** `NoteDialog` for Add note only. Check the other note-carrying commands still use their
  dialogs.

## Done when

Notes post from the composer with N / Ctrl+Enter, Esc returns to the list unless a note is unsent,
R/C open their dialogs from the keyboard, and the drive is green. This closes S4 for the owner's
sign-off.

## Blocked by

- [404](404-facts-items-and-folded-conditions-sit-beside-the-spine.md) — the page arrangement the
  composer sits in

## Comments

**2026-10-04 — built AFK (ticket done; the owner's S4 sign-off is still open).**

- **What shipped.**
  - The composer sits on the spine's Now line (`NoteComposer.tsx`, set into
    `ActivitySpine`'s new `composer` slot). The page holds its text.
    - The pure `composer.ts` holds the state (`empty` / `unsent` / `posting`), `canPost` and
      `backRefusal`.
    - It posts today's add-note body (`documentNo` + the note, `DADN`/`OADN`/`XADN`) on the
      category's own endpoint, through a shared `updateFor` in the page.
    - Success clears the box and re-reads the spine. The note joins as the newest note row,
      and no toast is raised.
    - A failure shows inline (`ErrorBanner`: the message as `<bdi>`, the code as `Ltr`) and
      keeps the text.
    - The box is read-only while it posts.
    - A post that answers after a palette jump never touches the new record. A failure from
      it is toasted, naming its own record (`fsi`).
  - **The add-note path.**
    - Add Note…, `N`, the list's add-note intent and the palette row all focus the composer.
      `surfaceOf(kind)` in `commands.ts` is the one place that decides it.
    - `NoteDialog` now serves only Cancel order, Force cancel and Withdraw request. Its Add
      note branch and the `note.title`, `note.label` and `note.hintRequired` keys are gone.
  - **The keys.**
    - The pure `detail-keys.ts` builds the commands registered through `useCommands`:
      R / C through the bar's own gate (`commandGate`, now shared with the bar), N, and Esc.
    - Esc is refused while the composer is unsent or posting, with the
      `composer.unsentRefusal` toast. Esc in the box only blurs it, through the core key
      layer.
    - Letters bind only on the single-key route. On `/oms/document` they are palette rows
      with no key, and Esc stays. There is no J/K.
    - The bar's Reschedule, Request Cancellation and Add Note… carry "Label (R)" tooltips and
      `aria-keyshortcuts` (D3, 365 §9). The composer hints N, and Post hints Ctrl+Enter.
  - **Esc back to the list** uses history-back when the list opened the record. Every list
    route into Details now carries `{ from: 'list' }` (`fromListState` / `cameFromList` in
    `@/core/oms/open-intent`). Otherwise Esc goes to `/oms/deliveries`.
  - **Ctrl+Enter** is the composer form's own submit, not a registered page key (K5; 365 §6
    "the form's own submit"). It is therefore not in the `?` sheet. See HITL.
- **Proof.**
  - **`npm test`: 3513 passed.**
    - New `composer.test.ts`: posts only when non-empty, and Esc is refused while unsent or
      posting.
    - New `detail-keys.test.ts`: the keys, the gate and its reasons, and the add-note intent
      landing on the composer while reschedule and request-close land on their dialogs.
    - `open-intent.test.ts` adds `cameFromList`.
  - `tools/document-composer-drive.mjs`: **70/70** in light, dark and RTL, network stubbed at
    Playwright. It covers all the Proof items plus:
    - the R/C/N hints;
    - Ctrl+Enter on an empty box posting nothing;
    - C refused with a request open (toast);
    - `?` listing R, C, N and Esc;
    - Esc on a pasted link going to the list route;
    - the box locked while posting;
    - a mid-post palette jump;
    - the document route binding no letters;
    - RTL placement of Post and the Ctrl Enter hint;
    - no page errors.
  - **Drives updated for the retired Add note dialog, all green:**
    - `document-actions` 67/67;
    - `document-detail` 36/36;
    - `deliveries-list` 362/362;
    - `command-palette` 366/366 (its "inert under a dialog" now uses Reschedule's dialog).
  - **Re-run:**
    - `document-spine` 92/92, `document-header` 292/292, `document-facts` 240/240;
    - `document-items` 22/22, `document-cards` 45/45, `order-attachments` 243/243;
    - `return-dialog` 105/105, `grid-theme` 119/119;
    - `document-rtl` 52/53 and `foundation` 1294/1302, both at their recorded baselines.
  - Lint: four gates clean. Typecheck and build are green.
- **Reviews.**
  - **/code-review** found two bugs, both fixed and driven:
    - a successful post wiped text typed while it was posting (the box is now read-only
      while posting);
    - a post was not tied to its record across a palette jump.
  - **/standards-review** found no hard violations. Applied from it:
    - one endpoint helper (`updateFor`);
    - one gate (`commandGate`) shared by the bar and the keys;
    - the key hints moved into `detail-keys.ts` (`keyHints`);
    - one label per act: N reads "Add Note…", Esc reads "Back to Delivery Documents", and the
      `keys.*` copy is dropped.
  - **Logged in `.afk/HITL-405.md`:**
    - Ctrl+Enter is not in the sheet;
    - the chevron is not refused on unsent text;
    - a palette jump drops unsent text;
    - Esc is also on `/oms/document`.
- **Outstanding (not AFK):**
  - the owner's live S4 sign-off (402–405), including the HITL calls above;
  - a human eye on real Arabic copy;
  - a live SIS.Api post of an add-note.
