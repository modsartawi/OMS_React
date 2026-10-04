---
status: done
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

- [x] `sentence shape per mode: delivery has address and window, collection drops both and makes the store a control` · pure (extends `header-chips.test.ts`)
- [x] `slot look per state: settled, blocked from submitBlockers, ghost when optional and empty, readout for the caller name and the delivery store` · pure
- [x] `the sentence key renders its slots in the translation's order` (a `<Trans>` named-slot render on the repo's i18next, as 373 verified) · pure
- [x] `tools/callcenter-sentence-drive.mjs`: light, dark and RTL; Tab order follows the reading order; Enter opens a section and Esc returns focus; an Arabic caller name shows whole between "for" and "from"; an 18:00–21:00 window reads correctly in RTL · flow (Playwright)

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

## Comments

**Built AFK on 2026-10-04.** The decisions are logged in `.afk/HITL-408.md`.

- **The model.**
  - `header-sentence.ts` re-reads the unchanged `headerChips()` and adds the mode word, the
    address (label · district · city, one `<bdi>`) and the caller's name. A caller with a blank
    name reads by their mobile, in `Ltr`.
  - Each word has one of four looks. Blocked comes only from `submitBlockers`, through the
    shared `submit-blockers.ts` table, which now maps `NO_ADDRESS` → `address` and
    `NO_CUSTOMER` → `caller`.
  - The model also says whether a word can be a control at all: readouts never can, and a shut
    gate turns the word into a readout. The address is a control only once a caller is
    attached; the store, only under collection.
  - A document source is now `ltr` in `header-chips` (C6).
- **The component.** `HeaderSentence.tsx` replaces `ChipRow` and `Chip`.
  - One `<Trans>` key per shape. The slot components are self-contained, because `<Trans>`
    drops a self-closing slot's children.
  - The ledger, then the notes under it: the lapsed window and the shut mode and payment gates.
  - The delivery store is a readout with a dotted underline, titled `sentence.storeFollows`.
    The palette's refused *Change store* row borrows the same key, and `store.followsAddress`
    is retired.
  - 🚩 The sentence is `dir="auto"`, so an English fallback sentence does not scatter under an
    RTL page (HITL).
  - The drives' `data-cc-chip*` handles are kept on the words.
- **C5.** Every word is a native button that opens today's `ChipSection`. The slot section's
  full window is now focusable with `aria-disabled`, and its window text is isolated in `Ltr`.
- **C9.** `steps.store.hint` is reworded, and so is `guidance.needsCoupon` (which still said
  "Coupon chip"). `steps.caller.hint` is left for 409.

**Proof**

- `header-sentence.test.ts`: 14 tests. They cover:
  - the shape per mode;
  - the looks;
  - the readouts;
  - the shut gates;
  - the lapsed window;
  - the unworded payment;
  - isolation by kind;
  - every computed key existing in `callcenter.json`;
  - each shape key naming exactly the model's slot tags;
  - a `<Trans>` render through `react-dom/server` on an i18next instance built from the real
    bundle, in which a reordered template renders the same components in its own order.

  `header-chips.test.ts` and `submit-blockers.test.ts` were updated for the source isolate and
  the two new blocker owners.
- `npm test`: 194 files, 3536 tests, all passing. `npm run typecheck` is clean. `npm run lint`
  is clean on all four gates. `npm run build` is green.
- `tools/callcenter-sentence-drive.mjs`: **97/97** in light, dark and RTL at 1440, with
  screenshots at 1280 as well. It drives:
  - the sentence and ledger text;
  - the looks, including the bordered and dashed computed borders;
  - the readouts not being controls;
  - the store's title;
  - the Tab order, which follows the reading order;
  - Enter, Space and Esc, with focus going into the section and back to the word;
  - the Arabic name as one run between "for" and "from";
  - `18:00–21:00` reading correctly;
  - under RTL, the same in a right-to-left sentence, with a control that reverses the window
    once its isolate is stripped;
  - the address word opening the book;
  - the mode flip rewriting the sentence: the address and window leave, and the store becomes
    a blocked control.
- **Regression drives**, all at or above baseline:
  - `callcenter-drive` 532/532. Its derived-store checks now read the title, and the full
    window is asserted focusable and refused.
  - `fulfilment-176` 108/108 and `linked-request` 92/92: their chip wording checks were
    updated.
  - `section-175` 17/17, `store-choice` 11/11, `command-palette` 366/366, `callcenter-shell`
    123/123.
  - `foundation-drive` 1294/1302 (the known 8). Its isolate control sets the sentence RTL first.
  - `coupon-159` 99/103 and `callcenter-guidance` 105/107 fail exactly as at HEAD.

**Outstanding (not AFK):**

- the owner's S6 sign-off;
- a reviewer for the Arabic templates (none shipped; the mechanism is proven);
- a human eye on real Arabic rendering;
- a live SIS.Api run;
- BO-3 (`slot.date`), still unfiled, so the window is worded without a day.
