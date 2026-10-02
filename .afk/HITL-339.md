# HITL — ticket 339 (theft: post, decide, find)

Built against the `## Web contract` committed in BackOffice 2150 (`11e615be9`, worktree `BackOffice-2149`). Nothing in the BackOffice repo was touched.

## Q: The Theft tab — its own `Settlement/Ledger?status=OPEN&entryKind=THEFT` call, or the lane's one OPEN answer split three ways?
**Decision taken:** Split the one answer three ways (`buildTheftLane`). No fourth call.
**Why:** The contract lists both and warns to "split it THREE ways"; one answer is this screen's standing rule, so the three tab counts cannot describe three different estates.
**Revisit if:** approved thefts pile up. A theft is never consumed and never closed out, so every approved one stays in the `status=OPEN` answer until a supervisor cancels it, and it counts against the lane's 2,000-row cap that Shortage and Surplus share. A dedicated theft call would not fix that on its own (the OPEN answer would still carry them); the real fix is a server-side way to ask for OPEN without thefts. **This needs an owner / BackOffice ruling** — the spec reviewer raised it too.

## Q: The ticket says "the dialog says a theft always waits for a supervisor"; the contract says a supervisor's own theft does NOT wait (stored OPEN, self-approved). Which does the dialog say?
**Decision taken:** The note reads "A theft posted by an accountant always waits for an accountant supervisor's approval, whatever its amount." The review and confirmation sentences are true for both posters; the "waits" line on the confirmation is drawn only when the server answered `PENDING_APPROVAL`.
**Why:** The web cannot tell the supervisor something the server will contradict one click later.
**Revisit if:** the owner wants the unconditional "always waits" wording on the form regardless of who is posting.

## Q: The approval dialog opened from a BRANCH ACCOUNT has no day figures (the contract: they are "absent from `Settlement/Account` rows"). How does it show the variance?
**Decision taken:** For a theft opened from an account, the dialog reads the entry's own ledger row (`Settlement/Ledger?entryNumber=N`, an existing criterion) and shows its three figures. From the queue the figures are already on the row and no call is made.
**Why:** The ticket requires the variance in the approval dialog, and a supervisor can reach it from either place.
**Revisit if:** BackOffice adds the three figures to account rows — the lookup then never fires.

## Q: If that lookup fails, may the supervisor still approve?
**Decision taken:** Yes. The dialog says the day's cash could not be read (never "no variance") and leaves Approve and Reject enabled.
**Why:** The contract calls the variance "information only" and the amount is not capped by it.
**Revisit if:** finance wants approval blocked until the variance is on screen.

## Q: How is the variance worded? The wire's sign is "negative = short".
**Decision taken:** A word and an unsigned figure: "3,000.00 short — 500.00 counted against 3,500.00 of system cash" (also "over" and "No variance"). The figure is the server's `dayCashVariance`; the web subtracts nothing.
**Why:** A bare −3,000.00 beside an amount of 3,000.00 asks the reader to remember a sign convention while authorising.
**Revisit if:** finance wants the signed figure exactly as Cash Collections shows it.

## Q: Does an approved theft count in the account headline's "Entries open"?
**Decision taken:** No. It is in neither figure and not in "Entries open"; it is counted beside them ("1 approved theft is on this account. It moves no cash…").
**Why:** A theft never closes, so it would stand in "Entries open" for ever; the ticket rules it out of the headline figures.
**Revisit if:** the owner wants no theft line on the headline at all (it was not asked for).

## Q: Is the Theft tab counted on the front page's signpost ("Still open across the estate")?
**Decision taken:** No. The signpost keeps its two jobs, Shortage and Surplus.
**Why:** Nobody is rung about a theft and nothing on it is waiting to be collected or kept back.
**Revisit if:** supervisors want thefts visible from the front page.

## Q: What does the Theft tab list, beyond "theft entries with their day"?
**Decision taken:** Entry, branch, business day, amount, that day's cash (the variance sentence), description, posted by, served by. No age, no "still open", no chase, no total.
**Why:** The contract fills the day figures on a theft in any status; `remainingAmount` on a theft "means nothing" and is never drawn.
**Revisit if:** the extra columns are noise — each is one entry in `buildTheftColumns`.

## Q: Extras not named in the ticket
**Decision taken:** (1) the ledger grid gains a Business day column, shown only when the answer holds a theft; (2) the pending queue gains a Kind column (a theft says "for <day>" beneath it); (3) theft-specific sentences for the journal's empty state, the cancel reason and the rejected-next step.
**Why:** The queue now mixes two kinds whose approval means different things, and the existing sentences said "surplus" or "write off" about an entry that is neither.
**Revisit if:** any of these should go — all are additive.

## Q: Existing copy said "surplus" about the pending queue. Reworded?
**Decision taken:** Yes: "entries" instead of "surpluses" in the queue's subtitle, loading, cap, error and empty sentences, and on the account's pending count ("1 entry waits for a supervisor's approval"). `tools/settlement-approval-drive.mjs` was moved to the new wording (3 checks); `tools/settlement-drive.mjs` now expects three kinds on the post form (1 check).
**Why:** The same queue now returns pending thefts.
**Revisit if:** the generic "No till can see it until then" on a waiting entry reads wrongly for a theft (the spec reviewer noted it implies a till acts on approval; it was left, since an approved theft is listed at the till by BackOffice 2153).

## Q: An approved theft on the branch account — which correction is offered?
**Decision taken:** Cancel, to a supervisor only, and never a write-off — whatever `remainingAmount` says. An accountant sees the sentence naming the supervisor.
**Why:** Contract: CloseOut is refused for a theft (`WRONG_KIND`); a supervisor may cancel an approved one.
**Revisit if:** never, short of a contract change.

## Q: CONTEXT.md has no Theft entry (nor Shortage / Surplus — ticket 340 deferred the same thing).
**Decision taken:** Not added here.
**Why:** The glossary has no settlement section at all; writing one is a `/domain-modeling` job, as HITL-340 already recorded.
**Revisit if:** the owner wants it now — run `/domain-modeling` for Shortage, Surplus, Theft, Settlement Account, Description.

## Q: Port 5199 was already taken by a vite server this session did not start (PID 32600, started 17:21, this repo).
**Decision taken:** Left it alone. Started this session's own server on 5198 (`DRIVE_PORT=5198`) and killed only that one.
**Why:** The runner says to kill the server you started; that one was not mine.
**Revisit if:** the 17:21 server is a leftover from an earlier ticket of this run — it is still listening and should be stopped by hand.

## Note: the machine's network flapped during the drives
Chromium aborted in-flight loads with `net::ERR_NETWORK_CHANGED` in bursts (38 aborted requests in twelve page loads, none in the next twelve), which lands the app on the router's "Failed to fetch dynamically imported module" boundary. The new drive retries a navigation that Chromium itself aborted, and nothing else. The four older settlement drives have no such retry; they passed here, but can fail on this machine for that reason alone.

## Review findings not acted on (judgement calls)
- `kind === 'THEFT' ? '…Theft' : '…'` key selection recurs about eight times across the dialogs; a per-kind key map would be tidier.
- `POST_KINDS` and `LEDGER_KINDS` are the same three-kind list in two modules.
- `isStamped` lives in `approval.ts` but is now also read for the business day.
- The drive's stubs send `errors: []` on success where the contract sample shows `errors: null`; nothing reads it.
