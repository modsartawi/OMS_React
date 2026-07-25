---
type: wayfinder-ticket
wayfinder: prototype
map: 097
status: done
blocked-by: 101, 103
---

# 108 — The bonus-buy details affordance on a promo card

## Question

[099](099-sim-region-question-inventory.md) drew the boundary — **"in scope: the affordance; out of
scope: the surface"** — and ruled the button hidden behind a `BbyInquiry` access probe. It never
ruled what the affordance *is*. **What does a promo card offer, and what happens when it is taken?**

The surface it reaches is finished work belonging to another effort and is **not** to be redesigned
here: [060](060-bby-detail-modal-prototype.md) is the approved SAP "Display Bonus Buy" mirror,
[058](058-bby-detail-endpoint-contract.md) is its contract, and
[066](066-bby-inquiry-details-modal.md) **built it** as
`src/features/pricing/bonus-buy-inquiry/DetailModal.tsx` (code-complete; `Bby/Detail` and
`Bby/GroupingMembers` are still unbuilt on SIS.Api).

Settle:

1. **Which cards carry it — fired, near-miss, or both.** Both *can*: a `PotentialBonusBuy` carries
   its `bbyNumber` (`000100000132`, capture 03). And [098](098-simulate-payload-capture.md) found a
   near-miss has **no prerequisites and no item linkage**, so a near-miss card shows description,
   kind and `wouldSave` and nothing else — which makes the details modal the only place its actual
   rules are legible. That is an argument the affordance matters *more* on a miss than on a fire.
   Rule it against the rail as [101](101-sim-screen-device-prototype.md) drew it.
2. **What the click does — and this one is not free.** Two candidates, and they differ in cost, not
   just in feel:
   - **Open [060](060-bby-detail-modal-prototype.md)'s modal in place.** Keeps the run on screen —
     but `DetailModal` lives in another *feature*, and
     [feature-structure](../.claude/rules/feature-structure.md) forbids feature→feature imports. It
     would have to **graduate to `@/core/`** (with `detail-view.ts`, its `Bby/Detail` call and its
     i18n keys), which is a structural change this map's **arrangement-only** line does not cover.
     Say plainly whether that graduation is being proposed, or whether it disqualifies the option.
   - **Navigate to the BBY Inquiry screen, deep-linked to the number.** No boundary problem, reuses
     a screen that already exists — but it leaves the run, and the analyst has to come back to a
     screen that ([102](102-sim-input-chip-bar.md)) will not have re-run itself.
3. **The three states, drawn.** The probe **grants** (button present), the probe **denies** (button
   absent — same show/hide hygiene as the cache button, server still enforces), and the endpoint is
   **unbuilt** (what the click does today, given neither `Bby/*` endpoint answers). The rail must
   read correctly in all three; 099 already requires the absent case not to leave a hole.
4. **Where it sits on the card, and what it is made of.** [101](101-sim-screen-device-prototype.md)
   drew `[ Bonus buy details ▸ ]` as a quiet bordered control under the amount row. Confirm or
   replace it — and note that [100](100-sim-chip-vocabulary.md) forbids a chip here, since **no chip
   on this screen is ever clickable**.
5. **The mount cost.** 099 recorded the consequence: this is a **third** access probe on mount
   (`Pricing/Access`, the cache grant, `BbyInquiry`). Confirm the rail does not block on it — the
   promotions must render before the probe answers, with the button appearing late rather than the
   cards appearing late.

**Blocked on [103](103-sim-deep-layers-placement.md)** — that ticket rules the screen's whole
disclosure grammar, including whether a **modal** is admissible at all. If it rules modals out, this
ticket's option 2a is dead before it is drawn and the answer is navigation by construction.

Draw it on [098](098-simulate-payload-capture.md)'s captures — capture 03 carries a fire **and** a
near-miss in the same rail, which is the basket this question is really about. Both themes.

## Answer

**Approved by the owner, 2026-07-25: both cards · the modal in place · form A.** Ruled against
[`assets/108-bby-affordance.PROTOTYPE.html`](assets/108-bby-affordance.PROTOTYPE.html) (the three
switches) and re-drawn as the settled state in
[`assets/108-bby-affordance.APPROVED.html`](assets/108-bby-affordance.APPROVED.html)
(also published as an artifact: `https://claude.ai/code/artifact/ccce917d-5a86-40d3-8f6d-fd287bb3aae2`).
Both themes, on capture 03.

### 1 — Which cards: **both**

