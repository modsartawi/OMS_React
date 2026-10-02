---
type: wayfinder-ticket
wayfinder: prototype
map: 358
status: done
blocked-by: 362, 365
---

# 373 — The Call center order header as a sentence

## Question

The prototype writes the Call center order header as **a sentence of editable slots**, for example
"Deliver to Home for ‹customer› from ‹store›…".

- **Does it replace** the chips from `header-chips.ts`?
- **How is each slot edited** by keyboard and by mouse?
- **How does an Arabic customer name sit** in an English sentence (`<bdi>`)?
- **What happens in RTL**, where the sentence itself becomes Arabic?

Prototype it in the live app on the new tokens.

**Constraint from [365](365-keyboard-shortcuts-that-work-for-everyone.md):** the console's keys stay
153's table (Ctrl+K, then ↓/↑ and Enter in the search box, then Esc). A slot is edited through its
own control or a palette row. **There are no single letters, no `/` slash commands and no
place-order chord.**

## Answer

**D: the facts the agent says to the caller form one sentence, the bookkeeping sits in a labelled
ledger under it, and every slot opens today's in-flow section.** The owner decided on 2026-10-02,
choosing from four variants in the real `ConsoleShell` on 362's navy tokens:

- A: one two-line sentence.
- B: Far as drawn, with popovers.
- C: today's chips plus a read-back line.
- D: a sentence plus a ledger.

The owner took the recommendation on all four questions.

**Assets:**

- The prototype is branch `prototype/373-cc-sentence` (`bdc24e7`, from `prototype/362-ops-console-tokens`,
  never merges), in worktree `C:\Playground\oms-react-373`.
- To run it: `npx vite --port 5373`, then open
  `/prototype/callcenter-sentence?stub=1&palette=navy&variant=A|B|C|D&state=…`. ←/→ change the
  variant and ↑/↓ change the scenario. There are nine scenarios, including an Arabic caller in LTR
  and RTL.
- There are 48 captures, in light and dark, in [373-shots/](assets/373-shots/). The decisive ones
  are `D-complete-light`, `D-fresh-light`, `A-arabicLtr-light`, `A-arabicRtl-light`,
  `B-arabicRtl-slot-popover-light` and `C-arabicRtl-light`.
- `node tools/proto-373-shots.mjs` re-takes them and runs **8 keyboard and bidi checks, all of
  which pass.**

### 1. The sentence replaces the chip row, not the model

- **`ChipRow` and `Chip` go, and `header-chips.ts` stays the one pure model.** It keeps the slot
  state from the server's `submitBlockers`, plus the derived and lapsed flags. All four variants
  were drawn from it unchanged. The sentence also needs three facts no chip carried: the mode
  word, the address and the caller's name. They join that model or a sibling module. The
  attention rule stays `submitBlockers`, and only that.
- **Line 1, the sentence, has one shape per mode:**
  - Delivery: `‹Deliver› to ‹address› for ‹caller› from ‹store› at ‹window›, ‹payment›.`
  - Collection: `‹Collect› from ‹store› for ‹caller›, ‹payment›.`

  A mode flip rewrites the sentence: the address and window leave, and the store becomes a
  control. This is 176's "absent, not disabled", in prose.
- **Line 2, the ledger, holds `Source · Ref · Coupon · Note` as labelled fields, not prose.**
  These are the agent's bookkeeping, not something said to a caller. In A, "Logged as CLCN
  CRM-889231. SAVE20 "Call before…"" read as noise. Coupon and note still close the row
  (159/183), and when empty they read "+ coupon" and "+ note".
- **A slot has one of four looks:**
  - **Settled:** a bordered word.
  - **Blocked by the server:** a dashed attention fill.
  - **Optional and empty:** a ghost word.
  - **Readout:** a plain word, not a control.
- **There are two readouts.**
  - **The caller's name.** The rail still owns attach and remove.
  - **The store on a delivery order.** It gets a dotted underline and a title saying it follows
    the address, which replaces today's `store.followsAddress` line.
