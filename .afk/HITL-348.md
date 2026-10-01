# HITL log — ticket 348 (a supervisor's own change or delete applies at once, spec 342 W1/W4/D8, story 22)

## Q: What exactly does the "applies immediately" sentence say, and where?
**Decision taken:** "Applies immediately — no approval step. Entry N is changed / cancelled the moment you confirm below." — drawn above the submit button in both forms, only when the offer cell's mode is `now`. The Reason hint in `now` mode says it "is kept in the entry's history" instead of "the supervisor reads it before deciding".
**Why:** D8's wording verbatim as the lead; the old hint would be false for a supervisor's own act.
**Revisit if:** the owner wants D8's sentence alone, with no second clause or reworded hint.

## Q: Does a supervisor blocked by CHANGE_ALREADY_OPEN get a sentence beyond 344's refusal?
**Decision taken:** Yes. "Approve or reject it below first. Your own change or delete on entry N can be made once it is decided." It is said only when the card drawn is the request the refusal named (or, unnamed, whatever waits now) and only if this session has Approve / Reject on it and did not raise it (`decideFirst`, pure, tested).
**Why:** Story 22 ("told when my own change is blocked") and spec 342's open question ("tell the supervisor to decide the waiting request first").
**Revisit if:** the owner rules that a supervisor's own act supersedes the waiting request (the ticket's open question). The refusal then goes away, and 352's supersede sentence replaces this one.

## Q: The standards review flagged ~10 `mode === 'now'` ternaries in EntryChangeRequest.tsx (Repeated Switches). Collapse them now?
**Decision taken:** No. They are left as they are; the pattern predates 348, which adds two more.
**Why:** It is a judgement-call smell, not a rule breach, and a per-mode key map would touch 343/347's forms outside this ticket's reach.
**Revisit if:** 349 or 352 adds more mode-split copy. Fold them into one `keyFor(mode, base)` map then.