A fired card and a near-miss card carry the same control. The rail is one vocabulary and a promotion
does not stop being a bonus buy because it did not fire — but the *reason* is asymmetric and worth
recording, because it is what would survive a later squeeze: a fired card already explains itself
(rule, amount, line), while [098](098-simulate-payload-capture.md) found a near-miss carries **no
prerequisites and no item linkage**, so its card can say only *that* a promotion exists and *what it
would have saved*. On a miss the modal is the only route to the rule; on a fire it is a convenience.
**If the affordance ever has to be cut back to one kind of card, it is kept on the miss.**

### 2 — What the click does: **[060](060-bby-detail-modal-prototype.md)'s modal, opened in place**

Navigation is rejected. It looked like the free option and is not: `BonusBuyInquiryPage` reads **no
search params**, so 2b requires *adding deep-link behaviour to another feature's screen* — the same
class of out-of-line change it existed to avoid — and it costs the analyst the run,
which [102](102-sim-input-chip-bar.md) will not re-execute on return.

**The graduation is proposed, and it is smaller than the ticket feared.** `DetailModal`'s entire
public surface is `{ bbyNumber: string | null, onClose }` — it fetches its own record and needs
nothing from the inquiry page — so this is a **file move**, not an API redesign.
`DetailModal.tsx` + `detail-view.ts` + `GroupingMembersModal.tsx` + `BbyStatusBadge.tsx` +
`status-severity.ts` + `codeLabels.ts` + `formatters.ts`, the two `Bby/Detail` / `Bby/GroupingMembers`
calls, and the `bonus-buy-inquiry` i18n namespace graduate to `@/core/`; `BonusBuyInquiryPage`
re-imports from there and is otherwise untouched.

This is a **named exception to the map's arrangement-only line**, taken deliberately rather than
smuggled: it changes no behaviour and no pixel, and the alternative — duplicating an approved
surface, or teaching another feature a new URL contract — is worse.
[103](103-sim-deep-layers-placement.md) had already conceded the grammar, naming this modal as the
single principled exception to expand-in-place; this ticket only pays for it.

### 3 — The three states, and the finding that changed one

Granted → the control is present. Denied → **absent**: no disabled control, no explanation, no
reserved space; the card ends at its last fact, and the server stays the boundary (099's requirement
that absence leave no hole).

The third state is where the drawing found something the ticket had not anticipated.
`bonusBuyInquiryApi.access()` deliberately degrades an unreachable probe to **granted**
(`404 / network → { screenAllowed: true, probed: false }`) — correct for the inquiry *screen*, where
hiding a whole read-only screen behind an unbuilt probe is the worse failure. Reused verbatim here it
inverts: today, on live SIS.Api, the button would appear on **every** card and **every** click would
fail against the unbuilt `Bby/Detail`.

**Ruling: in Simulation the control is gated on `probed && screenAllowed` — unknown means absent.**
A button that fails is worse than a button that was never there, which is the opposite trade to the
one the inquiry screen faced. It is one boolean, and it makes the affordance **ship dark**: the rework
lands without a dead control, and the button appears by itself when the endpoints arrive, with no
further change to this screen.

### 4 — Where it sits and what it is made of: **101's draw, confirmed**

`[ Bonus buy details ▸ ]`, a quiet bordered control, full card width, **below the amount row and last
on the card** — after every fact, so the card still reads top-to-bottom as a verdict and the exit is
the last thing met. Not a chip ([100](100-sim-chip-vocabulary.md): no chip on this screen is ever
clickable, which is what makes "a chip is a readout" enforceable).

Two alternatives were drawn and declined: **the bby number as the link** — cheapest, but it spends the
number's chip to buy a link and breaks 100's rule at the one place the rule is load-bearing — and a
**corner icon button**, which puts the exit before the content and reads as a close control.

### 5 — The mount cost: **the rail never waits**

Confirmed. The cards render from `promoView` the instant the run returns; the probe is a
**screen-mount** query sharing the inquiry screen's `['bonus-buy-inquiry', 'access']` cache key, so it
is normally settled long before the first Process. If it is not, the button appears late — the
promotions never appear late. No skeleton, no reserved row, nothing that reserves space for a control
that may never come.

### What this hands on

- **For the spec — the structural precondition.** The `@/core/` graduation is a *build* step with no
  design content: it is stated here so `/to-tickets` slices it as its own ticket, ahead of the card
  work, rather than discovering it mid-build.
- **i18n churn**, feeding the map's accumulating patch: one new key for the control's label; the
  `bonus-buy-inquiry` namespace's registration in `core/i18n.ts` survives the move unchanged (the rule
  keeps namespaces flat and feature-named regardless of folder).
- **No new testing seam.** The gate is one boolean on a query result; the modal's pure `toDetailView`
  is already the inquiry screen's seam and moves with it.

