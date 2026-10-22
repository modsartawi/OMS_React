# HITL log — ticket 536 (hand-made promotions)

## Q: Where does the success line ("3 assigned, 1 moved from X") show?
**Decision taken:** Inline under the promotion's actions (a status line, `data-promotion-done`), until the next write; Unassign and Rename get a line too. Create and Delete toast instead, because they leave the page.
**Why:** It is the only way to isolate each value with `Ltr` (a toast is a string sink), and it outlives a toast's 4 s.
**Revisit if:** The owner wants every write confirmed the same way (all toasts, or all inline).

## Q: Do Unassign and Delete ask before writing?
**Decision taken:** Yes. Each gets a small confirm dialog (`ConfirmWriteDialog`), and its refusal shows there.
**Why:** The ticket wants every refusal "in the dialog that made the call"; a bare button has no dialog to hold one.
**Revisit if:** The owner wants Unassign to fire straight from the toolbar.

## Q: Can a Pending campaign be picked in Assign?
**Decision taken:** No. Its checkbox is disabled, though it is still listed with its Pending badge.
**Why:** Per the brief, a Pending row is held only by a pending upload, so an upload owns it and HQ always answers RULES_PROMOTION_OWNED.
**Revisit if:** HQ ever lets a pending campaign be regrouped. Scope note: the spec review flagged this as unasked-for.

## Q: Do the Assign picks survive a new search?
**Decision taken:** Yes. The picks are kept as ids across searches and sent together; the cap is 2,000.
**Why:** It lets an author gather campaigns found under two searches into one all-or-none call.
**Revisit if:** Authors find hidden picks confusing. The footer counts them.

## Q: Do Unassign's ticks span pages?
**Decision taken:** No. Ticks are the current page's; a new page or filter starts with none.
**Why:** It is the simplest honest behaviour with 50 rows a page, and nothing is hidden.
**Revisit if:** Authors need to unassign more than a page at once (a select-all-matching would need HQ's help).

## Q: When is Delete enabled?
**Decision taken:** Only when known empty: `campaignCount` is 0 AND the unfiltered table total is 0. While the total is unread, Delete is disabled with no hint.
**Why:** The ticket says "enabled only when the promotion has no campaigns", and a pending upload's rows are not in `campaignCount`.
**Revisit if:** The table read is slow enough that Delete feels stuck.

## Q: Is the page refreshed after a refusal, too?
**Decision taken:** Yes. Every write dialog re-reads the promotions on success AND on refusal.
**Why:** NOT_EMPTY, OWNED and CAMPAIGN_NOT_FOUND mean the page is stale. The drive proves it: Delete is refused NOT_EMPTY, then the page shows the campaign that blocks it.
**Revisit if:** None expected.

## Q: Does Rename send exactly what the dialog shows?
**Decision taken:** It sends every field (never null), trimmed.
**Why:** HQ trims names and the note itself (`RulePromotionAuthoringService.NameOf`, `note.Trim()`), so the stored value is the same.
**Revisit if:** HQ stops trimming.

## Q: The 534 drive check 8 asserted "no New promotion yet (536)"
**Decision taken:** Re-cut to its lasting half: no promotion budget and no promotion-wide disable button. The check now sits beside 536's checks.
**Why:** 536 adds the very button that check said was absent; the rest of the check's meaning is unchanged.
**Revisit if:** None.

## Q: Port 5199 was taken
**Decision taken:** Ran this slice's vite on 5197 (`DRIVE_PORT=5197`). The server holding 5199 (PID 6388, started 09:50, serving an old build of another checkout) was left alone.
**Why:** The brief forbids killing a server this run did not start.
**Revisit if:** Someone wants 5199 back: that stale server can be stopped.

## Brief vs server code
No difference found: the create, update, assign, unassign and delete bodies and replies match `RulePromotionWebEndpoints.cs` / `RulePromotionAuthoringService.cs`. A refusal's detail lines come after the first error, under the same code (`RuleEndpointResults.Refused`).
