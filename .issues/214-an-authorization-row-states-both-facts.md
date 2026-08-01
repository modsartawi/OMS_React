---
status: done
spec: 209
blocked-by: 212
---

# 214 — An authorization row states whether we got an answer and what the payer said

## What to build

The authorizations list — the screen an agent lives on between raising a request and its verdict.

Same two axes as the eligibility list, from the module
[212](212-the-eligibility-list-opens-on-a-visible-window.md) built, reused unchanged: **Request**
(`Cancelled` · `Failed` · `Pending` · `Complete`) and **Verdict** (`Approved` · `Partly approved` ·
`Rejected` · `No approval needed`, blank until Complete). Same default window as a removable chip,
same filters, same server paging.

What is new here is the two **row markers**, which are neither axis:

- **Payer query.** The payer has asked a question, raised asynchronously — it can land on an
  authorization that already has both a Request state and a Verdict, which is exactly why it cannot
  be a value of either. It is **required, not decorative**: answering a payer query is out of v1, so
  such an authorization *stalls on the web* and the agent must be able to see that the row now needs
  the till application.
- **Dispensed.** The row's end of life, owned by the till.

**The row never asserts "ready to dispense."** The real predicate lives server-side and includes a
follow-up clause this list's data does not carry, so a browser copy could only lie on some rows. The
reader infers readiness from what is already visible: Complete, a good verdict, no dispensed marker.

**No browser polling.** The Nphies service already polls the exchange every 15 seconds, so a pending
authorization becomes complete on its own — the normal path to a verdict is waiting. A **Refresh**
button with the load time stated beside it, and no `refetchInterval` anywhere.

## Spine reach

model/api (auth list request/response) · store/logic (markers, the reused status derivation, the
filter builder) · component/route (`/nphies/authorizations`, second feature + namespace) · i18n ·
test

## Proof (→ `tdd` red-green cycles)

- [x] `aPayerQueryShowsOnACompletedRow` — the marker renders independently of both axes, including
      on a row that is `Complete` with a verdict · pure → `src/core/nphies/status.test.ts`. The
      markers are their own derivation (`authRowMarkers`), deliberately not reachable from
      `deriveAuthAxes`, which is what makes "neither axis" a seam rather than a comment. Also
      asserts the marker on all four Request states, and that **no `readyToDispense` exists** —
      `Object.keys` is exactly the two.
- [x] `theStatusModuleIsSharedNotCopied` — the auth verdict mapping goes through the same module as
      the eligibility one, with only its value set differing · pure → same file. Both derivations
      return the same `RequestState`, are painted by the same `requestSeverity`, obey §5's
      blank-until-Complete identically, and read the dual-meaning message field through the one
      `showsFailureMessage`. The verdicts are two exported vocabularies over one shape, with no
      member in common.
- [x] `refusedRowsAreRequested` — the built query asks for them explicitly; see Boundaries · pure
      → `src/features/nphies/authorizations/list-params.test.ts`. `showAll: true` on the opening
      criteria **and on every other read** (windowed, paged, both axes, every filter) — there is no
      state in which this screen wants the refusals gone, so there is nothing to toggle. Plus the
      two deliberate absences: no `claimType` (SIS.Api pins it) and no `sort`.
- [x] the list opens on the window, both markers render, Refresh restates the load time · flow
      (Playwright, new `tools/nphies-authorizations-drive.mjs`) — RTL is not installed, so screen
      behaviour is verified by driving the app plus `typecheck`
      → **63/63 green**: the default window in the query *and* in the chip, the far-edge row,
      `showAll=true` **with the refused row visibly on the list**, all four Request states and all
      four verdicts rendering, a **blank verdict on the Failed and Cancelled rows though both carry
      `adjudicationOutcome: 'approved'`**, the payer query on a row that is `Complete` *with* a
      verdict, the dispensed marker, both markers on one row, a row with neither, **no browser
      poll in 3.5 s of idling**, Refresh moving the load time, the chip's ✕ dropping the window,
      Next/Previous, all six filters (including the `preAuthRef` the eligibility list cannot
      have), both axes narrowing alone, Reset, a rejection rendering as data with no alert, the
      refused read surfacing the server's own message, the hidden leaf and the fail-closed probe.
      ⚠ Against **mocked** `Nphies/AuthResponses` envelopes — SIS.Api is down and the re-modelled
      list is unbuilt. `npm test` 921 green (56 files), `typecheck`, `lint` and `build` clean, and
      `tools/nphies-eligibility-drive.mjs` re-run **108/108** as the regression net over the code
      that moved into `core/`.

## Boundaries

**Server dependency (SIS.Api):** the **re-modelled authorization list** — sort, page and total.

