---
status: done
spec: 209
blocked-by: 220, 216
---

# 221 — Reopening a refused request replays it, and reports what did not come back

## What to build

The affordance on a `Failed` row that [215](215-a-row-offers-only-the-acts-its-state-permits.md)
rendered: **open the refusal**, and rebuild the request from what was actually submitted rather than
retyping it.

**A reopen is a replay, not a restore.** Drafts are not resumable and a refused request is terminal,
so the affordance opens a **fresh session** and replays the stored request through the verbs that
already exist — add item, change quantity, and the header and line setters. **No new session verb.**
It reaches the existing form route with the source authorization named in the URL.

**And it must not pretend to be silent.** An item may since have been blocked, or repriced, or lost
its category. A scan that refuses is not a failure of the replay — it is *the information the agent
needs*, and the screen reports what did not come back rather than quietly producing a request that
differs from the one being replayed. A silent restore here would be worse than no feature at all,
because the agent would resubmit believing they were resubmitting the same thing.

The prefill source is **the write-ahead journal row**, which already carries the whole request: it
is written on a fresh connection *before* the payer is called, so it survives refusal, rejection and
transport failure alike, and it is findable by the authorization id. **No new table, column or
write** — this is the path that costs nothing precisely because the submission recipe already
journals it.

That source also covers the case nothing else can: a request refused by the service's own guards
fails *before its lines are built*, leaving a header-only record that the ordinary response-by-id
cannot prefill from. The response-by-id remains the free fallback for rows the web did not raise.

## Spine reach

model/api (the journal-row read) · store/logic (the replay module: what is replayed, what is
reported as not-come-back) · component/route (`copyOf` on the existing form route, the report) ·
i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `everyLineThatDidNotComeBackIsReported` — a blocked item, a repriced one and a missing one are
      each named; the test fails if any is silently dropped · pure
      (`src/features/nphies/authorizations/replay.test.ts`)
- [x] `aHeaderOnlyRefusalStillPrefills` — the case where the request failed before its lines existed ·
      pure (same file)
- [x] `theReplayIsANewRequestNotAResumedOne` — a fresh session is opened; nothing reuses the
      terminal one · pure (same file; `replayVerbs` is asserted against §1.2's eleven)
- [x] a failed row reopens, replays, reports a refused item, and can be resubmitted · flow
      (`tools/nphies-authorization-session-drive.mjs` scenarios 39–44, **186/186 green** against a
      stubbed engine — SIS.Api is down and nothing on this door is built)

Also run: `npm test` 1075 green (20 new) · `npm run typecheck` · `npm run lint` (all three gates) ·
`npm run build` clean.

⚠ The drive was **already red at HEAD** on scenario 27 — `getByRole('checkbox').check()` races a
controlled checkbox whose state only flips when `setHeader` answers. Verified red before this
ticket's work and fixed as a one-line harness change (`.click()` + wait); the assertion that reads
the verb's body is unchanged. Logged in `.afk/HITL-221.md`.

## Boundaries

**Server dependency (SIS.Api):** one read — the journal row by authorization id. No new storage, and
**no Nphies-service change**.

**Depends on the list asking for refused rows** ([214](214-an-authorization-row-states-both-facts.md)) —
a reopen affordance on a row nobody can see is worth nothing, so if that flag was missed there, it
surfaces here.

Two things deliberately **not** built: parsing the stored exchange-format payload back into a form
(no such parser exists anywhere, and it would recover what is already held twice in flat form), and
a **View JSON** affordance, which was priced at about half a day and left out of v1.

One known gap in the fallback path: the per-line cap is stored but absent from the response model,
so a replay sourced from the fallback rather than the journal would drop that one override. Report
it if it happens; do not work around it.

## Done when

A `Failed` row reopens into a fresh request prefilled from what was submitted, including when the
refusal left no lines; anything that did not come back is named on screen; and the replayed request
can be corrected and submitted — drive green.

## Blocked by

- [220](220-a-refused-submit-keeps-the-agent-on-the-form.md) — there is nothing to replay until a
  request can be submitted and refused.
- [216](216-the-detail-shows-the-payers-reason-in-words.md) — the refusal's own detail is what the
  agent reads before deciding to reopen.
