# HITL-408 — unattended decisions, ticket 408 (the order header reads as a sentence over a ledger)

## Q: Which direction does the sentence paragraph take under an RTL page?
**Decision taken:** `dir="auto"` on the sentence `<p>`: it takes the direction of its own first strong letter, so an Arabic template reads right-to-left and an English one reads left-to-right, even on an RTL page. The ledger and the notes are layout, and they mirror with the page.
**Why:** The drive (English strings under `dir="rtl"`) showed that on the page's RTL base an English sentence scatters. Its leading word, the mode button, and its trailing words (the window and the payment) resolve to the RTL base and jump to opposite ends, so it read "Deliver at 1101 from … to 18:00–21:00". The same thing would happen in production whenever an Arabic locale falls back to the English key. This is 388's reasoning for toast lines (`unicode-bidi: plaintext`) applied to prose.
**Revisit if:** an Arabic reviewer wants the sentence forced to the page direction. In that case, the untranslated-fallback case needs another answer.

## Q: The drives' handles — rename `data-cc-chip*` now that there are no chips?
**Decision taken:** Kept. Every word and ledger field carries `data-cc-chip`, `data-cc-chip-state`, `data-cc-chip-open` and `data-cc-chip-value`, and the container keeps `data-cc-chips`, `data-cc-slot-lapsed`, `data-cc-fulfilment-locked`, `data-cc-payment-locked` and `data-cc-store-derived`. The new handles are `data-cc-sentence`, `data-cc-ledger`, `data-cc-sentence-shape` and `data-cc-word-look`.
**Why:** Seven shipped drives (callcenter, 159, 175, 176, 194, store-choice, command-palette, foundation) address the header by these names. With the names kept, they keep proving 173–195's behaviour, and only the checks that asserted the old chip wording changed.
**Revisit if:** a hardening pass renames the drive handles wholesale.

## Q: Which blocker marks the caller and the address words?
**Decision taken:** The shared table in `submit-blockers.ts` now maps `NO_CUSTOMER` → `caller` and `NO_ADDRESS` → `address`. Before, both mapped to `null` ("the rail's"). `blockedChips` and the receipt still read that one table.
**Why:** The attention rule is `submitBlockers` and only that (C3), and the header-chips comment rules out a second table. The address word is the address book's door (379), so it owns its blocker. The caller word is a readout, but "no caller yet" must look blocked while the server waits on one.
**Revisit if:** 409's caller bar should be the only place that marks a missing caller.

## Q: Where does the "follows the address" sentence live now?
**Decision taken:** One key, `sentence.storeFollows`. It is the title of the delivery store's readout, and the palette's refused *Change store* row now uses it as its reason (`STORE_FOLLOWS_ADDRESS`). `store.followsAddress` is retired.
**Why:** The ticket replaces the line under the row with the readout's title and asks for "the store readout title" key. Keeping two near-identical keys would let the palette and the title drift apart.
**Revisit if:** the palette needs a shorter phrase than the title.

## Q: The retained-address trace (176) — under the sentence now?
**Decision taken:** Not moved. The trace stays in the rail's collection block for now. The sentence's notes are the lapsed window, the shut mode gate and the shut payment gate.
**Why:** Ticket 408 lists only the gate reason and the lapsed warning as notes. Spec C4's "retained-address trace" belongs with 379's retirement of the rail's collection block, which is 409's caller bar. Moving it now would draw it twice while the rail is still there.
**Revisit if:** 409 lands without moving it. Then it must move to the notes under the sentence.

## Q: The address word's wording.
**Decision taken:** It is the label, then the district, then the city, as one free-text string isolated once in `<bdi>`: `Home · Al Malqa · Riyadh`. It uses `formatPair`, the same `·` separator as the rail's `districtLine`. The street line is not read out.
**Why:** 373's capture draws "Home · Al Malqa, Riyadh". The district and the city are the two fields the projection sends for the place (`addressPlace`), and a key that glued two data values would break the bidi rule.
**Revisit if:** the operator lead wants the street in the sentence.

