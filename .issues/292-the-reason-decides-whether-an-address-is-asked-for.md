---
status: done
spec: 289
blocked-by: 291
---

# 292 — The reason decides whether an address is asked for at all

## What to build

The most consequential control on the screen, and the panel that appears or vanishes with it.

**What happens to the goods** — two cards, each carrying its consequence in the operator's language,
not a bare radio label:

- *Return and refund* — **the courier collects from the customer. The refund is issued once the goods
  arrive.**
- *Refund only* — **refunded now. No collection is booked and the customer keeps the goods.**

🔑 **Neither is pre-selected.** Refund Only never touches the carrier: it refunds immediately and the
customer keeps the goods, which is an irreversible money movement with nothing coming back. A
pre-selected radio is exactly how that gets clicked through. Nothing chosen is the third and last
sentence the submit bar names — *choose what happens to the goods* — after 291's two.

**The pickup address**, which exists only under Return and Refund:

- Collapsed by default to a **one-line summary** of the delivery's own shipping address with a
  **Change** affordance. It is pre-filled and right nearly always, and an open six-field form implies
  it needs attention.
- Expanded, it is the whole field set the carrier reads: **district (a picker)**, city, street,
  building number, postal code, short address, and the additional street line. This is the one
  control on the screen with a physical consequence — it decides where the courier collects, and the
  customer may not be where the parcel was delivered. Often that is *why* it is coming back.
- A sentence under the expanded form says so: this is where the courier collects, pre-filled from the
  delivery, change it only if the parcel is somewhere else.
- ⚠ **Under Refund Only the panel is removed from the tree.** Not disabled, not greyed — **absent**.
  Nothing collects, so there is nothing to address, and hiding it makes the two reasons visibly
  different screens rather than one form with an inert region.

Edits are local to the dialog and discarded on cancel. The address **on the delivery** is never
touched — only the one that will post with the return.

## Spine reach

logic (`return-order.ts`'s gate gains its third sentence; the address form's derived city) ·
component (`ReturnDialog` grows the reason cards and the address panel) · i18n (the two consequence
sentences, the third gate sentence, every address label, the pickup hint) · test (pure vitest + the
drive)

## Proof (→ `tdd` red-green cycles)

- [x] `submitGate names the reason sentence once lines and quantities are valid` — and only then, proving the three-sentence order end to end · pure
- [x] `submitGate flips to a summary` — *3 lines* once nothing is missing · pure
- [x] `return-dialog-drive.mjs` — on open, **neither** reason card is selected and the reason sentence is what the submit bar names after the lines are ticked · flow (Playwright)
- [x] `return-dialog-drive.mjs` — each card renders its consequence sentence, not just its title · flow
- [x] `return-dialog-drive.mjs` — choosing **Refund only** removes the address panel from the DOM; choosing **Return and refund** brings it back · flow
- [x] `return-dialog-drive.mjs` — the address opens collapsed as a one-line summary; Change expands it to the full field set · flow
- [x] `return-dialog-drive.mjs` — the district control is a picker off the cached lookup, and choosing a district updates the city · flow
- [x] `return-dialog-drive.mjs` — cancelling after editing the address leaves the delivery beneath unchanged · flow

## What was built

`return-order.ts` gained the reason union, the gate's third sentence and the pickup address —
`pickupAddressFrom`, `applyPickupDistrict` and `pickupAddressSummary`. `ReturnDialog` grew the two
consequence cards and the panel that appears and vanishes with them. The gate now runs
**lines → quantity → reason → summary**, with the reason last: it is the only one of the three
standing between an otherwise-complete form and an irreversible refund.

`PickupAddress` is **exactly** `CreateReturnAddress`'s field set (1283 §2), asserted key-for-key in
the suite, so 294's request builder hands it over without reshaping it — and a field that drifts is
a red test rather than a `400`.

Rulings, all logged in `.afk/HITL-292.md`:

- **A native `<select>` off the cached districts read**, as 1270's build target draws it — not Change
  Store's AG Grid, which exists because that flow is *searching* for a district it has no starting
  value for. Here the district is pre-filled and the control only has to make a correction possible.
- **An `<option>`'s value is the pair `cityCode|districtCode`.** Nothing guarantees a district code
  is unique across ~1.7k rows spanning every city, and a collision would derive the wrong city —
  which is the one thing this control exists to get right.
- **The delivery's own district is pinned into the picker** even when the lookup does not carry it,
  and choosing it again restores the delivery's district *and* city. Pinned off the delivery rather
  than off the draft, so an accidental change is repairable without cancelling the dialog and losing
  every ticked line.
- **The city is derived and read-only.** A district and a city that disagree is a collection that
  fails; the pair only stays consistent if one of them is not typeable.
- **The panel is absent before a reason is chosen**, exactly as under `RF` — nothing collects until a
  collection has been decided on, and showing it under `null` would make the default look like the
  collecting reason.

Review findings applied: the pinned district row became a way *back* rather than a dead option; the
districts lookup surfaces its pending and refused states through `apiErrorMessage` — a picker with
nothing in it must say why rather than read as *this address has no districts*; the En→Ar name
fallback, which had been spelled three ways, became one exported `districtLabel` (the option label
fell back to `districtCode` and the apply did not, so picking a name-less district blanked the field
the label had just shown, and the city half now reuses `change-store.ts`'s own `districtCityName`);
a delivery whose `cityCode` is blank or stale no longer draws two identical options, because
`matchDistrict` resolves on the code alone before pinning; the panel moved out into
`PickupAddressPanel.tsx` before 293's grids land on top of it; and the reason cards now **arrow**
like the radiogroup they claim to be, with focus following the selection and one tab stop for the
group.

Two findings deliberately **not** taken, both recorded in the HITL log: a cross-city district change
leaves the delivery's **GPS unedited** (D6 and this ticket's Boundaries both say so in as many
words — a district's coordinates are its centroid, not the customer's door), and the gate does **not**
require a non-blank address under `RTRF`, because the gate is specified as exactly three sentences
and capture `8000000253`'s own shipping address is blank on the live wire. Which of
`CreateReturnAddress`'s fields are required is 1283 §2's to say, and 295's to find out.

291's two drive assertions that expected the summary once lines and quantities were valid now expect
the reason sentence — the insertion 291's own HITL log said this ticket would make.

Two knowing divergences from 1270's build target, both logged: the panel is **absent under a null
reason** where the artifact renders it (the ticket states the rule in words — *"exists only under
Return and Refund"* — and showing it under `null` would make the unchosen state look like the
collecting one), and the collapsed summary reads *King Abdulaziz Rd 7420* rather than the artifact's
*…, Building 7420*, because `pickupAddressSummary` is pure and owns no copy.

## Boundaries

- **Reuses the cached `SdDocument/Districts` read** in `core/services/lookups` — already fetched for
  the Change Store picker, so the control costs nothing and **no feature imports another feature**.
  City is derived from the chosen district the way `change-store.ts` already does it.
- **GPS is carried through from the delivery unedited.** No map picker.
- **No box count and no total weight.** Dropped by spec 289 D9 — the WPF required both and then sent
  neither. Do not add fields for them.
- Still no network. Submit remains disabled.
- i18n: all new copy under `returnDocument.*` in the existing `document` namespace.

## Done when

The reason cards and the conditional address panel work in the running app; the submit bar's three
sentences appear in order and then give way to the summary; the pure suite and
`return-dialog-drive.mjs` are green; `npm run typecheck` and `npm run lint` pass.

## Blocked by

[291](291-the-dialog-opens-on-the-lines-that-can-come-back.md) — the dialog and its submit bar.
