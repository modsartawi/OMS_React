---
status: done
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

- [x] `tools/foundation-drive.mjs` (extend): with a stubbed `success:false` envelope, the UA
  set-password dialog and the settlement post-entry dialog each show the server message inside the
  open dialog, and no toast is raised while it is open · flow (Playwright)
- [x] The same drive: a successful submit closes the dialog and its toast is reachable (hit-test on
  the toast's close button lands on the toast) · flow (Playwright)

## Boundaries

- Behaviour fixes inside existing dialogs only. No endpoint changes.
- Reuse existing error keys wherever possible.

## Done when

No `Modal` toasts its own failure while it is open, the audit table is recorded, and the drive passes.

## Blocked by

[388](388-overlays-share-one-recipe-and-toasts-sit-bottom-end.md)

## Comments

**Done 2026-10-03.**

**What was built:**
- Every `Modal` user that toasted its own failure while it stayed open now draws that failure inside the dialog with `ErrorBanner`, and the dialog stays open. Each banner carries exactly what the toast carried: the same title key where the toast had one, and `apiErrorMessage(err, fallback)`. No new keys.
- Each banner clears when its dialog opens and when a new attempt starts. The post-entry banner shows only on the review step and clears on Back. The bulk-upload banner clears on Back and on a new file.
- The core `ErrorBanner` now isolates its message in a `<bdi>` (dir auto). A server sentence moved out of a toast keeps its full stop at its end under RTL. This was the ErrorBanner flip 388 handed to this sweep.
- `return-dialog-drive.mjs` now asserts the refusal raises **no** toast; it used to assert the toast and the banner together.

**The audit.** `grep` finds 37 `core/ui/Modal` users. 19 of them mention a toast, against 377's 18; two of those mentions are only comments.

| File | What toasted | Verdict |
|---|---|---|
| `admin/ua-admin/SetPasswordModal` | failure (`notify.apiError`), dialog open | **Fixed** (named offender) → titled banner |
| `collection/settlement/PostEntryDialog` | failure (`toast.error`), dialog open on the review step | **Fixed** (named offender) → banner on the review step |
| `admin/ua-admin/NewIdentityModal` | failure, dialog open | **Fixed** |
| `admin/authz-admin/AddMemberModal` | failure, dialog open | **Fixed** |
| `admin/authz-admin/AssignRoleModal` | failure, dialog open | **Fixed** |
| `admin/authz-admin/BindGrantModal` | failure, dialog open | **Fixed** |
| `admin/authz-admin/EditRoleModal` | failure, dialog open | **Fixed** |
| `admin/authz-admin/NewRoleModal` | failure, dialog open | **Fixed** |
| `collection/settlement/ApprovalDialog` | generic failure, dialog open; a 403 toasts and closes | **Fixed** (failure); the 403 toast fires as it closes, left |
| `collection/settlement/BulkUploadDialog` | preview failure (error), commit refused over its rows (warning), dialog open | **Fixed** both |
| `collection/settlement/ChaseDialog` | a 200 refusal (warning) and a failure (error), dialog open | **Fixed** both |
| `collection/settlement/RepairDialog` | failure, dialog open; no-op / done / refusal toast and then close | **Fixed** (failure); the others fire as it closes |
| `oms/document/ReturnDialog` | a failure raised a toast **and** a banner | **Fixed**: the toast is gone, the banner stays |
| `pricing/coupons/CouponDetailPane` (3 modals) | failure, modal open | **Fixed** → banner in whichever modal is open |
| `pricing/coupons/ImportWorkspace` (preview modal) | queue failure, modal open | **Fixed**. The file-read toasts fire before the modal opens, and Retry is not in a modal: both left |
| `core/central-invoice/CentralInvoiceDialog` | a 403 toasts and closes | Compliant; failures already render in `ErrorBanner` |
| `loy/member/MemberCommandDialog` | only a comment | Compliant: refusals render in its `ErrorBanner`, and the four commands toast only on a success that closes |
| `nphies/authorizations/CancelDialog` | only a comment | Compliant: the page passes the refusal in, and success closes and then toasts |
| `admin/ua-admin/BulkCreateModal` | a success toast at the end of the run, dialog open | Failures are already in its banner. Success toast left: the rule covers failures, and the done panel says it too |

The other 18 `Modal` users never toast from inside the dialog. The document dialogs (`NoteDialog`, `RequestCloseDialog`, `RescheduleDialog`, `ChangeStoreDialog`) close on confirm, and only then does the page act and toast. `AttachmentWithdrawDialog`, `AssignmentUploadDialog`, `PeopleUploadDialog` and `DownloadDialogs` already use banners. The rest (`DetailModal`, `GroupingMembersModal`, `confirm.tsx`, `DeleteBlockedModal`, the call center's `AbandonConfirm`, `AddressPicker`, `CommandPalette`, `ConfirmSheet`, `RequestPicker`, and `SerialsDialog`) raise nothing.

Three dialogs still toast a success while they stay open beside their own success panel: `BulkCreateModal`, `BulkUploadDialog` and `PostEntryDialog`. They were left alone: the rule names failures, and the toast becomes reachable once the dialog closes, which the drive proves. Logged in `.afk/HITL-390.md`.

**Proof:**
- `DRIVE_ONLY=dialogs node tools/foundation-drive.mjs` passes 46/46 in light/dark × LTR/RTL, with every `/api/**` stubbed:
  - a `success:false` envelope on UA set-password and on settlement post-entry shows the server's sentence inside the open dialog;
  - no toast is counted once the answer has landed;
  - a successful set-password closes its dialog, and a hit-test at its toast's close button lands on the toast;
  - control: the post-entry success toast, raised while that dialog is still open, hit-tests as the DIALOG; after Close it hit-tests as the toast;
  - under RTL the banner keeps its full stop at its end, and stripping the isolate flips it.
- Red against HEAD: with the two named offenders restored, the same part fails 16 checks (24/40 at the time).
- Regression drives that drive the touched dialogs or `ErrorBanner`, all green:
  - `return-dialog` 105/105, `settlement` 291/291, `settlement-approval` 42/42, `settlement-change` 337/337;
  - `settlement-description` 41/41, `settlement-supervision` 41/41, `settlement-theft` 62/62;
  - `ua-channel` 17/17, `central-invoice` 65/65, `sim-states` 27/27, `assignment-upload` 58/58, `people-upload` 42/42.
- typecheck, `npm test` (172 files, 3170 tests), lint (all four gates; 148 contrast pairs) and build are green.

**Reviews:**
- `/code-review` (medium) found two stale banners, both fixed:
  - the bulk-upload banner survived Back and a new file;
  - the post-entry banner survived Back onto the form.
- `/standards-review` found **no hard violation** on either axis.
  - Standards (judgement calls): the error-state + `ErrorBanner` shape repeats across ~15 dialogs, in two styles (raw `unknown` in the admin and coupon dialogs, a formatted string in settlement).
    - A shared core `ApiErrorBanner` is deferred: the ticket is "behaviour fixes inside existing dialogs only", and the reset points differ per dialog.
    - Applied: `CouponDetailPane`'s element is renamed `failureBanner`.
    - Left: the authz/coupons fallback reuses the title key, so a non-`ApiError` would read the title twice.
    - Left: ua-admin borrows `bulk.unexpected`. Both reuse existing keys, per the boundary.
    - Left: `notify.apiError`'s `toast.dismiss()` on auth/network is gone from these paths. These dialogs no longer raise a toast to stack, and a 401 is `handle401`'s.
  - Spec: the post-entry half of Proof bullet 2 holds by construction rather than literally. That dialog does not close on success; it shows its posted panel. So the drive proves the toast is unreachable while it is open (the control) and reachable once Close is pressed. Whether to hold such success toasts until close (here, BulkUploadDialog, BulkCreateModal) is an owner ruling, logged in `.afk/HITL-390.md`.
  - Spec: the `ErrorBanner` `<bdi>` is accepted as 388's hand-on.

**Pre-existing, not this slice (failing identically with HEAD's `ErrorBanner`):**
- `loy-member-admin-drive` stops with 3 FAILs and a timeout at its stale-write scenario.
- `nphies-authorizations-drive` has 2 FAILs, one of them the nav-leaf check the new rail changed.
- The full foundation drive's 4 bell FAILs are a time drift: `BELL_NOW` is read at module load. `DRIVE_ONLY=bell` passes 106/106.

**Outstanding (owner):**
- The S1 live sign-off is at 391.
- The Arabic-rendering eye check needs a human.