- **The address word opens the rail's address book** (the same dialog, 166). It is a second way
  into the same act, and it only appears once a caller is attached.
- **The remaining notes are said once, under the sentence.** A shut gate (a delivery-only source)
  turns the mode word into a readout and its reason line stays. The lapsed-slot warning stays the
  same way.

### 2. Editing a slot

- **Each slot opens the same in-flow `ChipSection` it opens today.** 175 §9 stands, and there are
  no popovers.
- **Mouse:** click the word.
- **Keyboard:** the words are native buttons in DOM order, which is the reading order.
  - Tab moves between them.
  - Enter or Space opens a section and moves focus to the section region.
  - Esc closes it and returns focus to the word.

  All of this was measured.
- **The palette's existing verb rows (192) open the same section.**
- **365 holds:** no single letters, no slash commands and no place-order chord.
- **Popovers (B) were rejected.** They would have forked the built editors into a second idiom:
  - the slot picker's days and capacity;
  - the source form's reference rule;
  - the note's textarea.
- **One popover lesson carries over anyway.** A refused option (a full window) must stay
  focusable with `aria-disabled`. A `disabled` option stranded focus outside the list, and ↓
  leaked to the page.

### 3. An Arabic name inside an English sentence

- **Every server value in a slot is its own isolate:**
  - `<bdi>` (auto) for the caller's name, the address, the store name and the note;
  - `Ltr` (`<bdi dir="ltr">`) for the store code, document source, reference, coupon codes and
    **every time window**.
- **Measured:** `A-arabicLtr` shows the Arabic name whole, between "for" and "from".
- **Punctuation and quotes that the template adds sit outside the isolate.** The prototype put the
  note's quotes inside it, and in RTL they mirrored.

### 4. RTL, where the sentence itself is Arabic

- **Each sentence shape is one i18n key with named self-closing slot tags, rendered by
  react-i18next's `<Trans components>`.** This was verified in vitest on the repo's i18next:
  `<mode/> to <address/> for <customer/>.` and an Arabic string in a different order render the
  same components, in the translation's order. **The translation owns the word order.** DOM order
  follows the template, so Tab follows the reading order in both languages.
- **An Arabic template must never glue a clitic to a slot.** `لـ<customer/>` fused onto
  "Fatimah" (`latinRtl`). Write the particle as its own word, or as a noun such as `للعميل`.
- ⚠ **The Arabic in the prototype is unreviewed.** It shows the mechanism, not the copy.

### Handed on

1. 🚩 **`Ltr`'s rule is incomplete, and a shipped screen already breaks because of it.**
   - **What `Ltr` says:** a value breaks only when it has a space and starts or ends with a digit.
   - **What was measured:** a window like `15:00–18:00` has no space, yet it reverses to
     `18:00–15:00` under RTL (`B-arabicRtl-slot-popover`).
   - **The shipped slot chip** reads `21:00–18:00` for an 18:00–21:00 window (`C-arabicRtl-light`),
     because `ConsoleShell`'s `Chip` renders `${from}–${to}` without a wrapper.
   - Handed to [The foundation in Arabic/RTL](378-the-foundation-in-arabic-rtl.md).
2. **The header's slot has no day.** `SessionSlot` is slotId, from, to and isActive. The day sits
   only inside `slotId`, and parsing an id is ruled out.
   - **The owner's ruling:** ask BackOffice for **`slot.date` on the session header**. The ask is
     filed with `/to-spec`.
   - **Until then:** the sentence words the window only, as today's chip does.
3. **Stale shipped copy.** `steps.store.hint` says "the Store chip above, or type /store". There
   are no slash commands (153/365), and after this ticket there are no chips. The hint is reworded
   at build.
4. **The sentence and ledger repeat the rail's caller and address.** The owner ruled this needs
   its own ticket: [Does the Call center customer rail collapse into a caller header?](379-does-the-call-center-customer-rail-collapse-into-a-caller-header.md)
