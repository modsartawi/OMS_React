# HITL — ticket 323 (finance withdraws a wrong slip)

Pre-flight: BackOffice 2034 and 2035 are both `status: done` on `pricing2` and both carry `## Web contract`.
I checked the contract against the code on pricing2:
- `AttachmentWebEndpoints.cs` (the Withdraw route and `AttachmentAccess(Categories, WithdrawCategories)`);
- `AttachmentWithdrawResult.cs` (400 `reasonCode` / `note`, 404 `NOT_FOUND`, 503 `NOT_SET_UP`);
- `AttachmentWithdrawGrantEndpointFilter.cs` (a bare 403, no body);
- `AttachmentWithdrawReasons.cs` (five codes, the same order and labels as ticket 323);
- `AttachmentWithdrawRequest.cs` (`{ reasonCode, note }`);
- `AttachmentService.WithdrawAsync` (the note is trimmed and then clamped to 200, and a withdrawn row comes back unchanged);
- `AttachmentMessages.cs`.

**No drift.** The drive stubs exactly those shapes and messages.

## Q: Where does the Withdraw action live — each list row, or the previewed slip?
**Decision taken:** Beside Download, in the preview header of the selected slip. It is not a second button in each list row.
**Why:** 321's drive picks a slip with `tr[data-slip].getByRole('button').click()`, and its probe grants `withdrawCategories`. A second button in the row fails that drive on Playwright's strict mode, and the ticket says 321's drive stays unchanged. It also means the accountant sees the slip before withdrawing it. The header shows even when the bytes fail, so an unreadable or lost file can still be withdrawn.
**Revisit if:** the owner wants Withdraw in every row without a preview first. That needs 321's drive to click the file-name button by name, a one-line change to it.

## Q: Does Withdraw also need the read grant (`categories`)?
**Decision taken:** Yes. `canWithdrawSlips = canSeeSlips(access) && holdsCategory(access.withdrawCategories, 'CASH_CLOSE')`.
**Why:** the drawer that carries the action only opens for a reader. The server only reports a withdraw category when read is held too (`WithdrawableCategoriesAsync` intersects the two), so this never hides the action from someone the server would admit.
**Revisit if:** the server ever reports withdraw without read. That would be a server bug, and the server's intersection says it will not.

## Q: How are the five reason labels spelled in the bundle?
**Decision taken:** One key per code under `slips.withdraw.reasons.<CODE>`. Each value is `"<English> · <Arabic>"`, with the U+00B7 separator that "Web · <uploadedBy>" uses. The English and the Arabic are copied byte for byte from ticket 323's table, and a vitest compares them against that table.
**Why:** the wave asks for both languages in the value, under their own keys. The separator matches the drawer's other "English beside" spelling.
**Revisit if:** the owner wants a different separator, or two keys per reason. Either is a bundle change only.

## Q: What happens after a closing answer (200 / 404 / 403)?
**Decision taken:** In every case the dialog closes and a line in the drawer says what happened:
- 200: "<file> was withdrawn…", in the success colour.
- 404: the drawer's sentence, with the server's bilingual message under it as sent.
- 403: "Your account may not withdraw slips…", and the action is gone for this drawer.

Only a new drawer reads the probe again.
**Why:** the ticket says "say so" for 404 and 403. For 200 the slip silently leaving a list is easy to miss, and the Withdrawn section is collapsed.
**Revisit if:** the owner prefers a toast. The wording waits on the owner's read like every new string.

## Q: What happens after a 503 `NOT_SET_UP` or a failure the contract does not name?
**Decision taken:**
- `NOT_SET_UP`: its message shows in the dialog and confirm stays disabled (no retry). Cancel closes the dialog.
- Anything unnamed (a network failure, a codeless 5xx, a coded 403 that is not the grant filter): its message shows and confirm stays live.

**Why:** the ticket says "no retry" for `NOT_SET_UP`. For the rest, pressing again is safe, because a repeat withdrawal answers 200 with the row unchanged.
**Revisit if:** the owner wants the transient failures refused too.

## Q: Does a 404 also mark the grids stale?
**Decision taken:** Yes, with `refetchType: 'none'`, the same as a 200. There is one helper, `markSlipDayChanged` in `api.ts`, which 322's store now uses too.
**Why:** a 404 on a slip the list still showed usually means someone else withdrew it, so the count is stale. Marking stale never reloads anything under the user.
**Revisit if:** never, unless the grids start auto-refreshing on stale.

## Q: Escape in the withdraw dialog, which sits inside the drawer's `<dialog>`
**Decision taken:**
- The drawer's `onCancel` now closes only on its own Escape (`e.target === ref.current`). React bubbles a `cancel` up the component tree, so the dialog's Escape used to close the drawer as well.
- The withdraw dialog catches a native `close` the browser forces on a repeated Escape: it shows the dialog again while the request is in flight, and otherwise tells React state it closed. /code-review found this second case.

**Why:** the drawer already guards itself the same way. `core/ui/Modal` does not, and changing core for every modal is out of this wave's scope.
**Revisit if:** a second modal needs the guard. `core/ui/Modal` should then learn the native `close` itself.