## Progress — prototype drawn, awaiting the owner's ruling (2026-07-25)

[`assets/108-bby-affordance.PROTOTYPE.html`](assets/108-bby-affordance.PROTOTYPE.html) — capture 03's
real rail (fire `000100000131` "70% 2nd PCS" −63.88 on line #10; near-miss `000100000132`
"2 PC for 29.95 SR" `ZB01` would-save 26.04), both themes, with three switches: **which cards** carry
it, **which of three affordance forms**, and **the grant state**. Below the device: the two click
destinations drawn side by side, the three states as tiles, and the mount sequence as a table.

Four things the drawing settled or sharpened before the owner sees it:

1. **Sub-question 2 is narrower than the ticket assumed.** `DetailModal`'s entire public surface is
   `{ bbyNumber: string | null, onClose }` — it fetches its own record and needs *nothing* from
   `BonusBuyInquiryPage`. So the modal option is a **file-move** question, not an API-shape one.
   Cost, counted: `DetailModal.tsx` + `detail-view.ts` + `GroupingMembersModal.tsx` +
   `BbyStatusBadge.tsx` + `status-severity.ts` + `codeLabels.ts` + `formatters.ts` + two `api.ts`
   calls, plus the `bonus-buy-inquiry` i18n namespace, graduating to `@/core/`.
2. **Option 2b is not the free one it looked like.** `BonusBuyInquiryPage` reads **no search params** —
   there is no deep link today. Navigating would mean *adding behaviour to another feature's screen*,
   which is the same kind of out-of-line change the option existed to avoid.
3. **[103](103-sim-deep-layers-placement.md) has already conceded the grammar** — the bonus-buy modal
   is named there as the single principled exception to expand-in-place. So the boundary cost is the
   only live objection to 2a.
4. **A finding the ticket did not anticipate.** `bonusBuyInquiryApi.access()` degrades a missing probe
   to **granted** (`404 / network → { screenAllowed: true, probed: false }`) — correct for the inquiry
   screen, wrong here: reused verbatim it means that today, on live SIS.Api, the button appears on
   every card and every click fails. Proposal drawn: gate on **`probed && screenAllowed`** so unprobed
   means absent, and the affordance ships dark until `Bby/Detail` lands.

## Comments

**Owner questions after the ruling (2026-07-25) — the material row, and the members list.**
Both concern the *inside* of [060](060-bby-detail-modal-prototype.md)'s modal, which 108 reuses
untouched; answered from the built code so the spec does not have to re-derive them.

**1. A material shows its material number.** `DetailModal`'s `IdentityCell` renders `identifier` as the
row's primary line (mono, tabular), and contract [058](058-bby-detail-endpoint-contract.md) defines
`identifier` as *"matGrouping (grouping) else materialNumber"* — so on a `MAT` row the number **is** the
identity, with `description` beneath it, and on an `MGP` row it is the grouping key with the members
chip beneath it. The column is headed `Material / grouping` and a `Kind` cell says which
(`detail.kind.material` / `detail.kind.grouping`). This holds on **both** sides: the Get row carries the
same `identifier` / `materialNumber` pair. The wire's separate `materialNumber` field is redundant for a
`MAT` row and `null` for a grouping — the modal never renders it, which is correct and worth stating so
nobody "fixes" it. Both cases are now drawn in
[`assets/108-bby-affordance.APPROVED.html`](assets/108-bby-affordance.APPROVED.html).

**2. The grouping members list is not restyled.** `GroupingMembersModal` (slice 067) stays exactly as
built: a second `core/ui/Modal` at `42rem` over the detail modal, `Bby/GroupingMembers` one page of 20
at a time, Material · Description · Qty, prev/next with the range and total in the footer,
`keepPreviousData` so paging does not flash. This map neither redesigns it nor re-declares the design
system ([082](082-pos-design-system-spec.md) is consumed, never re-declared) — it will change
appearance only when the app-wide palette move reaches it, which happens to every screen at once.

**A boundary note this exposed, recorded rather than left ambiguous.** Opening the drilldown from
Simulation is screen → modal → nested modal, while [103](103-sim-deep-layers-placement.md)'s grammar
says "no second modal". The rule governs **the Simulation screen's own disclosures**; once the analyst
is inside the bonus-buy record they are in that record's grammar, which already approved the nested
drilldown, and native `<dialog>` stacks it in the top layer with correct focus trapping. **The
drilldown stays live from Simulation.** Suppressing it would make an approved surface behave
differently depending on which screen opened it — a worse inconsistency than the extra layer.
