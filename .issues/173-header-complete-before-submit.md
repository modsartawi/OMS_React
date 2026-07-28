---
status: done
spec: 160
blocked-by: 166
---

# 173 — theHeaderIsCompleteBeforeSubmitIsOffered

## What to build

The rest of header capture, as chips the agent settles and stops thinking about.

- **The delivery slot**, chosen from the store's available slots. 🚩 It is a **soft gate** on a CLCN
  order: a slot that lapses **warns**, it does not block. The Wasfaty slot rule and its `1283`/`1154`
  exemption fell out with the non-CLCN kinds ([132](132-header-capture-inventory.md)) and must not be
  re-introduced here.
- **The document source and its mandatory reference**, so the order can be traced back to the
  campaign or system that produced the call. The sources offered are the agent's own, derived from
  the session — there is no user id in the path.
- Each settles into a **re-openable chip** in the row 166 built, so a finished section stops
  competing for the agent's eye.

🚩 **Submit is never mysteriously dead.** While something is missing, *Place order* is disabled and
the **reason is named**, from `capabilities.submitBlockers` — the console does not re-implement the
server's "is this order complete" predicate, it renders the server's own answer. A chip whose section
is what's blocking wears the *needs attention* state at the same time.

## Spine reach

api (`SetSlot`, `SetDocumentSource`) · logic (blocker codes → the words beside a dead submit; which
chip a blocker belongs to) · component (slot picker, source + reference chips, submit-blocked
reason) · i18n · test (pure + flow)

## Proof (→ `tdd` red-green cycles)

- [x] `aDeadSubmitAlwaysNamesItsReason` — pure: every `submitBlockers` code resolves to an
      agent-facing phrase **and** to the chip that owns it; an unrecognised code still produces words
      rather than a raw code; an empty list leaves submit live · pure
- [x] `theHeaderSettlesIntoChips` — drive: setting a slot, a source and a reference collapses each
      into a re-openable chip, the *needs attention* state clears as each lands, and a lapsed slot
      **warns without blocking submit** · flow (Playwright, extends `tools/callcenter-drive.mjs`)

## Boundaries

**Endpoints:** `POST CallCenterWeb/SetSlot`, `SetDocumentSource`, plus the session-derived
`MyDocumentSources` on 137's door — 🚩 the door deliberately breaks "delegates verbatim" here: there
is **no user id path param**, the session decides. `AvailableSlots` / `SlotIsActive` are **off the
door** and already served by `@/core/services/lookups.ts`. Codes: `SLOT_UNAVAILABLE` (409 — a warning
path, **not** a submit blocker), `SOURCE_REFERENCE_REQUIRED` (400). ⚠ **Fulfilment mode**
([154](154-fulfilment-mode-and-store-choice.md)) and **payment type**
([155](155-payment-type-cod-or-online.md)) are **not** captured here — they are holes in the frozen
contract with no axis to write to, and this slice must not invent one.

## Done when

An agent settles slot, source and reference into chips, and never reaches a dead *Place order*
without being told what it is waiting for.

## Blocked by

[166](166-address-derives-the-store.md) — the chip row and its states are built there.

## As built

- **One table, two surfaces.** `submit-blockers.ts` is the pure module: code → agent-facing
  phrase → the chip that owns it. The chip row's old private `BLOCKER_FOR` and the receipt's
  inline `t(code, { defaultValue: code })` both now read it, so a chip that looks settled while
  the receipt names its section is no longer expressible. 🚩 An unrecognised code (§9 ships
  server-first) resolves to a **phrase**, never to `MISSING_PAYMENT_TYPE` on screen; codes that
  would print the same sentence — `MISSING_SOURCE_REFERENCE` / `SOURCE_REFERENCE_REQUIRED`, and
  any two unknowns — collapse to one, because saying it twice tells the agent less.
- **The soft gate is soft in two places.** A slot the order HOLDS that has lapsed
  (`slot.isActive: false`) keeps its chip *settled*, says `(lapsed)` on it and warns in the flow —
  submit is untouched, since only `submitBlockers` may dim it. A window that goes between the list
  being read and the pick answers `SLOT_UNAVAILABLE` (409) and is drawn in the **attention**
  register inside the picker, not the danger one: the order is unchanged and the next window
  lands. No Wasfaty rule and no `1283`/`1154` exemption anywhere.
- **The mandatory-reference rule stays the server's.** Source and reference go up on ONE verb;
  *Save* is not disabled on an empty reference, because which sources need one is a predicate this
  console does not own. The drive asserts the console **sent** the empty reference and worded the
  refusal, rather than predicting it.
- **`MyDocumentSources` carries no user id** — asserted from the recorded request, not from a
  comment.
- **`Slots/AvailableSlots/{storeCode}` graduated to `@/core/services/lookups.ts`** (uncached by
  construction — store- and time-specific). Two features now ask it and a feature may never import
  a feature; `features/oms/document`'s reschedule dialog reads the same options.
- **Ruled while building.** *Re-open in place* (US21) is a modal, following 167's `StorePicker`
  precedent rather than inventing a second disclosure shape. There is **no clear-the-slot** action:
  `setSlot` takes `slotId | null` but this ticket does not ask for the unset path, and an agent who
  picked the wrong window picks another.

**Proof run:** 8 pure (`submit-blockers.test.ts`) with the locale file asserted against — a `t()`
with no backing key is exactly this ticket's failure mode and no type check can see it — plus
`tools/callcenter-drive.mjs` **416/416** (boxes 38 and 38b), `callcenter-guidance-drive` 103/103,
`npm test` 500, typecheck, lint and build green.
