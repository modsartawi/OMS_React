# HITL — ticket 461 (SAP export console, store-day slice)

## Q: Six label colours vs the five-word core `Severity` vocabulary
**Decision taken:** The console carries its own six tokens in `label-helpers.ts` (`danger`, `warningStrong`, `info`, `neutral`, `success`, `muted`), each built only from theme token utilities: danger-050/800, attention-050/800 + attention-border ring + semibold, primary-050/800, muted + foreground, success-050/800, transparent + muted-foreground + border ring. `TokenBadgeView` draws them in `StatusBadge`'s shape.
**Why:** The ruling needs six distinct looks. `Severity` has five words: `warn` has no strong twin, and `mute` covers both neutral and muted. Extending core `severity.ts` would touch every consumer of it.
**Revisit if:** the owner wants a strong-warning word added to core `Severity` (standards-review flagged a second badge vocabulary as a soft point), or a human's eye on the colours rejects the attention ring or the primary tint for "info".

## Q: Flag chip colours
**Decision taken:** X1 and X1p are danger; every other flag is neutral.
**Why:** Spec 2579 story 26 says double sends are "listed first and in red". No ruling covers the other flags.
**Revisit if:** the owner wants X2/X3/X4 (rail leaks) drawn as warnings.

## Q: What `held.missingRows === false` reads as
**Decision taken:** "Questionable posting".
**Why:** Spec story 19 names exactly two kinds of hold, missing rows and questionable posting, and the contract carries only that one boolean.
**Revisit if:** BackOffice 2582 introduces a third kind of hold.

## Q: What the `/reports/sap-export` placeholder shows
**Decision taken:** A "fleet view is on its way" note plus a store-code + business-day form that opens the store-day page. It makes no call beyond the access probe. 463 replaces it.
**Why:** Without it, nothing in the UI reaches the store-day page until 463.
**Revisit if:** 463 lands. Delete the form then.

## Q: Grid column order
**Decision taken:** The ticket's columns, except that the free-text reason moved to the end as the one stretching column (Transaction … Hours past day end, Held, Flags, Reason).
**Why:** At 1700 px the ticket's order pushed Held and Flags off-screen behind the reason.
**Revisit if:** the owner wants the reason before Held and Flags.

## Q: Access probe module
**Decision taken:** The probe lives in its own `access.ts` (key, query, predicate, `sapExportAccessApi.access`). `api.ts` holds the reads.
**Why:** `/code-review` noted that the menu imports the probe eagerly, and keeping it apart stops the wire and helpers from landing in the main bundle. The sync console keeps everything in `api.ts`; this is a deliberate improvement, not drift.
**Revisit if:** the owner prefers the single-`api.ts` shape of the sync console.

## Contract gap
None blocking. Notes:
- The store-day door carries no store description, so the header shows the code only.
- `trxDate`, `trxType`, `documentType` and `customerId` are typed in the model but not shown as columns, because the ticket did not ask for them.
