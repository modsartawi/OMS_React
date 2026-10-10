# HITL log — ticket 448 (sync console commands: retry, connection test, re-push, cancel)

## Q: Contract drift — the envelope's error entries
**Decision taken:** Same as HITL-445/446/447: the drive stubs the REAL SIS.Api envelope `errors: [{ errorCode, errorMessage, internalErrorCode }]`, not the contract's abbreviated `{ code, message }`. Whole refusals are read only through `apiErrorCode` / `apiErrorMessage`; per-row `results[].error` / `perStore[].error` are read as plain code strings (`DUPLICATE_PENDING`, `NOT_ON_WORKER`, `NOT_PENDING`), as the contract says.
**Why:** `src/core/api.ts` is the one reader of the envelope.
**Revisit if:** BackOffice 2540 really ships `{ code, message }`.

## Q: Do Retry now and Test connection need a reason?
**Decision taken:** Yes. Both open the shared reason dialog. `POST ActionSync/Commands` carries `reason` in its body, and the prototype opens `reasonDlg` for both. Each dialog has a one-line note taken from the prototype, with its timings ("5 s timeout", "5 to 10 s") dropped, as 447 did.
**Why:** The contract's body requires a reason, and the server records it in the audit.
**Revisit if:** The owner wants a one-click connection test.

## Q: How long is the 41-day window — where does it start?
**Decision taken:** Today and the 40 days before it: on 2026-10-09 the earliest date is 2026-08-30. That is the prototype's own `min`. The bound is computed from today's LOCAL date (`rePushDateBounds`), and the date defaults to the window's start. A typed date outside the window is pulled back to it.
**Why:** The prototype states this exact bound, and the door clamps anyway and echoes the date it used (which is what the dialog shows).
**Revisit if:** BackOffice 2540 counts 41 days back from today (2026-08-29). The door's clamp makes that harmless, but the picker would then offer one day too few.

## Q: Where does the "chosen objects" list come from?
**Decision taken:** From the push counters (`bound: 'Out'`) of the FIRST store in the request (`GET ActionSync/Store/Counters`), shown as checkboxes. More than one may be ticked (the contract's `objectIds[]`). "All push objects" sends `objectIds: null` and is the default.
**Why:** No door lists push objects. Spec 2523 says counters are copied from the template, so every store's set should match. The prototype's hard-coded `OBJECTS` list is sample data.
**Revisit if:** Stores' push-object sets differ, or BackOffice adds a door that lists the objects. OWNER SIGN-OFF wanted.

## Contract gap: no door lists the push objects
**Decision taken:** Read them from the first store's Counters door (see above). No field was invented.
**Why:** The re-push body takes `objectIds`, but nothing in the contract enumerates them.
**Revisit if:** The contract gains an objects list.

## Q: Is the reason part of the preview's inputs?
**Decision taken:** No. A preview is invalidated by a change to the stores, the objects or the date, but not to the reason. Confirm posts the previewed stores, objects and date, with `preview: false` and the reason as it reads at Confirm. The reason must be filled before Preview, because the preview body carries it too.
**Why:** The counts don't depend on the reason, and the door may refuse a blank reason even on a preview.
**Revisit if:** The owner reads "the SAME inputs" as including the reason, or wants Preview without a reason.

## Q: The preview sentence when one store of a selection is refused
**Decision taken:** The sentence counts only the stores that will replay ("Replays N actions in total to 2 stores, from <echoed date>: P001 · 1,204, P003 · 2,204."). The refused stores are listed under it with their codes, through the same failure list as the controls. If only one store will replay, the sentence uses the single-store form. Confirm is offered when at least one store will replay. The plural follows the action count.
**Why:** The rule is one sentence for the counts plus a list of failures with their codes.
**Revisit if:** The owner wants refused stores counted in the sentence.

## Q: Bulk Re-push on a selection that holds WPF stores
**Decision taken:** Offered for any selection, as 447 does for its bulk controls. The preview already lists each WPF store as `NOT_ON_WORKER` before anything is queued.
**Why:** Same as 447's ruling: the door owns the host rules and answers row by row.
**Revisit if:** The owner reads story 13 as binding the bulk bar (see HITL-447).

## Q: What does the store page show while a command is followed?
**Decision taken:** One line under the controls:
- "Testing…" / "Retrying…" (spinner) while it runs;
- then "Connection OK" / "Retry done", or "… failed" plus the command's `result` (the worker's own words, as `<bdi>`);
- then "… still running. Follow it on the Commands page." after 60 s.

A newer command replaces the one being followed, and leaving the page stops the poll. When the door answers ok but names no `commandId`, a warning toast says there is nothing to follow. A refused command (e.g. `DUPLICATE_PENDING`) shows an error toast plus the failure list, and nothing is polled.
**Why:** The ticket says "testing…, then OK or the flattened error", and a timeout must never read as failed.
**Revisit if:** The owner wants the store's Commands tab opened instead (the prototype jumps to it).

## Q: A WPF store's connection test has no Commands tab to follow
**Decision taken:** The wording points at the Commands page (the fleet-wide `/admin/sync/commands`), not a tab. A WPF store keeps only Counters and Passes (446's ruling, unchanged).
**Why:** The wave says a WPF store gets Test connection AND only Counters and Passes.
**Revisit if:** The owner wants a Commands tab on WPF stores.

## Q: The Commands page and Commands tab
**Decision taken:** One shared `CommandsFeed`, paged by the door at 50, refreshed every 30 s and right after a command or a cancel. The Commands page filters on status, kind, batch and store code, applied on Search like the Audit page. A Pending row carries Cancel (only with `canOperate`), which asks for a reason. A `NOT_PENDING` refusal is listed with its code. The object and the from-date are their own columns, not folded into the Command cell as the prototype does: they are machine values, and separate columns isolate cleanly. "Commands" was added to the console page bar between Fleet and Audit.
**Why:** The prototype's `cmdTable` and `commandsPage`, adapted to the core grid and the bidi rule.
**Revisit if:** The owner wants the prototype's single "Re-push · ItemPrice from …" cell.

## Q: Shared 447 code touched
**Decision taken:**
- `ReasonDialog` gained `confirmDisabled` and `extraAction`, for re-push's Preview button.
- `ControlResults` takes any `OutcomeAction` (labelled by `auditActions.*`), has a "commands" title for Cancel, and its dismiss is optional.
- `resultSentence` takes a sentence group (`results` / `commandResults` / `cancelResults`), and the shared `notifyOutcome` picks the toast's tone.
- The dead `ResultSummary.sentenceKey` was removed.
- `StorePage` now keeps the controls mounted on the last known row when a 30 s refresh fails, so an open dialog or a followed command survives the failure. Header and health still hide, as 446 ruled.
- The 445/446/447 drives were updated for the new buttons and the filled Commands tab. The fleet drive now stubs the store page's reads in contract shape: its old `[]` stub broke the page the drive clicks into.
**Why:** The wave says to reuse the one reason dialog, cap and result summary, not to grow new ones.
**Revisit if:** —
