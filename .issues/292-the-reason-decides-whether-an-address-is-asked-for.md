---
status: open
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

- [ ] `submitGate names the reason sentence once lines and quantities are valid` — and only then, proving the three-sentence order end to end · pure
- [ ] `submitGate flips to a summary` — *3 lines* once nothing is missing · pure
- [ ] `return-dialog-drive.mjs` — on open, **neither** reason card is selected and the reason sentence is what the submit bar names after the lines are ticked · flow (Playwright)
- [ ] `return-dialog-drive.mjs` — each card renders its consequence sentence, not just its title · flow
- [ ] `return-dialog-drive.mjs` — choosing **Refund only** removes the address panel from the DOM; choosing **Return and refund** brings it back · flow
- [ ] `return-dialog-drive.mjs` — the address opens collapsed as a one-line summary; Change expands it to the full field set · flow
- [ ] `return-dialog-drive.mjs` — the district control is a picker off the cached lookup, and choosing a district updates the city · flow
- [ ] `return-dialog-drive.mjs` — cancelling after editing the address leaves the delivery beneath unchanged · flow

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
