# HITL — ticket 214 (an authorization row states both facts)

Unattended run, 2026-08-02. Every decision a human would normally weigh in on, the option taken,
and what would make it wrong.

---

## Q: `AuthForListDto` carries no patient name. Does the list show one?

**Decision taken:** No. The identity column is `patientId` alone.
**Why:** The DTO has `PatientId` and no name field of any kind (read at
`Features/Auth/AuthsDtos/AuthForListDto.cs:19`); the eligibility row's `patientName` comes from a
different projection. Inventing one would be inventing a server shape on the ticket that warns
hardest against it.
**Revisit if:** SIS.Api's re-model joins the name in — this is a candidate for the server ticket's
projection, since an agent reads names on the phone, not ids.

## Q: Does a row link to a detail?

**Decision taken:** No `Open` link. The list is columns only.
**Why:** `/nphies/authorizations/:id` is ticket 216 and does not exist; a link to it today would
fall through the router's catch-all to `/`. A dead link is worse than a missing one. 215 is the
ticket that adds the row's acts and 216 the detail behind them.
**Revisit if:** 216 lands before 215 — then the anchor goes on this list's first column, exactly as
212 did it.

## Q: `formatStamp` lived in the eligibility feature and this list needs it.

**Decision taken:** Moved to `@/core/nphies/format.ts`; the eligibility feature's copy deleted and
its two call sites re-pointed. Added `formatClock` there for the Refresh readout.
**Why:** `.claude/rules/feature-structure.md` — a feature may never import another feature, and
logic shared by two graduates UP to `core/`. Two copies would let the two lists disagree about the
same instant.
**Revisit if:** never; this is the rule's own remedy.

## Q: Same question for the seven-day window, the chip's `isDefaultWindow` rule and the pager.

**Decision taken:** Moved to `@/core/nphies/list-window.ts` — `NphiesListWindow`, `isoDate`,
`lastSevenDays`, `isDefaultWindow`, `setWindowBound`, `putWindow`, `pageCountFor`,
`pagerEnablement`, `NPHIES_PAGE_SIZE`, `DEFAULT_WINDOW_DAYS`. 212's `list-params.ts` now imports
them; its test imports them from core and still asserts the same arithmetic.
**Why:** The ticket says "same default window as a removable chip, same filters, same server
paging" — *reused*, not re-derived. A second copy of the off-by-one (seven calendar dates, not
eight) is precisely the drift the chip exists to prevent, and it would be invisible until someone
widened one list's window and not the other's.
**Revisit if:** the two lists' windows ever genuinely diverge — then the shared module takes the
span as an argument rather than being forked.

## Q: The providers lookup also lived in the eligibility feature.

**Decision taken:** Moved to `@/core/nphies/api.ts` as `nphiesLookupApi.providers()` with the
unchanged `PROVIDERS_KEY`.
**Why:** Third consumer (check form, eligibility list, authorization list), same boundary rule as
the grant probe already in that file. The key is unchanged deliberately, so all three screens still
share ONE cached call rather than three.
**Revisit if:** never.

## Q: The window chip's markup is now written twice (once per feature).

**Decision taken:** Duplicated the ~25 lines of JSX; shared the *rule* (`isDefaultWindow`) and the
window model.
**Why:** The rule is where a bug can hide — "Last 7 days" over a widened window is a lie, and that
decision is now made in one place. The markup is a namespace's worth of `t()` calls over its own
copy; hoisting it to `core/` would mean either a third i18n namespace or a component taking
pre-rendered strings, both of which cost more than they save.
**Revisit if:** a third list joins the area, or the chip grows behaviour beyond "state and remove".

## Q: Where do the two markers live — a derivation, or read straight off the row?

**Decision taken:** `authRowMarkers(row)` in `@/core/nphies/status`, returning
`{ payerQuery, dispensed }`, deliberately independent of `deriveAuthAxes`.
**Why:** It makes the ticket's first Proof bullet a pure test (`aPayerQueryShowsOnACompletedRow`) at
a seam rather than a screenshot, and it names in one place the thing §5 insists on: these are *not*
axis values, and nothing about the axes may gate them.
**Revisit if:** the markers ever acquire a third member — check it is really a marker and not the
`readyToDispense` §5 forbids.

