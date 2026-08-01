---
status: open
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

- [ ] `aPayerQueryShowsOnACompletedRow` — the marker renders independently of both axes, including
      on a row that is `Complete` with a verdict · pure
- [ ] `theStatusModuleIsSharedNotCopied` — the auth verdict mapping goes through the same module as
      the eligibility one, with only its value set differing · pure
- [ ] `refusedRowsAreRequested` — the built query asks for them explicitly; see Boundaries · pure
- [ ] the list opens on the window, both markers render, Refresh restates the load time · flow
      (Playwright, new `tools/nphies-authorizations-drive.mjs`)

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
