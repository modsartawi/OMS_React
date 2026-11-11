---
status: done
spec: 734
blocked-by: 735
---

# 737 — Copilot follow-ups keep their context, and every refusal reads plainly

## What to build

Spec 734 D5 and D7.

**Follow-ups:**
- A follow-up question sends the answer's `conversationId`, so the server answers in context.
- The panel shows the conversation as a thread, numbered by `questionNo`.
- "New conversation" clears the thread and drops the id.
- At question 10, or on `COPILOT-406`, the panel offers a new conversation instead of the box.

**Refusals.** Each refusal shows its own message, never a raw code:

| Code | What the panel shows |
|---|---|
| `COPILOT-401` | no grant |
| `COPILOT-402` | the rate limit, with the reset time as an `Ltr` value |
| `COPILOT-403` | "looks like personal data — remove it and ask again" |
| `COPILOT-404` | the AI service is unreachable |
| `COPILOT-405` | the question is too long |
| `COPILOT-406` | the conversation has expired or is full |

- An unknown code shows the server's message through `apiErrorMessage`.
- An answer whose outcome is `cannot-answer` is styled as such, not as an error.

## Spine reach

logic (conversation state, refusal → key map) · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `copilotConversation_keepsIdUntilNewOrFull`: the id is kept across answers, cleared by "new",
  and the box is replaced at 10 or on 406 · pure
- [x] `copilotRefusal_mapsEveryCodeAndFallsBack`: every code maps to its key, and an unknown code
  falls back to the server's message · pure
- [x] `copilot-drive: follow-up-and-refusals`: covers all of:
  - a follow-up posts the id;
  - "new" drops it;
  - each code renders its message;
  - the panel in Arabic RTL with an English answer;
  · flow

## Boundaries

Refusal codes come from the D7 table; there are no new doors. A 401 session expiry stays with
`core/api` (`handle401`).

## Done when

Both pure tests and the drive scenario are green.

## Blocked by

- [735](735-a-permitted-user-asks-the-oms-a-question-and-reads-the-answer.md)

## Resolution

Built 2026-11-03 on `spec/734-ask-the-oms` (commit 1cba773c; review fixes in ed0e3911). All proofs pass against stubbed envelopes; the live walk is [740](740-ask-the-oms-and-the-sourcing-advisor-work-live-on-staging.md). Drives: copilot 177/177, sourcing advisor 100/100; 8,536 unit tests pass; lint shows only the 4 boundary violations already on main (insurance-rules aliases).
