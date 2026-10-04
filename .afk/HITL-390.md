# HITL log — ticket 390 (a dialog's own failure shows inside the dialog)

## Q: A SUCCESS toast that fires while its dialog stays open — fix it or leave it?
**Decision taken:** Left alone. Three dialogs keep themselves open on success with an in-dialog success panel and also toast: `ua-admin/BulkCreateModal` (done phase), `settlement/BulkUploadDialog` (committed panel), `settlement/PostEntryDialog` (posted panel). The toast is dimmed under the backdrop while the dialog is open and becomes reachable once it closes; the drive proves exactly that on PostEntryDialog (control: hit-test lands on the DIALOG while open, on the toast after Close).
**Why:** F18 and the ticket rule on failures ("fix each failure-while-open toast, leave success-on-close toasts alone"); success-while-open is not named, and the dialog already says the success itself.
**Revisit if:** the owner wants no toast at all raised under an open dialog — then defer those three toasts to the dialog's close.

## Q: What does a refusal that used to be a WARNING toast render as inside the dialog?
**Decision taken:** `ErrorBanner` (danger family), for ChaseDialog's 200-with-`accepted:false` refusal and BulkUploadDialog's commit refused over its rows.
**Why:** The ticket names `ErrorBanner` as the in-dialog surface; MemberCommandDialog and CancelDialog already draw business refusals with it.
**Revisit if:** the design wants refusals in the attention tone (the bulk dialog's own `refusal` notice is attention-toned) — a second banner variant would be a core change.

## Q: Which title / fallback does each new banner carry?
**Decision taken:** The banner carries exactly what the toast carried. Where the toast was `notify.apiError(title, err)` the banner is titled with the same key and its message is `apiErrorMessage(err, …)`; where it was `toast.error(apiErrorMessage(err, fallback))` the banner is untitled with that message. Fallbacks reuse existing keys (`ua-admin:bulk.unexpected`, `authz-admin:toast.failed`, `coupons:inquiry.actionFailed`, `coupons:import.submitFailed`). No new keys.
**Why:** "Reuse existing error keys wherever possible"; no copy decisions at 3am.
**Revisit if:** the owner wants a dialog-specific title (e.g. "Password not set") instead of the generic "Action failed".

## Q: ErrorBanner did not isolate its message — fix in core, or leave?
**Decision taken:** Fixed in core: `ErrorBanner` wraps its message in `<bdi>` (dir auto). Proven in the foundation drive under RTL with a strip-the-isolate control.
**Why:** Moving server sentences from toasts (388 gave them `unicode-bidi: plaintext`) into a banner that did not isolate would have regressed RTL; 388 explicitly handed "Deliveries' in-page ErrorBanner flips the stop under RTL" to the 390/391 sweep, and the bidi rule says server text takes `<bdi>`.
**Revisit if:** a banner message is ever a multi-line English + Arabic server sentence that must align per line — then per-line `unicode-bidi: plaintext` (the toast's guard) would suit better than one `<bdi>`.

## Q: The full foundation drive shows 4 FAILs in 389's bell part
**Decision taken:** Not fixed — not this slice. `BELL_NOW = Date.now()` is read at module load, so on a full run (several minutes) the bell part reaches "21 min ago" late and reads 22+. `DRIVE_ONLY=bell` alone passes 106/106.
**Why:** Another ticket's drive; a time-drift in a stub, not an app defect.
**Revisit if:** the full drive is ever run as a gate — compute the bell's timestamps when its part starts.
