---
status: open
spec: 342
blocked-by: 346, 347
---

# 348 — A supervisor's own change or delete applies at once, and the form says so first

Builds against BackOffice 2194's `## Web contract` ("A supervisor's own request applies at once").

## What to build

For a supervisor with no request waiting, the pane's acts read **Change now** and **Delete now** (the
offer cells 343 already returns), and both forms say *"applies immediately — no approval step"* before
the press (W4, D8). The Reason is still required.

- **Applied is read from the answer, never the flag (W1).** On `accepted: true, requestStatus: "APPLIED"`
  the pane redraws the corrected entry (a delete: `entryStatus: "CANCELLED"`) and draws no waiting card;
  if a supervisor's raise ever comes back `requestStatus: "OPEN"` the card is drawn as for anyone.
- **Its refusals store nothing** (`changeRequestId: ''`): `BELOW_SPENT`, `DELETE_SPENT`, `ENTRY_FINAL`,
  `NO_CHANGE`, `CHANGE_STALE` are said through 344's map.
- **Blocked by an accountant's request** (story 22): a supervisor's raise refused `CHANGE_ALREADY_OPEN`
  opens the waiting request's card in the same pane, where 346's Approve / Reject decide it first.

## Spine reach

store/logic (outcome from `requestStatus`) · component (wording, applied redraw) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `raiseOutcome` — `APPLIED` ⇒ redraw with no card, `OPEN` ⇒ card, regardless of the supervision flag
  passed in · pure
- [ ] `settlement-change-drive` extended — supervisor sees Change now / Delete now and the
  "applies immediately" sentence; an `APPLIED` answer redraws the corrected (or cancelled) entry with no
  card; a `CHANGE_ALREADY_OPEN` answer opens the accountant's card with Approve / Reject · flow (drive)

## Boundaries

No new door. Words in `settlement` only.

## Done when

Both Proof items are green, typecheck + `npm test` pass, earlier drives unmodified and green.

## Blocked by

[346](346-a-supervisor-approves-or-rejects-a-waiting-request-beside-the-entrys-figures-today.md),
[347](347-an-accountant-requests-deleting-an-untouched-entry-and-a-spent-one-offers-reduce-it-instead.md)

## Open questions

- **The owner's ruling on a supervisor's own change while an accountant's request waits** (spec 342 Open
  Questions; BackOffice `.afk/REVIEW-2165.md` / `HITL-2168.md`). Today it is refused `CHANGE_ALREADY_OPEN`
  and this ticket points the supervisor at the waiting card. If the owner rules it supersedes instead, the
  refusal goes away and the form gains 352's supersede sentence — copy, not shape.
