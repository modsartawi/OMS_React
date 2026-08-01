---
status: done
spec: 209
blocked-by: 214
---

# 215 — A pending authorization can be status-checked or retried, and a completed undispensed one cancelled

## What to build

The acts on a row, and the rule that decides which ones it offers.

Acts are **state-driven and disabled with their reason on hover**, so the row teaches its own
vocabulary instead of the agent learning it by being refused:

| Request state | Acts offered |
|---|---|
| `Pending` | Status check · **Retry** |
| `Complete`, not dispensed | Cancel |
| `Complete`, dispensed | — |
| `Failed` | **Open the refusal** — the affordance lands in [221](221-reopening-replays-and-reports.md) |
| `Cancelled` | — |

**Retry belongs to `Pending`, not to `Failed`** — a correction of record this ticket must carry.
Retry re-POSTs the **stored request payload verbatim** and takes the newer answer, which means
*"ask again"*. That is meaningless for a request the exchange never accepted, and offering it there
would invite an agent to press it repeatedly on a request that can only be fixed on the form.

The server stays authoritative. These are affordances, not permissions: a refusal that arrives
anyway renders as a **business outcome** with its message, never as a crash — an authorization
already dispensed will be refused by the service for both retry and cancellation regardless of what
the row believed.

## Spine reach

model/api (status check, retry, cancellation) · store/logic (the row-acts module) ·
component/route (row act menu on the existing list) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `retryIsOfferedOnPendingAndNotOnFailed` — the correction, stated as an assertion so it cannot
      regress back to the original mapping · pure — `src/features/nphies/authorizations/row-acts.test.ts`
- [x] `everyWithheldActCarriesItsReason` — no act is ever merely absent or merely greyed; each
      unavailable act has a reason string · pure — and the drive re-asserts it over the whole
      rendered page (30 withheld acts, 0 unexplained)
- [x] `aDispensedAuthorizationOffersNothing` — both cancel and retry are withheld once dispensed ·
      pure
- [x] each act fires and its refusal renders as a message rather than an error · flow —
      `tools/nphies-authorizations-drive.mjs` scenarios 12–17, **94/94** against mocked envelopes
      (SIS.Api down; the three acts are BackOffice 916's half)

## Boundaries

**Server dependency (SIS.Api):** status check, retry, and cancellation passthroughs.

**Envelope handling:** a business refusal arrives as `success:false` with a code and must be
explained from that code per [api-envelope](../.claude/rules/api-envelope.md) — it is a designed
outcome, not an error. Do not collapse it into a generic failure toast.

The `Failed` row's act is *rendered* here so the table is complete, and *wired* in
[221](221-reopening-replays-and-reports.md). Until then it may be present and inert only if it says
so; a live-looking button that does nothing is worse than one that is disabled with a reason.

## Done when

Every row offers exactly the acts its state permits, each withheld act explains itself on hover, the
three acts fire, and a server refusal reads as a business outcome — drive green.

## Blocked by

[214](214-an-authorization-row-states-both-facts.md) — the rows and their state must exist first.

## What landed (2026-08-02)

`row-acts.ts` — a pure module in the **feature**, not `core/`: the authorizations feature is its only
consumer (216's detail is the same feature), and `core/nphies/status` is shared because two
*features* render the axes, which is not this situation. It returns **all four acts on every row**,
each `available` or withheld with one of **seven cause-scoped reasons** — the reason distinguishes
the states rather than repeating one sentence, because "unavailable" three times on one row teaches
nothing. The dispensed marker is read **before** the verdict: a dispensed row is `Complete` with a
good verdict, which is exactly the shape Cancel is offered on.

🚩 **The correction of record is asserted twice**, in the suite and in the drive: `Failed` does not
offer Retry, and its withheld reason names **the payload** ("asking again with the same details would
be refused the same way"), not the state.

🚩 **The bodies are the contract's, minus everything the server stamps.** Read from the Nphies
service's own source and from the parallel SIS.Api slice (BackOffice 916, on disk during this run):
`{ reference }` · `{ referenceId }` · `{ reference, reasonCode, nullify:false, providerCode }`. **No
`referenceType`, `storeCode`, `staffId` or `claimType` leaves the browser** — law 7 / §1.3 — and the
drive asserts the absences against the captured POST bodies, not against the click. `reference` is
the authorization **id** (`CancellationService.cs:108` matches `c.Id`), not the payer's preauth
reference. `nullify` is sent explicitly `false`: the upstream refuses a nullify and SIS.Api forwards
the flag as asked rather than downgrading it.

🚩 **Contract gap: §3.6 names `reasonCode` but no value set.** The cancel act opens a confirmation
whose reasons are **fetched** from `GET Nphies/CodeSystem?valueSet=TaskReasonCode` — the code reaches
NPHIES as the cancel task's `reasonCode` coding (`CancellationTaskEntry.cs:77`), so a constant would
put words in the agent's mouth on the record the payer keeps. Nothing is defaulted; with no reasons
the act cannot fire and says so. **§8 should name the value set.**

🚩 **Second gap: §3.8 does not freeze the lookups' envelope.** SIS.Api answers
`{ contractVersion, items }` (law 10 needs a model to carry the version); 214 read a bare array.
Both are unwrapped in **one** place (`unwrapLookup` in `core/nphies/api`), because reading only one
fails as an **empty picker with no error** on the day the endpoint lands. 214's `providers()` is
corrected here.

🚩 **A status check answering `success:false` is DATA**, not a failure — the upstream sets `Success`
only when the exchange's task came back `Completed`, so "still working on it" is the ordinary answer
of this act's own use case. It renders as the exchange's status; no error banner.

**Two review findings fixed, both about where a fact is readable.** The in-flight state lives
**above the grid**, never in the cell: a busy flag would travel through `columnDefs` and AG Grid
rebuilds every cell when those change, which measurably threw keyboard focus to `<body>` mid-act —
the drive now asserts focus survives. And a refused **cancellation** renders **inside** the dialog,
because `showModal()` puts the modal and its backdrop in the browser's top layer and a toast behind
it is painted under the scrim, unclickable — the one refusal (`AUTH_ALREADY_DISPENSED`) this act was
built to meet.

934 tests green (+13), drive **94/94**, eligibility drive re-run 108/108, lint + build clean.
Fourteen decisions in `.afk/HITL-215.md`.