🚩 **The list must ask for refused rows explicitly.** The service filters errored requests out by
default, so without that flag a refused authorization never appears — and
[221](221-reopening-replays-and-reports.md)'s reopen affordance on a row nobody can see is worth
nothing. This is the single easiest thing in the effort to get silently wrong.

Second feature and second i18n namespace under the existing `features/nphies/` area — register the
namespace centrally in the same change.

## Done when

`/nphies/authorizations` opens on the default window, shows both axes and both markers, filters and
pages, requests refused rows, and refreshes only when asked — drive green.

## Blocked by

[212](212-the-eligibility-list-opens-on-a-visible-window.md) — the shared status module and the list
conventions come from there.

## Comments

**Built 2026-08-02, unattended.** Twelve decisions in `.afk/HITL-214.md`.

### What "reused unchanged" actually cost

The ticket says the module 212 built is reused unchanged, and it is — `deriveEligibilityAxes` and
`deriveStoredEligibilityAxes` are untouched, including 212's warning that 214 must not "simplify"
the two eligibility entry points into one. But three *other* things 212 left inside the eligibility
feature had to graduate to `core/`, because a feature may never import another feature
(`.claude/rules/feature-structure.md`) and copying them would put one rule in two places:

- **`@/core/nphies/list-window.ts`** — the seven-day window, `isDefaultWindow` (the rule that stops
  a widened window still calling itself "Last 7 days"), `setWindowBound`, `putWindow` and the pager
  arithmetic. A second copy of the off-by-one is exactly the drift the chip exists to prevent.
- **`@/core/nphies/format.ts`** — `formatStamp`, plus `formatClock` for the new load-time readout.
- **`@/core/nphies/api.ts`** — the providers lookup joined the grant probe already there, on the
  **unchanged** `PROVIDERS_KEY`, so all three screens still share one cached call.
- **`@/core/nphies/ListPager.tsx`** — the footer, hoisted at review time; it was duplicated
  verbatim. Labels are props, so it adds no namespace of its own.

The window **chip's markup** is deliberately still written twice, one per namespace: the rule is
shared, the ~25 lines of JSX are not, and hoisting them would need either a third i18n namespace or
a component taking pre-rendered strings.

### The one thing this slice does NOT deliver

**No row links to a detail.** `/nphies/authorizations/:id` is [216](216-the-detail-shows-the-payers-reason-in-words.md)
and does not exist; an anchor to it today would fall through the router's catch-all to `/`. A dead
link is worse than a missing one, and [215](215-a-row-offers-only-the-acts-its-state-permits.md) is
the ticket that gives a row its acts.

### Two derivations that are load-bearing

- 🚩 **`Cancelled` outranks a stored `Complete`.** `CancellationService` sets `NAuth.Cancelled` on
  an authorization that already answered, so a cancelled row still carries
  `ClaimProcessingCodes = "Complete"` and an approval. Reading the outcome first would show a
  withdrawn request as live — and 215 offers Cancel on exactly the rows this branch removes.
- 🚩 **An unrecognised `AdjudicationOutcome` reads blank, never a nearby value.** Inventing
  `Approved` from a code we do not know is the one error on this screen that costs money.

Unlike the eligibility list there is **no second stored-row entry point**: `NAuth` really does
persist `ClaimProcessingCodes` (`NAuthMap.cs:36`), so one derivation reads a list row and 216's
detail alike.

### Contract gaps found and named, not invented around

1. **The two status axes still have no query parameters in §3.3**, here as on 212. They ship as
   `request=` / `verdict=` over the axis vocabularies; §3.3 should list both and both value sets.
2. 🚩 **A removed chip sends no `fromDate`, and upstream defaults a null one to three days ago**
   (`AuthService.cs:1384`) — 212's trap, in the same server ticket's other half. SIS.Api's re-model
   must treat an absent bound as *no lower bound*.
3. 🚩 **`AuthForListDto` carries no patient name**, so this list identifies a patient by id alone.
   §3.3 calls the projection "identity, both axes, `NeedComm` and `IsDispensed` as markers, and the
   timestamps" — worth stating that identity here is an id, or adding the name to the re-model.
4. **`preAuthRef` is matched by equality upstream** (`AuthService.cs:1374`), not by prefix. The
   screen promises nothing about matching, so a re-model that makes it a search needs no client
   change.

### Post-review corrections

Both axes were reviewed in-session (the unattended run bars spawning review sub-agents, so the two
passes ran with the full diff in context rather than in parallel). One finding was applied: the
pager component was duplicated verbatim between the two lists and is now
`@/core/nphies/ListPager.tsx`, with both drives re-run green over the change.
