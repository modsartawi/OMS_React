---
status: open
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

- [ ] `composer can post only when non-empty, and Esc-back is refused while it holds unsent text` (a pure composer-state module) · pure
- [ ] `the add-note intent focuses the composer; reschedule and request-close still open their dialogs` (extends 401's intent tests) · pure
- [ ] `tools/document-composer-drive.mjs`: light, dark and RTL; N focuses, Ctrl+Enter posts (stubbed envelope) and the note joins the spine; Esc with text toasts and stays; Esc-Esc from a text box goes back to the list with the query and current row restored; R/C open their dialogs; a failed post shows inline · flow (Playwright)

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
