---
status: done
spec: 209
blocked-by: 211
---

# 212 — The eligibility list opens on the last 7 days and says so with a removable chip

## What to build

The eligibility list an agent lands on: **last 7 days, newest first, server-paged**, with the
window rendered as a **removable chip** rather than applied silently.

The chip is the point of the ticket. The underlying read is an unordered bulk take, and a silently
truncated list reads as *"that's everything"* — which is exactly the failure mode this screen
inherits if the window is invisible. Making the window a chip means the agent can see what they are
looking at and widen it deliberately.

Filters: **patient id, payer, provider, preauth reference, and the two status axes**. The provider
filter defaults to **all providers** — deliberately the opposite of the till, which is pinned to its
own store. Note that this means the provider filter does *not* narrow the underlying read; the date
window and the patient/status filters are what do.

This slice also introduces the **shared two-axis status module** — the derivation of Request and
Verdict from the raw fields — which [214](214-an-authorization-row-states-both-facts.md) reuses
unchanged. Both lists show the same pair, so an agent learns one vocabulary and not two.

## Spine reach

model/api (list request/response, paging + total) · store/logic (filter/query builder, the shared
status derivation) · component/route (`/nphies/eligibility`, the list) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `theDefaultWindowIsTheLastSevenDaysAndItIsRemovable` — the built query carries the window by
      default, and removing the chip drops it from the query rather than substituting a wider one ·
      pure → `src/features/nphies/eligibility/list-params.test.ts`. Removal asserts the **absence**
      of both bounds, not a wider pair. Also carries the review's off-by-one: the window is **seven
      calendar dates** (`today-6 … today`), asserted arithmetically — an eight-day span under the
      words "Last 7 days" is a small version of this ticket's own failure mode — and
      `isDefaultWindow` is what stops the chip keeping the phrase over a window since widened.
- [x] `emptyFiltersAreDroppedFromTheQuery` — a blank patient id or an unset status axis contributes
      nothing, matching the envelope helper's own contract · pure
      → same file, plus whitespace-is-blank, the page floor, and the two absences that are
      deliberate: no `sort` token (no vocabulary exists for one) and always `showAll: true`.
- [x] `bothStatusAxesFilterIndependently` — Request and Verdict narrow the query separately, and a
      Verdict filter with no Request filter is legal · pure → same file, all three combinations.
- [x] the list opens on 7 days, the chip removes the window, and paging moves through results ·
      flow (Playwright, extended `tools/nphies-eligibility-drive.mjs`) — RTL is not installed, so
      screen behaviour is verified by driving the app plus `typecheck`
      → **81/81 green** (41 from 211, 40 new): the default window in the query *and* in the chip, a
      row on the window's far edge, `showAll=true`, both axes rendering on stored rows with the
      qualifier inside the verdict badge and a **blank verdict on a Failed row carrying
      `isEligible:true`**, the chip's ✕ dropping the window, Next/Previous walking the pages with
      the window held, all five filters narrowing (each clearing back out of the query), a widened
      window **stating itself rather than "Last 7 days"**, Reset, the hidden leaf and in-page
      backstop, and a refused read surfacing the server's own message.
      ⚠ Against **mocked** `Nphies/EligibilityResponses` envelopes — SIS.Api is down and the
      re-modelled list is unbuilt. Stub rows carry **no `outcome`**, exactly as the table cannot.
      `npm test` 874 green (54 files), `typecheck`, `lint` and `build` clean.

## Boundaries

**Server dependency (SIS.Api):** the **re-modelled eligibility list** — sort, page and total over
the service's unordered bulk read. This is the only genuinely new logic in the proxy, and it is
this ticket's dependency rather than a passthrough.

Reuse the repo's existing AG Grid list screens as the precedent for columns, paging and the filter
panel; do not invent a new list shape here.

The status module lands in this feature but is written to be read by two features' lists — keep it
free of anything eligibility-specific so [214](214-an-authorization-row-states-both-facts.md)
takes it as-is.

## Done when

`/nphies/eligibility` opens on the last seven days with the window visible as a removable chip, all
five filters narrow the list, paging works, and both status columns render — drive green.

## Blocked by

[211](211-an-eligibility-check-answers-in-two-axes.md) — the area, namespace, nav group and access
probe must exist before a second route joins them.

