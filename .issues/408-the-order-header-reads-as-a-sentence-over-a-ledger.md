---
status: open
spec: 380
blocked-by: 407
---

# 408 — The order header reads as a sentence the agent can say, over a ledger of bookkeeping

## What to build

The call center's chip row becomes **variant D** from [373](373-the-call-center-order-header-as-a-sentence.md)
(spec 380 **C3**, **C4**, **C5**, **C6**, **C9**). The prototype is on branch `prototype/379-cc-rail`
(`36d6be9`, which contains 373's `bdc24e7` sentence variants under
`callcenter/console/__prototype__/SentenceParts.tsx`), with captures in `assets/373-shots/D-*.png`.

**The model.** `ChipRow` and `Chip` go. `header-chips.ts` stays **the one pure model**: slot state
from the server's `submitBlockers`, plus the derived and lapsed flags. It (or a sibling module) gains
three facts: the **mode word**, the **address** and the **caller's name**. The attention rule stays
`submitBlockers`, and only that.

**Line 1, the sentence, one shape per mode:**

- Delivery: `‹Deliver› to ‹address› for ‹caller› from ‹store› at ‹window›, ‹payment›.`
- Collection: `‹Collect› from ‹store› for ‹caller›, ‹payment›.`

A mode flip rewrites the sentence: the address and window leave, and the store becomes a control
(absent, not disabled).

**Line 2, the ledger:** Source · Ref · Coupon · Note, as labelled fields. When empty, Coupon and Note
read "+ coupon" and "+ note".

**Slot looks (C4):**

- **settled:** a bordered word;
- **blocked by the server:** a dashed attention fill;
- **optional and empty:** a ghost word;
- **readout:** a plain word, not a control. The two readouts are the caller's name and the store on a
  delivery order. The store gets a dotted underline and a title saying it follows the address, which
  replaces `store.followsAddress`.

The address word opens the address book (166's dialog) once a caller is attached. The shut-gate
reason and the lapsed-slot warning are notes under the sentence.

**Editing (C5):**

- Every word is a native button in DOM order and opens **today's in-flow `ChipSection`**. No
  popovers.
- Tab moves between the words. Enter or Space opens a section and moves focus into it. Esc closes it
  and returns focus to the word.
- The palette's existing verb rows (192) open the same sections.
- A refused option stays focusable with `aria-disabled`.

**i18n and bidi (C6):**

- Each sentence shape is **one `callcenter` key with named self-closing slot tags**, rendered by
  `<Trans components>`, so the translation owns the word order.
- Values are isolated per F24:
  - `<bdi>` for the name, address, store name and note;
  - `Ltr` for the store code, source, reference, coupons and **every window**.
- Template punctuation and quotes sit outside the isolates.
- An Arabic template never glues a clitic to a slot.
- Until BO-3's `slot.date` exists, the window is worded without a day, as today.

**Copy (C9):** reword `steps.store.hint`. There are no chips and no `/store`.

## Spine reach

logic (`header-chips` + sentence facts) · component (sentence + ledger, replacing `ChipRow`) · i18n
(`callcenter`, `<Trans>` slot keys) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `sentence shape per mode: delivery has address and window, collection drops both and makes the store a control` · pure (extends `header-chips.test.ts`)
- [ ] `slot look per state: settled, blocked from submitBlockers, ghost when optional and empty, readout for the caller name and the delivery store` · pure
- [ ] `the sentence key renders its slots in the translation's order` (a `<Trans>` named-slot render on the repo's i18next, as 373 verified) · pure
- [ ] `tools/callcenter-sentence-drive.mjs`: light, dark and RTL; Tab order follows the reading order; Enter opens a section and Esc returns focus; an Arabic caller name shows whole between "for" and "from"; an 18:00–21:00 window reads correctly in RTL · flow (Playwright)

## Boundaries

- **No new endpoint.** BO-3 (`slot.date`) is listed in spec 380 and not filed; it is not blocking.
- **i18n (`callcenter`):** `sentence.delivery` and `sentence.collection` (slot-tag keys), the ledger
  labels, `ledger.addCoupon`, `ledger.addNote`, the store readout title, and the reworded
  `steps.store.hint`. Retire the chip-only keys that no longer render.
- ⚠ **Arabic copy is unreviewed.** Ship the mechanism. The Arabic strings need a reviewer before
  Arabic ships.

## Done when

The console's header renders as sentence + ledger from the unchanged `header-chips` model, every
slot edits in its in-flow section by mouse and keyboard, and the pure tests and drive are green in
light, dark and RTL.

## Blocked by

- [407](407-the-call-center-console-sits-inside-the-rail-shell.md) — the console inside the shell.
  The bidi helpers come from 384.
