# HITL — ticket 235 (the member header)

## Q: Does the tier chip render when the payload has no tier?

**Decision taken:** No. `memberChips` emits the tier chip only when `tier` is a non-empty string.
**Why:** every string on `LoyMemberModel` is nullable in TypeScript (spec 231's "Further Notes"), and
an empty pill reads as a fact rather than as a missing field.
**Revisit if:** the door guarantees a tier on every member, in which case an absent one is a defect
worth showing rather than hiding.

## Q: Does the member-type chip render when `memberType` is absent (a door that shipped without 230's mapping amendment)?

**Decision taken:** No chip. The chip renders only when `memberType` is set **and** not `M`.
**Why:** `memberType` arrives only because the `LoyWeb` projection maps it through (230's first
amendment); a door without that line would otherwise draw a chip saying nothing, and "no chip" is
already the ordinary-member reading.
**Revisit if:** the screen ever needs to distinguish "ordinary member" from "the door did not tell
me" — today it cannot, and neither can the agent.

## Q: `memberType` is not in the ticket's codes table, but the chips need the words Archived / Non-loyalty / Family. Translate it, or pass it through?

**Decision taken:** Translated, via a new `memberTypeKey` in `codes.ts`.
**Why:** 229's test is "name the `.cs` that closes the set" — 230 names `LoyMemberTypeConstants` and
enumerates all four values (`M`/`N`/`A`/`F`). It passes the rule, and it degrades to the bare code
like every other map here. Passing it through would have put a raw `A` in a chip whose whole job is
to say *archived* in words.
**Revisit if:** the constants file grows a value the portal must not name.

## Q: How is the points-balance subline's money formatted — `561` (prototype) or `561.00`?

**Decision taken:** `formatMoney` from `@/core/util/number-format` → `≈ 561.00 SAR`.
**Why:** it is "the single money formatter for the app" and the reuse rule outranks a prototype's
mock value; 2 decimals is what every other money figure in the portal wears.
**Revisit if:** 237's currency-aware formatter lands and this subline should follow the member's
currency decimals rather than a fixed 2.

## Q: `activityStatus.*` is consumed by 236, not by this slice. Add it now?

**Decision taken:** Yes — the map and its keys land in `codes.ts` / `loy.json` now, with tests.
**Why:** the ticket's Proof names `A`/`P`/`N`/`E` explicitly, and a second codes module later is
exactly how the rule starts being decided per-field again.
**Revisit if:** 236 finds the status set is not what `LoyActivityStatusConstants` says.
