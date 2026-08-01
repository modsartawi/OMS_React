# HITL — ticket 210 (`core` owns the latest-state guard)

## Q: Does `session-fault.ts` travel to `core/` with the latest-state guard? (the ticket's own open question)

**Decision taken:** Yes — moved to `src/core/engine-session/session-fault.ts`, suite and all.
**Why:** Decided by reading, not by symmetry: the frozen Nphies contract's error taxonomy names
**the same two codes with the same meanings and the same three closed reasons** —
`NOT_YOUR_SESSION` 403 ("belongs to another agent, hard stop") and `SESSION_CLOSED` 409
(`reason: submitted | abandoned | swept`). The module reads nothing call-centre-specific (only
`apiErrorCode` / `ApiError` from `@/core/api`); what IS feature-specific is *where a fault sends
the agent*, and that stayed in `CallCenterConsolePage`.
**Revisit if:** the Nphies session grows a third refusal code, or either contract re-means one of
the two — at that point the classification is no longer one rule and the Nphies session should own
its own fault mapping.

## Q: Where under `core/`, given `core/session.ts` already means the auth cookie?

**Decision taken:** `src/core/engine-session/`, with the two filenames unchanged
(`session-state.ts`, `session-fault.ts`) plus their suites.
**Why:** `CONTEXT.md`'s **Session** entry is the `sis_session` auth cookie, and spec 209 §13 flags
that collision explicitly. The folder disambiguates without renaming a file, so the suites travel
as `git mv`s and the diff stays a move. It matches the existing `core/bonus-buy/`,
`core/promotions/`, `core/auth/` grouping convention.
**Revisit if:** a third kind of session appears and `engine-session` stops being the whole of what
lives there.

## Q: Does the guard stay typed to the call-centre `SessionState`?

**Decision taken:** No — `applyState` became generic, `applyState<S extends VersionedSessionState>`
over `{ version, etag }`, returning `S`. No call site changed, no assertion changed.
**Why:** The ticket's stated purpose is that a second feature can hold an engine session without
importing another feature; a guard hard-typed to the call-centre projection would force ticket 217
to widen `core/` from a Nphies ticket. Both contracts' §2.1 read exactly two fields, so the
structural constraint is the rule's real shape. Behaviour is untouched — the body is byte-identical.
**Revisit if:** the ordering rule ever needs a third field (it would then belong on the interface,
not in a cast).

## Q: `CLIENT_CONTRACT_VERSION` is `'1.1'` (the call-centre contract); Nphies is `'1.0'`. Per-consumer expected version now?

**Decision taken:** No — left as the single constant, with a flag comment saying why it holds.
**Why:** Only the **major** is load-bearing and both contracts are major 1, so the check reads the
same for both today. Adding a speculative `expected` parameter is a behaviour surface the ticket's
Boundaries section forbids ("no behaviour change of any kind").
**Revisit if:** either contract goes to 2.x — that ticket makes it a per-consumer expectation.

## Q: The moved suite imported the call-centre `EMPTY_SESSION` fixture, which `core/` may not reach.

**Decision taken:** The guard's suite builds its own minimal fixture in `core/`; every assertion is
unchanged. The one block that was never about the guard — `describe('the open fixture')`, which
asserts the *call-centre payload's* shape — stayed in the feature, as
`src/features/callcenter/console/open-fixture.test.ts`.
**Why:** `core/ → feature` is an import-boundary violation the lint gate catches, and the block in
question tests `EMPTY_SESSION`, not `applyState`. Splitting on that line keeps the guard's
assertions literally unchanged (the ticket's requirement) instead of weakening them to fit.
**Revisit if:** a shared engine-session fixture is ever wanted in `core/` — then both suites could
draw on it.
