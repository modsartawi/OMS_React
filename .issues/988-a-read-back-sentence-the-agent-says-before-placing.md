---
status: open
spec: 983
blocked-by: 986
---

# 988: A read-back sentence the agent says before placing the order

Slice of [spec 983](983-the-console-is-built-around-the-caller-spec.md). Reference picture: the
*Call Center Console v3* artifact (v3).

## What to build

Under the checklist, the sentence to confirm the order aloud (D8): the items as quantity × short
name, the saving, the payable total, then delivered to the address label or ready at the store, the
slot, and how they pay. It updates with every state and is written in the console's language, with
the Arabic as its own key.

## Spine reach

pure (`read-back.ts`) · component · i18n (en + ar) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `theSentenceFollowsTheOrder`: fixtures for collect, deliver, no slot yet and no payment yet each give the right sentence, and the parts not chosen are left out rather than shown as blanks · pure
- [ ] `theTotalIsThePayable`: the total in the sentence is `totals.payable`, never a sum · pure

## Boundaries

No wire change.

## Done when

The owner reads it aloud on a walk order in English and Arabic and it is right.
