---
status: done
spec: 289
blocked-by: —
---

# 290 — The command says which of three reasons it cannot be returned for

## What to build

**Slice 0.** Today **Return Document** enables on `deliveryDocumentType === 'BB'` — *bonded*, which
includes the SMSA stores where a return is persisted, books no pickup and never refunds, silently.
That gate goes. The command reads the server's `canReturn` instead, and when it is disabled it says
**which** of three things is wrong.

The delivery read model gains the two fields BackOffice spec 1283 §2b adds, a new pure module is
born to project the lines, and `commands.ts` stops spelling a store rule it has no business knowing.

**The three reasons, in the order they are checked:**

| Cause | Read from | Reason shown |
|---|---|---|
| Not a delivery | `documentCategory` — already on the model | *Open the delivery to return it.* |
| Not on the Starlinks bonded rail | `canReturn` false, delivery category | *Only bonded deliveries handled by Starlinks can be returned here.* |
| Nothing left to return | `canReturn` false **and** the line projection is empty | *Everything on this delivery has already been returned.* |

⚠ **`canReturn` is one boolean carrying two of those causes.** The server folds the store rule and
the exhausted-lines rule together, so a `false` on a delivery does not say which. The screen splits
them off data it already holds: **every line exhausted → exhaustion; otherwise → the store.** That is
a *reason-string* choice and never an eligibility one — `disabled` follows `canReturn` **alone**, so a
wrong split can only mislabel a tooltip and can never offer a command the server would refuse.

🔑 **Fail closed.** `canReturn` does not exist server-side yet. Absent must read as **not
returnable** — never as enabled. The five captured payloads in `__fixtures__/payloads.ts` carry no
such field, so they are the proof of exactly this, at no cost.

The reasons **name the way out, not the rule**. The shipped `beyondBorderOnly` string states a fact
about the document; two of these three end in an instruction, which is worth more than a
classification.

**After this ticket, neither `BZ02` nor `'BB'` appears anywhere in this repo.**

## Spine reach

model (`SdDocumentHeaderModel.canReturn`, `SdDocumentLineModel.returnedQuantity` — both additive and
optional) · logic (new pure `return-order.ts`: the line projection) · component (the action bar
renders the new reasons — no new component) · i18n (three keys added under `command.disabled.*`, one
deleted) · test (pure vitest + the existing action-bar drive)

## Proof (→ `tdd` red-green cycles)

- [x] `returnableLines` — remaining per line is `quantity − returnedQuantity`; a fully-returned line is **omitted** from the rows and counted in the hidden tally; an untouched line reports its full delivered quantity · pure
- [x] `returnableLines handles a non-trivial history` — a line carrying two earlier partial returns projects to a remainder that differs from delivered, from zero, **and** from the last return's quantity · pure
- [x] `returnableLines treats a missing returnedQuantity as nothing returned` — an absent field is not `NaN` · pure
- [x] `commandBar disables Return on an order with the open-the-delivery reason` · pure
- [x] `commandBar disables Return on a delivery whose store is not on the rail` — `canReturn` false with lines still remaining · pure
- [x] `commandBar disables Return on an exhausted delivery` — `canReturn` false and the projection empty · pure
- [x] `commandBar enables Return only when canReturn is true` · pure
- [x] `commandBar fails closed on a payload with no canReturn` — the five captured live documents all disable Return · pure
- [x] `commandBar disabled follows canReturn alone` — a `canReturn: true` delivery stays **enabled** even where the derived reason would have said *exhausted* · pure
- [x] `document-actions-drive.mjs` item 6 — rewritten from the `BB` gate to the three reasons, each read on hover **and** on focus · flow (Playwright)

## Boundaries

- **Server dependency, not yet built.** `canReturn` and `returnedQuantity` are BackOffice spec 1283
  §2b additions. Both are **optional** on the TypeScript model so nothing breaks, and both fail
  closed when absent. The fixtures carry them; the live door does not yet.
- ⚠ **`tools/document-actions-drive.mjs` asserts the gate this ticket deletes** (its item 6, and the
  header comment about synthesising a `'BB'` payload because no capture carries one). Update it in
  place — that drive covers the action bar as a whole and keeps doing so.
- **i18n:** `command.disabled.beyondBorderOnly` is **deleted**; three keys replace it in the existing
  `document` namespace. No new namespace, no `core/i18n.ts` change.
- Two fixtures land here: `delivery-with-remaining` (one line untouched, one partly returned, one
  fully returned) and `fully-returned-lines`. ⚠ **Their shapes are contractual; their values are
  not.**
- No dialog, no new route, no network call. The command still does nothing when pressed.

## What was built

`return-order.ts` is born carrying the line projection; the `'BB'` gate and
`command.disabled.beyondBorderOnly` are gone; the model gained `canReturn` and
`returnedQuantity`, both optional and both failing closed; the two fixtures land in
`__fixtures__/return-lines.ts`, leaving the five captures untouched as the fail-closed proof.

Two rulings the build made, both logged in `.afk/HITL-290.md`:

- **`canReturn` is asked FIRST and alone**, and the three causes then choose the reason string. The
  tables list the category first, but delivery `9000000003` is opened *as a delivery* while carrying
  `documentCategory: 'T'` — a category pre-check would refuse a return the server had allowed and
  tell the operator to open the delivery they are already reading. D2's own "`disabled` comes from
  `canReturn` and nothing else" is the tie-breaker.
- **Exhaustion must be proven**, not merely projected: `rows.length === 0 && hiddenCount > 0`. A
  delivery with no lines at all falls to the store reason, because *everything has already been
  returned* is a false statement about a document with nothing on it. Tooltip-only either way.

`grep -r "BZ02\|'BB'" src/` finds nothing. The two `BZ02` hits left in `document-band-drive.mjs` and
`document-cards-drive.mjs` are assertions on a captured store code — data, not the deleted rule.

## Done when

The pure suite above is green; `npm run typecheck` and `npm run lint` pass; `document-actions-drive.mjs`
passes with its rewritten item 6; and `grep -r "BZ02\|'BB'" src/` finds nothing.

## Blocked by

None — can start immediately.

## Open questions

None. The store-vs-exhausted split is ruled in spec [289](289-bonded-return-screen-spec.md) D2 and
restated above; it is a tooltip decision, not a gate.