## Q: The empty wordings and the mode/payment words.
**Decision taken:** These are new `callcenter` keys. `sentence.mode.{delivery: Deliver, pickInStore: Collect}`, `sentence.payment.*` in lower case ("cash on delivery"), `sentence.empty.{address, caller, store, slot}` ("choose an address", "no caller yet", …), `ledger.chooseSource`, `ledger.addReference`, `ledger.addCoupon` ("+ coupon"), `ledger.addNote` ("+ note"), `ledger.quoted` (“<note/>”), and `sentence.unworded` ("—") for a payment the client cannot word. Retired: `chips.notSet`, `chips.derived`, `chips.fulfilment`, `chips.payment`, `chips.coupon`, `chips.note`, `chips.value.*`, `store.followsAddress`. Kept because they still render: `chips.store/slot/source/reference` (submit's "fix the …" line), `chips.lapsed`, and `chips.change.*` (the words' titles; `chips.change.address` is added).
**Why:** The English copy is lifted from 373's prototype table. The Arabic is not shipped: there is no Arabic locale file.
**Revisit if:** a copy review. ⚠ No Arabic copy has been reviewed.

## Q: Stale "chip" copy outside the two named hints.
**Decision taken:** `steps.store.hint` is reworded to "— the store word in the sentence above". `guidance.needsCoupon` ("apply one on the Coupon chip above") becomes "add one from Coupon, under the sentence above". `steps.caller.hint` ("in the panel on the left") is left for 409, because the panel is still on the left until the caller bar lands.
**Why:** C9 says there are no chips and no slash commands. The caller hint is only stale once 409 moves the phone box.
**Revisit if:** 409 does not reword `steps.caller.hint`.

## Q: Which "refused option" turns `aria-disabled`?
**Decision taken:** The slot section's full window. It is focusable with `aria-disabled="true"`, pressing it does nothing, and it is still drawn. Its window text is now isolated in `Ltr` ("every window"). The *current* window, the current store and the current mode stay `disabled`, because they are not refusals.
**Why:** 373 measured the full window as the case where `disabled` stranded focus.
**Revisit if:** another picker grows a server-refused option.

## Comments
- Drive baselines after this slice: callcenter-drive 532/532 (531 + the refused-window keyboard check), fulfilment-176 108/108, linked-request 92/92, section-175 17/17, store-choice 11/11, command-palette 366/366 and callcenter-shell 123/123. These match their baselines: coupon-159 99/103 (the sign-up carry-over), callcenter-guidance 105/107 (blank offerId) and foundation 1294/1302 (topbar/bell 8 from 393).
- `foundation-drive`'s isolate control now sets the sentence to the page's direction before stripping the isolate. That stands in for an Arabic template, because `dir="auto"` keeps the English sentence LTR, and without it the control could no longer fail.
- The regression drives rewrite committed screenshots under `.issues/assets/159|176|194`. They were restored with `git checkout`, and none are committed.

## Review triage (/code-review + /standards-review, before commit)
- **Fixed:**
  - An attached caller with a blank name now reads by their mobile, not "no caller yet" (code-review).
  - The sentence drive now proves RTL in a right-to-left sentence, with a control that fails once the isolate is stripped (spec review: `dir="auto"` alone made the RTL pass repeat the LTR one).
  - Stale doc comments in `header-chips.ts`.
- **Declined, as judgement calls:**
  - *The ledger fields don't take the bordered and fill looks.* 373's approved D captures draw the ledger as labelled text with a dashed attention underline. The looks are drawn per the capture.
  - *A blocked readout (no caller, or a not-chosen delivery store) shows the dashed fill without being clickable.* The attention rule is `submitBlockers`, and 373's prototype drew the missing caller exactly this way. The store's title says the fix is the address.
  - *The address joins three free-text values in one `<bdi>`.* It is the whole value, isolated once. With an English label and an Arabic district and city, the Arabic run reads in its own order inside it.
  - *The word buttons dropped `aria-label`.* Their accessible name is now the value they hold, and `title` is the description. The old label hid the value from screen readers.
  - *The first Proof test lives in `header-sentence.test.ts` rather than extending `header-chips.test.ts`.* The sentence facts live in their own sibling module, which the ticket allows.
  - *`HeaderSlotId` names, and `capabilityGate` read twice.* Left as they are.
