---
status: open
spec: 380
blocked-by: 388
---

# 390 — A dialog's own failure shows inside the dialog

Step S1 (Foundation) of [spec 380](380-ops-console-rebuild-spec.md). Spec decision **F18**. The
measurement and the rule are in [377](377-notifications-toasts-and-dialogs-in-the-ops-console.md)
§4.

## What to build

A native `showModal()` dialog sits in the browser's top layer, so a toast raised while it is open
paints **under its backdrop** and can't be reached (measured). The rule:

- **A failure of the dialog's own action renders inside the dialog** through `ErrorBanner`
  (`apiErrorMessage` / `apiErrorCode`, per the api-envelope rule), and **the dialog stays open**.
  `RescheduleDialog` and `CentralInvoiceDialog` already do this.
- **A success that closes the dialog may still toast**, because it fires as the dialog closes.
- **The Toaster stays at the root.** It is not portalled into dialogs.

**The work:**

1. **Fix the two known live offenders:**
   - `admin/ua-admin/SetPasswordModal` calls `notify.apiError` and stays open;
   - `collection/settlement/PostEntryDialog` calls `toast.error` and stays open.
2. **Audit every `Modal` user that toasts** (377 counted 18 of 37) against the rule. Fix each
   failure-while-open toast, and leave success-on-close toasts alone. Record the audit table (file →
   verdict) under `## Comments`.

## Spine reach

The dialog components found by the audit · drive. No new keys unless a dialog lacks an error banner
label.

## Proof (→ `tdd` red-green cycles)

- [ ] `tools/foundation-drive.mjs` (extend): with a stubbed `success:false` envelope, the UA
  set-password dialog and the settlement post-entry dialog each show the server message inside the
  open dialog, and no toast is raised while it is open · flow (Playwright)
- [ ] The same drive: a successful submit closes the dialog and its toast is reachable (hit-test on
  the toast's close button lands on the toast) · flow (Playwright)

## Boundaries

- Behaviour fixes inside existing dialogs only. No endpoint changes.
- Reuse existing error keys wherever possible.

## Done when

No `Modal` toasts its own failure while it is open, the audit table is recorded, and the drive passes.

## Blocked by

[388](388-overlays-share-one-recipe-and-toasts-sit-bottom-end.md)
