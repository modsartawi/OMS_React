# HITL log — ticket 394 (the palette lists the last five records opened)

## Q: The group heading's key — `common:palette.recent` (the ticket's Boundaries line) or beside 392's group headings?
**Decision taken:** `common:palette.group.recent`, next to `palette.group.screen/goto/jump`. It is still one new key.
**Why:** 392 settled the group headings under `palette.group.*`, and `PALETTE_GROUP_LABEL` maps every group id there. The Boundaries line was written before that and is about how many keys there are, not where they sit.
**Revisit if:** the owner wants the literal `palette.recent` path. It is a one-line move in `palette-model.ts` and `common.json`.

## Q: What does a Recent row read?
**Decision taken:** The Jump row's own words, *Open delivery N* / *Open document N* (`common:palette.jump.*`), with the number in mono and isolated LTR. Jump and Recent share one row builder.
**Why:** This keeps the ticket's single new key, and a row that names its kind is clearer than a bare number.
**Revisit if:** the prototype or owner wants Recent rows to carry more (a status, a "2 min ago"). That would need a read, and K9 rules numbers only.

## Q: Which number is recorded — the route's or the server's?
**Decision taken:** The route's number (`routeId`), with `openedAs` as the kind, recorded once the header load succeeds.
**Why:** It is the number that reopens the same route. On a delivery route the header's `documentNo` is a different number (the order), which would reopen the wrong page.
**Revisit if:** the backend accepts several spellings of one number (for example without leading zeros). One record could then appear twice in Recent.

## Q: Should a typed number narrow Recent by substring like any word?
**Decision taken:** No. A typed number keeps only the Recent record whose number equals it exactly. Words still narrow by substring. Digits are folded on both sides, so a number typed on an Arabic layout matches too.
**Why:** Recent sits above Jump (K8) and the first row is aimed. A substring match would let a recent `80001237` take Enter from someone who typed `8000123` to jump there.
**Revisit if:** the owner wants prefix search over Recent. Jump would then need to be aimed first whenever a number is typed.
