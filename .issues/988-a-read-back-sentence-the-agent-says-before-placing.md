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

- [x] `theSentenceFollowsTheOrder`: fixtures for collect, deliver, no slot yet and no payment yet each give the right sentence, and the parts not chosen are left out rather than shown as blanks · pure
- [x] `theTotalIsThePayable`: the total in the sentence is `totals.payable`, never a sum · pure

## Boundaries

No wire change.

## Done when

The owner reads it aloud on a walk order in English and Arabic and it is right.

## Comments

**2026-11-27: built on branch `t/988`. The owner's read-aloud in English and Arabic is still owed.**

Built:
- `read-back.ts` (pure): `readBack(state, lang)` returns the sentence as clauses in this order:
  items · saving · total · where · payment. Each clause is a whole sentence with its own key, so a
  part that is not chosen drops out and leaves no "to" or "at" hanging:
  - **items:** each line as quantity × name, in the engine's order. Under Arabic the name is the
    item's Arabic name (`description2`) where it has one, else its own `description`. The list is
    joined by `Intl.ListFormat` ("a and b", or the Arabic comma and و), never a literal.
  - **saving:** `receipt-view`'s `saves`, i.e. the server's `discount` above nought. A v1.12
    server (no `discount`) says no saving.
  - **total:** `totals.payable` through `receipt-view`, never a sum. The test uses a payable that
    does not add up.
  - **where:** *deliver to ‹label›, ‹window›* · *deliver to ‹label›* (no slot yet) · *deliver it
    to you* (no address yet) · *ready to collect at ‹code · name›* · *ready to collect* (no store
    yet). The window is one `formatRange` string, isolated once, and only beside an address (the
    rail's pairing).
  - **payment:** cash on delivery / pay when you collect / pay online. A payment the console
    cannot word (`Receivable`) is left out.
- `ReadBack.tsx` sits in the summary column, under *Before you place it* and above *Place order*.
  It is gone once the order is placed. It re-reads every state, so it changes with each answer.
  The paragraph is `dir="auto"`. Figures, quantities, the store pair and the window are `Ltr`, and
  the address label and item names are `<bdi>`.
- i18n: `readBack.*` in en and ar. The Arabic has its own sentences, not a word-for-word
  translation.

Proof:
- `read-back.test.ts`: 11/11. It covers deliver, collect, no slot, no address, no store, no
  payment, no items/no saving, v1.12, Arabic names, every key present in en+ar, and the
  payable-not-a-sum case.
- `tools/callcenter-readback-drive.mjs` (port 5208): 13/13 across LTR delivery, collection, no
  slot, and RTL isolates. The receipt drive is still 22/22 and the rail drive 100/100.
- typecheck, `npm test` (12875/12875) and lint: clean.

Owed:
- **Done when:** the owner reads it aloud on a walk order in English and in Arabic. `i18n.ts` still
  has `lng: 'en'`, so the Arabic sentence is carried but cannot be seen in the app until Arabic is
  switched on. The RTL drive checks direction and isolation only.

Decisions for the owner:
- (a) **"Short name"** is the engine's `description` (or `description2` under Arabic), untrimmed
  apart from whitespace. SAP descriptions are long ("8X4 DEO SPRAY MODN CHARM 150ML"). A shorter
  name would need a server field. The client will not cut it.
- (b) Quantity × name is drawn as **two isolates in a `readBack.line` key** (`<qty/> × <name/>`),
  not as one `Ltr` pair. The quantity leads in the reading order of either language, so under
  Arabic it sits on the right of an Arabic name. One LTR pair would put it on the left.
- (c) The quantity is said without its unit (`2 ×`, not `2 EA ×`).
- (d) The English wording is the agent speaking to the caller: "That's … You save … Your total is
  … We'll deliver it to Home, 16:00–18:00. You pay cash on delivery." Please confirm or reword it
  on the walk.
