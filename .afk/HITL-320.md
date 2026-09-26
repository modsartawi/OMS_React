# HITL — ticket 320 (Ready and Cash Collections show each store day's slip count)

Pre-flight: BackOffice 2034 and 2035 are both `status: done` on `pricing2` and both carry `## Web contract`.
Contract vs code (CollectionReadyRowModel.cs, CollectionInquiryModel.cs, SlipCountedResponse.cs,
AttachmentWebEndpoints.cs, CollectionWebEndpoints.cs on pricing2): **no drift**.

## Q: The core read's name and shape (ticket 320's open question)
**Decision taken:** `api.getEnvelope<T, S extends object>(path, params?, headers?) → Promise<ApiEnvelope<T, S>>`, where `ApiEnvelope<T, S> = HttpGeneralResponse<T> & Partial<S>`. `request` now delegates to one shared `requestEnvelope`, so `get` and `getEnvelope` cannot disagree about a refusal.
**Why:** it is generic over the siblings, so `core/` never names `slipCountsUnavailable` or `withdrawn`. `Partial<S>` because core checks `success` and nothing else, and an older server omits a sibling.
**Revisit if:** 321's ByOwner read wants a different shape than `{ data, withdrawn? }` off the same call.

## Q: Should the "Slip counts unavailable" banner show when the probe hides the column?
**Decision taken:** No. The banner shows only when the probe admits (`showSlips && slipCountsUnavailable === true`).
**Why:** the spec says every slip surface stays hidden under a refused probe (503 NOT_SET_UP). A banner about a column the session cannot see would be noise.
**Revisit if:** the owner wants the banner while the probe is still pending. Today it appears only once the probe answers yes.

## Q: Does the Slips count go into the Cash Collections CSV export?
**Decision taken:** No. `slipCount` is in its own `SLIP_FIELDS` group, and the export still writes `DEFAULT_FIELDS ∪ MORE_FIELDS` unchanged. The completeness proof counts the new group.
**Why:** the export writes its union regardless of any toggle, so a count the session may not see must not leave in its file. The ticket also asks for no export change.
**Revisit if:** finance wants the count in the file. It would have to follow the probe as well.

## Q: Where does Ready's Card total sit?
**Decision taken:** At the end of the landing set, after Days Waiting, with Slips right after it.
**Why:** it is the figure a missing slip is checked against, so the two read as one group. The unmodified `ready-drive` also asserts the first ten headers in order, and the wave says old drives pass unmodified.
**Revisit if:** the owner wants Card total beside the other money columns. Then `ready-drive`'s header list would need its one-line update.

## Q: Where does the `cardTotal` header key live, given "one new slips group"?
**Decision taken:** `ready.columns.cardTotal` ("Card Total", the same wording as Collections' header). All four slip keys are in the new `slips` group.
**Why:** the generic Ready column builder reads `ready.columns.<field>`, and Card total is a Ready wire column, not a slip string.
**Revisit if:** the owner reads "one slips group" as covering every key this wave adds.

## Q: What does a "No slip" filter with no matching rows show?
**Decision taken:** The grid stays mounted, and AG Grid's own "No Rows To Show" overlay appears. This is the same thing the floating filter row already shows today. There is no `localeText` anywhere in `src`.
**Why:** unmounting the grid would drop its sort, column filters and export handle. Localising AG Grid's overlay is an app-wide change across every grid, not this ticket's.
**Revisit if:** the RTL/Arabic retrofit lands. AG Grid's built-in strings need `localeText` for every grid then.

## Q: The unknown-count dash: accessible text and valid values
**Decision taken:** A null count draws `—`, `aria-hidden`, beside a `sr-only` "Slip count unknown" (also the `title`). A negative or fractional value draws the dash too, since the contract says integer | null. A real `0` draws `0`.
**Why:** the ticket asks for the dash's accessible text through `t()`. The hardening costs nothing.
**Revisit if:** never, unless the contract changes.

## Q: The probe's shared key, and where it lives
**Decision taken:** `SLIP_ACCESS_KEY = ['collection', 'slips', 'access']` and `slipAccessQuery()` (with `staleTime: Infinity` and `retry: false`) in `features/collection/inquiry/api.ts`. It is read through `useSlipView` and `canSeeSlips`. `AttachmentAccess` has `withdrawCategories?: string[]` in `core/models/collection.ts`, and nothing in 320 reads it.
**Why:** both consumers (the two grids, then 321–323's drawer) live in this one feature, so it stays out of `core/`. The model type lives in `core/models` per the api-envelope rule.
**Revisit if:** a second feature needs the probe. It would graduate to `@/core/collection/` the way `collectionAccessQuery` did.
