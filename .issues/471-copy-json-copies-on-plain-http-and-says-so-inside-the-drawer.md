---
status: done
spec: 470
blocked-by: —
---

# 471 — Copy JSON copies on plain http and says so inside the drawer

## What to build

**Copy JSON** in the receipt drawer (the View JSON side sheet on the store page's Transactions tab) has
two faults, and each is enough to make it look dead:

- On staging's plain http, `navigator.clipboard` does not exist, so the copy fails.
- Its success or failure toast renders beneath the drawer, which is a `showModal()` dialog in the
  browser's top layer.

The fix:

- **A core copy helper**, `copyText(text, { container? })`:
  - It uses the clipboard API when it exists and the page is a secure context.
  - Otherwise it selects a hidden textarea and calls `document.execCommand('copy')`.
  - It resolves to `copied` or `failed` and never throws.
  - The fallback textarea is appended to `container` when given. A modal dialog makes everything outside
    it unselectable, so a caller inside a dialog passes the dialog.
- **The drawer** calls the helper with itself as the container. It shows the outcome in a short status
  line next to the button ("Copied" / "Could not copy"), not as a toast. The line clears after a few
  seconds.
- **The two other copy buttons** switch to the helper, keeping their own feedback:
  - the central invoice retry list (a toast, not inside a dialog);
  - the retail invoice download dialog's attempt id (inline, inside a dialog, so it passes its dialog).

## Spine reach

core util · component (drawer + 2 call sites) · i18n (existing `transactionsTab.snapshot.copied` / `copyFailed`, now in-drawer) · test

## Proof (→ `tdd` red-green cycles)

- [x] `copyText` path choice, with an injected clipboard, secure-context flag and `execCommand`: the API path; the fallback when there is no API or the context is not secure; the fallback after the API rejects; `failed` when both fail · pure (vitest)
- [x] Store drive: on a plain-http origin (the drive's own `http://localhost` doesn't count, so stub `isSecureContext` false or remove `navigator.clipboard`), Copy JSON puts the pretty JSON on the clipboard, and the status line inside the drawer reads "Copied". A forced failure reads "Could not copy" · flow (Playwright)
- [x] The central invoice and retail invoice drives' existing copy assertions still pass · flow
- [x] Gates green: typecheck, lint, vitest, build.

## Boundaries

oms-react only, no door. `copyText` is `@/core/util`, the third and fourth consumers are features, so no
boundary crossing. Never log the copied text.

## Done when

Copy JSON copies on a non-secure origin and says so inside the drawer, and the helper's tests are green.

## Blocked by

None — can start immediately.

## Built (2026-10-12)

- `src/core/util/copy-text.ts` — `copyText(text, { container? }, env?)` resolves `'copied' | 'failed'`, never
  throws, never logs. Clipboard API only when present AND `isSecureContext`; otherwise (or after it rejects or
  throws) a hidden textarea appended to `container` (default `document.body`) + `execCommand('copy')`, removed
  afterwards and focus handed back. With no API the fallback runs synchronously, inside the click's user
  activation. The env is injectable; 8 vitest cases in `copy-text.test.ts`.
- `SnapshotDrawer` passes its own `<dialog>` and shows the outcome in a `role="status"` line beside Copy JSON
  (`text-success-800` / `text-danger-800`), cleared after 4 s; no toast. The existing `copied` / `copyFailed`
  keys now read "Copied" / "Could not copy".
- Central invoice retry list keeps its toasts; retail invoice attempt id keeps its inline check and passes its
  `closest('dialog')`.
- Proof: vitest 267 files / 4742 tests; `sync-console-store-drive` **307/307** (new section 20, both outcomes,
  on a forced plain-http page with `execCommand` stubbed to read the selection). 🚩 One existing assertion
  changed on purpose: section 19's "…and says so" reads the in-drawer status line instead of the toast the
  drawer no longer raises. `central-invoice-drive` 64/65 and `invoice-drive` 77/79 — the failures are the
  pre-existing baseline ones; every copy assertion green. Typecheck, lint (4 gates), build green.
- Outstanding (not AFK's): a human's eye on the drawer's status line on staging's plain http.
