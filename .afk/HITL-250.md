# HITL — ticket 250 (`money.ts` graduates to `@/core`)

## Q: `src/core/money.ts` (top level) or `src/core/util/money.ts` (beside `number-format.ts`)?

**Decision taken:** `src/core/money.ts`, exactly as written.
**Why:** ticket 250 names `@/core/money.ts` twice — in *What to build* and in *Done when* — and a
prefactor whose whole value is "nothing changed but the address" is not the slice to second-guess
the address on. `/standards-review` raised the sibling argument (its 2-dp twin `formatMoney` lives
at `core/util/number-format.ts`, and the two a caller must choose between read better as
neighbours) as a judgement call, not a breach.
**Revisit if:** a later slice groups the money utilities — moving it again is a one-line import
change at each of its (then two) call sites plus the test's `./money`.

## Q: the module header said the collection screens "became its second consumer" — but they have not landed.

**Decision taken:** reworded the header to state the move as a **prefactor**, landed one slice
ahead of the consumer that licenses it, with ticket 254 named as where the second call site
actually arrives.
**Why:** `/standards-review` flagged the original past-tense wording as asserting something the
tree does not contain (Speculative Generality). The ticket itself says "no consumer added here —
ticket 254 is what actually consumes it", so the honest header is the ticket's own framing.
**Revisit if:** 254 lands somewhere other than the collection screens.

## Outstanding (nothing)

Both Proof bullets are real and green, and the Boundaries clause (drive the Loy member screen) was
discharged: `tools/loy-member-drive.mjs` against a vite server on :5199, **184/184 passed**,
including the Sales-tab money scenarios (SAR 2 dp, BHD 3 dp, signed return lines, blank-not-zero).
The server started for the drive was killed afterwards.