## Comments

**Built 2026-08-02, unattended.** Fourteen decisions in `.afk/HITL-212.md`. `/nphies/eligibility` is
now the area's landing route and its nav leaf carries the `/nphies` active prefix; the check form
keeps its own exact route.

### The one thing this slice does NOT deliver

**The preauth-reference filter is not built, so "all five filters" is four plus the two axes.**
Contract §3.3's eligibility query is `providerCode · payerCode · patientId · fromDate · toDate ·
showAll · page · pageSize · sort` — **`preAuthRef` is on the authorization line only**, and upstream
`GetEligibilityResponses` has no field to match it against, because an eligibility check has no
preauthorization reference: no authorization has been raised yet. Building it would have meant
inventing a server parameter on the one ticket that warns hardest against it. It belongs to
[214](214-an-authorization-row-states-both-facts.md), whose endpoint really does take it. **This is a
ticket/spec correction, not an omission to fix later** — spec 209 §6 states the filter list once for
both lists and one of the two cannot honour it.

### Contract gaps found and named, not invented around

1. 🚩 **`NEligibility` has no `Outcome` column**, so no list row can carry the Request axis's raw
   source. `Outcome` is read off the live FHIR bundle (`EligibilityService.cs:670`) and never
   persisted. A stored row is read through a **second entry point**,
   `deriveStoredEligibilityAxes` — `success:false → Failed`, otherwise `Complete` — which defers to
   the live derivation if a row ever does carry an outcome. **The cost is real and named:** a
   `queued` check is stored as `Success = true` and reads `Complete` on the list though the check
   result that produced it read `Pending`. **`Pending` is therefore unreachable on this screen and
   its filter does not offer it.** §5 should state the eligibility-side *stored* sources, or the
   re-modelled list should project a `requestState`.
2. **The two status axes have no query parameters in §3.3.** They ship as `request=` / `verdict=`
   with the axis values as their vocabulary, because the Proof requires them to narrow the query
   independently and filtering 50 rows client-side would leave `total` describing a different set —
   the same class of lie as the invisible window. §3.3 should list them.
3. 🚩 **A removed chip sends no `fromDate`, and upstream defaults a null one to three days ago**
   (`:985`). SIS.Api's re-model **must** treat an absent bound as *no lower bound* rather than
   falling through — otherwise removing a seven-day window silently produces a four-day one, this
   ticket's own failure mode inverted. Named in the server's terms rather than papered over with a
   sentinel date, which would itself be a substituted window.

Also: `showAll=true` matters **more** here than on the authorization list the contract flags. Upstream
is `if (!showAll) Where(c => c.IsEligible)`, so without it the screen whose subject is what payers
said would show only the yeses — and the verdict filter would be narrowing a set the refusals had
already been removed from.

### Post-review corrections

Both reviews ran (correctness + standards/spec) and every finding was applied before this commit.
Four are worth carrying forward:

- 🚩 **The first cut flipped the *shared* no-outcome default from `pending` to `complete`, and that
  was wrong.** `FillResponse` sets `Outcome` only inside `if (eligibilityResponse != null)`
  (`:667-670`) while `eResponse.Success = true` is unconditional after it returns (`:277`) — so a
  bundle with no `CoverageEligibilityResponse` reaches that branch on a **live check**, and calling
  it `Complete` would publish a verdict for an answer the payer never gave. 211's derivation is
  untouched; the stored row got its own function instead. **214 must not "simplify" the two back
  into one.**
- **The chip must state the window it is actually showing.** Hard-coding "Last 7 days" over the
  applied window turned a widened range into a six-year result set labelled as a week — the chip
  telling the lie it exists to prevent.
- **With `keepPreviousData`, the criteria travel with the answer.** The query returns
  `{ criteria, page }`, so the chip, total, empty-state hint and pager all describe the read that is
  on screen rather than the one just requested. Otherwise a ✕ renders "showing every check on
  record" over the rows the window was still hiding.
- **The envelope's echoed `page`/`pageSize` are what the footer reads.** A server that clamps a page
  or caps the size would otherwise produce a footer that disagrees with the rows above it — and on a
  capped size, rows unreachable behind a disabled Next.