## Q: What does the Verdict column do with an adjudication outcome it does not recognise?

**Decision taken:** Blank, same as a non-Complete row. It is **not** coerced to a nearby value.
**Why:** Inventing `Approved` from a code we do not know is the one error on this screen that costs
money. A blank cell says "nothing to report", which is true.
**Revisit if:** the exchange adds a fifth outcome — then it is a contract revision (§8, minor), and
the map gains an entry rather than the default changing.

## Q: `Cancelled` vs the stored `ClaimProcessingCodes`.

**Decision taken:** `Cancelled` outranks everything, then `Error`, then `Queued`, then the stored
code.
**Why:** `CancellationService` sets `NAuth.Cancelled = true` on an authorization that already
answered, so a cancelled row still carries `ClaimProcessingCodes = "Complete"` and an approval.
Reading the outcome first would show a withdrawn request as live — and 215 offers Cancel on exactly
the rows this branch removes. Asserted in `status.test.ts` and driven.
**Revisit if:** never.

## Q: The no-outcome default on an authorization row.

**Decision taken:** `Pending`, matching the eligibility side's live derivation — and **no** second
`deriveStoredAuthAxes` entry point.
**Why:** Unlike `NEligibility`, `NAuth` really does persist `ClaimProcessingCodes`
(`NAuthMap.cs:36`), so a stored row carries the Request axis's raw source and one derivation reads a
list row and a detail alike. The fallback branch is still reachable — `ProcessAddAuthRequest.cs:182-184`
has the three booleans commented out, so a just-submitted row can arrive with nothing — and in
flight is `Pending`, never `Failed` (law 6's posture, one act earlier). 212's warning that 214 must
not "simplify" the two eligibility entry points into one is respected: they are untouched.
**Revisit if:** SIS.Api's re-model projects a derived state instead of the raw columns.

## Q: The Refresh readout — what time does it show?

**Decision taken:** `Loaded at HH:MM:SS`, from TanStack Query's `dataUpdatedAt` (the instant the
rows on screen came back), time-of-day only.
**Why:** Story 76 asks for "the load time beside it" so the agent can judge staleness. The instant
the *answer* landed is the honest one — a click time would age differently from the rows. Seconds
are included because a refresh minutes apart is the exception; a date would be noise on a value
that is usually seconds old.
**Revisit if:** a row can be older than the read that fetched it (it cannot today).

## Q: The eligibility list leaf carried `activePrefix: '/nphies'`.

**Decision taken:** Narrowed to `/nphies/eligibility`; the new leaf takes `/nphies/authorizations`.
**Why:** An area-wide prefix would leave the eligibility leaf lit while an agent stands on the
authorizations list. Nothing regresses: the eligibility detail routes are under the narrower prefix
too, and the New-check leaf already co-highlighted under the old one. Driven.
**Revisit if:** never.

---

## Contract gaps found and named, not invented around

1. **The two status axes still have no query parameters in §3.3** — on this list as on 212's. They
   ship as `request=` / `verdict=` with the axis values as their vocabulary, because the Proof
   requires them to narrow the query independently and filtering 50 rows client-side would leave
   `total` describing a different set. The auth vocabulary is `approved · partlyApproved ·
   rejected · noApprovalNeeded` and `cancelled · failed · pending · complete`. §3.3 should list
   both parameters and both value sets.
2. 🚩 **A removed chip sends no `fromDate`, and upstream defaults a null one to three days ago**
   (`AuthService.cs:1384`) — the identical trap 212 named on the eligibility read, in the *same*
   server ticket's other half. SIS.Api's re-model **must** treat an absent bound as *no lower
   bound*, or removing a seven-day window silently produces a four-day one.
3. **`AuthForListDto` carries no patient name**, so this list cannot show one (first entry above).
   §3.3 says the row is "projected to what the grid shows: identity, both axes, `NeedComm` and
   `IsDispensed` as markers, and the timestamps" — worth stating that *identity* here is an id
   alone, or adding the name to the re-model.
4. **`AuthForListDto.PreAuthRef` is matched exactly upstream** (`AuthService.cs:1374`,
   `c.PreAuthRef == preAuthRef`), so the filter is an equality, not a contains. The screen offers a
   plain text box and says nothing about matching; if the re-model makes it a prefix search that is
   an improvement the client needs no change for.
