# HITL — ticket 215 (a row offers only the acts its state permits)

Unattended run, 2026-08-02. Every decision below was taken conservatively against the frozen
contract `.issues/assets/209-nphies-contract/CONTRACT.md` v1.0 and, where the contract was silent,
against the **Nphies service's own source** (`C:\Work\DMSCO\nphies\Service\NphiesService`) and the
**parallel SIS.Api slice** (BackOffice 916, `Tests\Data.Tests\NphiesWeb\NphiesAuthActsContractTests.cs`
+ `Services\SIS.Api\Endpoints\Insurance\Nphies\NphiesEndpoints.cs`), both of which were on disk and
readable during this run.

## Q: Where does the row-acts module live — `core/` or the feature?

**Decision taken:** `src/features/nphies/authorizations/row-acts.ts`.
**Why:** the authorizations feature is its only consumer (216's detail is the same feature); the
`core/` rule exists because two *features* render the axes, which is not this situation.
**Revisit if:** a screen outside `features/nphies/authorizations` ever needs to offer an act.

## Q: `reference` on statusCheck/cancel — the authorization id, or the payer's preauth reference?

**Decision taken:** the authorization **id** (`row.id`).
**Why:** `CancellationService.cs:108` matches it as `c.Id == requestModel.Reference`; the preauth
reference is the payer's and is not what the service looks up.
**Revisit if:** SIS.Api re-models these acts to take the preauth reference instead.

## Q: Which fields of the retry / cancel bodies does the browser send?

**Decision taken:** retry sends `{ referenceId }` **only**; cancel sends
`{ reference, reasonCode, nullify, providerCode }` — no `referenceType`, `storeCode`, `staffId` or
`claimType` anywhere.
**Why:** law 7 / §1.3, and the SIS.Api slice asserts exactly this split
(`ARetryCarriesTheAgentsIdentityAndStore_NeverTheBrowsersClaimAboutThem`,
`ACancellationPinsTheClaimTypeAndStampsTheStaff…`): `referenceType` is pinned to `"Auth"`,
`claimType` to `0`, and `staffId`/`storeCode` are stamped from the session. A body that carried them
would be the browser asserting an identity the server overwrites anyway.
**Revisit if:** §1.3 ever moves one of these back to the client.

## Q: `nullify` — send it at all, and with what value?

**Decision taken:** always `false`, sent explicitly.
**Why:** the upstream throws `"Nullify operation is not supported"` (`CancellationService.cs:101`)
and SIS.Api **forwards the flag as asked** rather than downgrading it, so an omitted-or-true flag is
a refusal by construction. There is no nullify affordance on this screen.
**Revisit if:** the upstream implements nullify and the spec asks for it.

## Q: 🚩 CONTRACT GAP — `reasonCode` on the cancel body has no value set in the contract.

**Decision taken:** the cancel act opens a **confirmation dialog** whose reason list is fetched from
`GET Nphies/CodeSystem?valueSet=TaskReasonCode` (§1.1 #13); nothing is defaulted, and with no
reasons the act cannot fire and says so.
**Why:** the code reaches NPHIES as the cancel task's `reasonCode` coding against
`http://nphies.sa/terminology/CodeSystem/task-reason-code` (`CancellationTaskEntry.cs:77`), so it is
on the record the payer keeps — a constant would put words in the agent's mouth, and a hand-typed
list is the guessed shape spec 209 warns against. `ValueSetConstants.TaskReasonCode` is a real
constant in **three** repositories, so the value set name is read, not invented.
**Revisit if:** §3.6 grows a reason value set of its own, or SIS.Api adds a dedicated
cancellation-reasons endpoint. **The contract should name the value set in a §8 revision.**

## Q: 🚩 CONTRACT GAP — §3.8 does not freeze the lookups' envelope, and the two tracks disagree.

**Decision taken:** `unwrapLookup` in `@/core/nphies/api` reads **both** `{ contractVersion, items }`
and a bare array, in one place.
**Why:** SIS.Api answers `NphiesLookupResponse<T>` (law 10 needs a model to carry
`contractVersion`, and a bare array has none) and its own doc comment logs the wrapping as a wanted
§3.8 clarification, meeting the client at 922's fixtures. Reading only one of the two shapes fails in
the worst way available — an **empty picker with no error** on the day the endpoint lands. This is
not a tolerant parse of an unknown shape: it is two shapes named in two repositories, unwrapped once
so the freeze is a one-line edit. 214's `providers()` was reading the bare array only and is
corrected here.
**Revisit if:** §3.8 (or fixture set 922) freezes one shape — delete the other branch that day.

## Q: A status check answers `success: false`. Error or data?

**Decision taken:** **data**. The toast states the exchange's `status` and no error banner is raised.
**Why:** the upstream sets `Success` only when the exchange's task came back `Completed`
(`StatusCheckService.cs:155`), so `success:false` + `status:"in-progress"` is the *ordinary* answer of
this act's own use case — a row that has waited too long. SIS.Api's slice asserts the same
(`AStatusCheckOnAStillPendingRequestRenders_ItIsNotARefusal`). Reading it as a failure would report
the normal path as a fault.
**Revisit if:** the upstream starts using `Success` as a transport flag.

## Q: How is a fired act's outcome surfaced?

**Decision taken:** a sonner toast (success / info / warning), plus an invalidation of the list query
so the rows are **re-read** from the server.
**Why:** the repo precedent (ticket 052's clear-cache) and §6: a business refusal is `toast.error`
carrying the **server's own message** through `apiErrorMessage`, never a generic "unexpected". Every
act rewrites the authorization server-side (`ProcessPendingAuth` rewrites it entirely on a retry), so
patching a row in place would be a guess about what the act did.
**Revisit if:** 216's detail lands and an act should navigate there instead.

## Q: The `Failed` row's "Open the refusal" act — render it, or leave it out?

**Decision taken:** rendered, **inert**, with a reason that says reopening is not available here yet.
**Why:** the ticket's own Boundaries — "present and inert only if it says so; a live-looking button
that does nothing is worse than one that is disabled with a reason". 221 wires it.
**Revisit if:** 221 lands (delete the `reopenNotWiredYet` reason with it).

## Q: All four acts inline, or a per-row menu?

**Decision taken:** all four inline in one 430 px column, withheld ones `aria-disabled` with their
reason as `title` + `aria-label`.
**Why:** the acts are "state-driven and disabled with their reason on hover" (spec §5 / 203 §6) — a
menu hides exactly the vocabulary the row exists to teach, and a `disabled` attribute takes the
control out of the tab order, so the reason can never be read by anyone not using a mouse
(`@/core/ui/Button`'s own rule).
**Revisit if:** the column count grows enough that the row cannot carry four buttons.

## Q: (review pass) Where does the in-flight state of an act live?

**Decision taken:** **above the grid**, in a `role="status"` banner naming the act and the row —
never in the acts cell.
**Why:** a busy flag in the cell has to travel through the column definitions, and AG Grid rebuilds
every cell when `columnDefs` changes identity. Measured in Chromium: pressing an act moved
`document.activeElement` to `<body>` within 300 ms, so a keyboard or screen-reader user lost their
place mid-act — defeating the exact reason these controls are `aria-disabled` and focusable rather
than `disabled`. `onAct` is now stable (a ref, because TanStack's mutation objects are new every
render) and `columns` memoizes on `[t]`. The drive asserts the focus survives.
**Revisit if:** the acts move to a detail screen with no grid under them.

## Q: (review pass) A refused *cancellation* arrives while the modal is open. Toast?

**Decision taken:** no toast for the cancel act — the refusal renders in an `ErrorBanner` **inside**
the dialog, which stays open with the reason picker intact.
**Why:** `@/core/ui/Modal` uses `showModal()`, so the dialog and its `::backdrop` are in the
browser's **top layer** — a toast raised behind it is painted under a 50% black scrim and cannot be
clicked, at any z-index. `AUTH_ALREADY_DISPENSED` is exactly the code this act meets in the field,
and the ticket's "renders as a business outcome" clause depends on the agent being able to read it.
(The toast-under-modal pattern is pre-existing elsewhere in the repo — not fixed here, but not
repeated either.)
**Revisit if:** the toaster is ever moved into the top layer, or the modal stops using `showModal()`.

## Q: Can two acts run at once?

**Decision taken:** no — one act in flight per screen, and the in-flight button spins.
**Why:** every one of these acts reaches the national exchange; a second click while the first is
unanswered is a second ask.
**Revisit if:** the acts ever become idempotent server-side.
