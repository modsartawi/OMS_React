---
status: done
spec: 380
blocked-by: 408
---

# 409 — The caller bar replaces the customer rail, and the centre column grows to 904px

## What to build

Variant C from [379](379-does-the-call-center-customer-rail-collapse-into-a-caller-header.md)
(spec 380 **C2**, **C7**, **C8**, **C9**, **C10**). The prototype is on branch
`prototype/379-cc-rail` (`36d6be9`, `callcenter/console/__prototype__/CallerBar.tsx` and
`RailPrototypePage.tsx`), with captures in `assets/379-shots/`.

**Layout (C2):** the shell's rail · the centre (`minmax(0,1fr)`) · the receipt (320px). **135's 260px
start column goes.** The centre grows from 644 to 904px at 1280.

**The caller bar (C7)**, at the top of the centre column:

- **Lookup:**
  - The phone box keeps the `cc-phone` id.
  - The caret lands there on open (keyed on the order) and returns there on remove (165/153).
  - The found member appears inline with **Attach**, so the two steps stand.
  - The palette's *attach caller* row still focuses the box.
- **Attached:** name · tier · points · mobile · member id · the requests chip · ✕ (icon-only, with its
  aria label), on one line at 1280. The fields stay `railFields`'s, with 135's six-field cap and
  order.
- **The bar takes the same pixels before and after attach.** The centre width does not change across
  it.
- **Bidi:** the name in `<bdi>`, the mobile and member id in `Ltr` and mono.

**Where the rail's other jobs go (C8):**

- **Sign-up:** a miss offers *Sign this caller up*, and `SignupPanel` opens **in the flow under the
  bar**, never as a modal (159).
- **Open requests:** an attention chip, "N open requests · View" (a new plural key), that opens
  194's picker unchanged.
- **A linked request** is a *Converting request ‹no› ↗* chip that opens an **in-flow detail section
  under the bar** (175 §9's idiom). It holds the reason, *Raised at store ‹code›*, the pharmacist's
  note, the ↗ link, and **Unlink** (195's confirm unchanged).
  - ⚠ **This section was not prototyped.** It is drawn at build, from the bar's and `SignupPanel`'s
    idiom, and the owner signs it off at S6.
- **The address book:** the sentence's address word (408) is the **only door**. The rail's *Pick an
  address* and *Change* go.
- **"Collecting from"** is replaced by the sentence's store word. `STORE_NOT_CHOSEN` is said once.
  The retained-address trace (176) becomes a note under the sentence beside `HeaderNotes`.
- **The opening-steps card:** the caller step's hint changes from "the panel on the left" to point at
  the caller bar (C9).
- **`CustomerRail` leaves the console**, and with it the console's last `bg-sidebar` / `--rail` use.

**Amends (C10):** 135, 165, 159, 194, 166 and 176, as 379 lists them.

## Spine reach

logic (reuse `rail-view`, `signup-view`, `linked-request`; bar state) · component (caller bar,
in-flow linked-request detail, two-column console) · i18n (`callcenter`) · test

## Proof (→ `tdd` red-green cycles)

- [x] Existing `rail-view.test.ts`, `signup-view.test.ts` and `linked-request.test.ts` stay green; add `bar shows the same six railFields in order, and the requests chip uses the plural short form` · pure
- [x] `tools/callcenter-callerbar-drive.mjs`: light, dark and RTL at 1280; the caret is on `cc-phone` at open and after ✕; the centre is 904px and its width is unchanged across attach; sign-up and the linked-request detail open in the flow under the bar; Unlink opens 195's confirm; an Arabic name mirrors with ✕ at the inline end · flow (Playwright)
- [x] The existing `tools/callcenter-drive.mjs`, `linked-request-drive.mjs` and `coupon-159-drive.mjs` are updated for the bar and pass · flow (Playwright)

## Boundaries

- **No new endpoint.**
- **i18n (`callcenter`):** `callerBar.*` (attach, remove aria, sign up), `requests.openShort` (plural,
  "{{count}} open requests · View"), `linkedRequest.detail.*`, the reworded caller-step hint. Retire
  the rail-only keys that no longer render.
- 🚩 **Behaviour change.** The phone box moves from the start column to the top of the centre. **The
  call center operator lead must accept it at S6 sign-off** (R2), together with 407.

## Done when

The console runs on two columns plus the caller bar, every job the rail did has its new home, the
furniture doesn't move across attach, and the drives are green in light, dark and RTL. This closes
S6.

## Blocked by

- [408](408-the-order-header-reads-as-a-sentence-over-a-ledger.md) — the sentence must own the
  address and store before the rail's blocks are retired

## Comments

**Built AFK on 2026-10-04.** The decisions are logged in `.afk/HITL-409.md`.

- **Layout (C2).** `ConsoleShell` is two columns plus a bar. The centre is `minmax(0,1fr)` (`data-cc-centre`) and the receipt is 320px. `CallerBar` is the first thing in the centre. Measured: the centre is **904px at 1280** and 1064px at 1440. `CustomerRail.tsx` is deleted, and with it the console's last rail column.
- **The bar (C7)** is `CallerBar.tsx`, with `caller-bar.ts` as its pure module.
  - It is one fixed 48px row in both states.
  - **Lookup:** the `cc-phone` box takes the caret on open (keyed on the order) and after ✕, and the found member appears inline with Attach.
  - **Attached:** `barFields` (railFields' six, re-seated name · tier · points · mobile · member · email), the requests chip and an icon-only ✕ at the inline end, on one line.
  - **Bidi:** the name and tier are in `<bdi>`; the mobile and member id in `Ltr` and mono; points in `Ltr`, sans.
  - **On a long caller:** the email is the only field that shrinks, and ✕ can never be clipped.
- **Where the rail's other jobs went (C8):**
  - **Sign-up:** in the flow under the bar.
  - **Open requests:** "N open requests · View" (`requests.openShort`, plural, the count in its own `Ltr` slot, `dir="auto"`), opening 194's picker unchanged.
  - **A linked request:** a *Converting request ‹no› ↗* chip whose detail is an in-flow `ChipSection` holding the reason, the store it was raised at, the pharmacist's note, the ↗ and Unlink (→ 195's `UnlinkConfirm`). Esc closes it and focus returns to the chip.
  - **Address book and "Collecting from":** the rail's address and collection blocks are gone, so the sentence's address word is the only door into the book. `STORE_NOT_CHOSEN` is said by the store word alone.
  - **The retained-address trace** (176) is now a note in `HeaderNotes`, under the sentence.
- **C9.** `steps.caller.hint` now reads "— in the caller bar above".
- **i18n:**
  - The `rail.*` keys that still render moved to `callerBar.*`, and `signup.open` became `callerBar.signUp`.
  - New keys: `requests.openShort_*`, `linkedRequest.*` and `sentence.addressRetained`.
  - Nine rail-only keys and `request.cardTitle/openCount/view` are retired.
- **Dead code removed:** `railBlock`, `addressSlot` and `addressPlace`, with their tests.

**Proof**

- `caller-bar.test.ts`: 10 tests, including *bar shows the same six railFields in order* and *the requests chip uses the plural short form*. The second renders `<Trans>` on the real bundle: "2 open requests · View" and "1 open request · View". `rail-view.test.ts`, `signup-view.test.ts` and `linked-request.test.ts` are green.
- `npm test`: 195 files, 3536 tests, all passing. `typecheck` is clean, `lint` is clean on all four gates, and `build` is green.
- `tools/callcenter-callerbar-drive.mjs`: **156/156** in light, dark and RTL at 1280, with the network stubbed at Playwright. It drives:
  - no rail, and the bar first in the centre;
  - the centre at 904px;
  - the caret on `cc-phone` at open and after ✕;
  - the found member inline, with no attach before the press;
  - the bar the same height, the centre the same width and the sentence top unchanged across attach;
  - the six fields in order, on one line, with nothing clipped;
  - the name whole, in `<bdi>`, and the mobile and member id in `Ltr` and mono;
  - ✕ at the inline end (the left under RTL), icon-only with its aria label;
  - the chip reading "2 open requests · View" on screen in every mode, and opening 194's picker;
  - a miss offering *Sign this caller up*, with the sign-up in the flow under the bar and no dialog;
  - the linked chip and its detail under the bar (reason, store, note, ↗, with no code and no money), Esc returning focus to the chip, Enter reopening it, and Unlink opening 195's confirm.
- **Updated drives:**
  - `callcenter-drive` 532/532, `linked-request` 93/93 and `fulfilment-176` 121/121. Its rail-block measurements became bar, sentence and centre measurements across the flip, and it checks the trace sits under the sentence.
  - `store-choice` 11/11.
  - `coupon-159` 99/103, the same four sign-up failures as at HEAD.
  - `address-editor` now reaches its known baseline timeout.
- **Unchanged drives:** `callcenter-shell` 123/123, `callcenter-sentence` 97/97, `section-175` 17/17, `command-palette` 366/366, `next-call` 10/10, `callcenter-guidance` 105/107 (baseline) and `foundation` 1294/1302 (baseline).

**Review triage (/code-review + /standards-review, before commit)**

- **Fixed:**
  - The linked detail could reopen by itself after an unlink and a re-link. Its open state is now keyed on the request number.
  - A dangling `addressPlace` reference and a garbled comment in `fulfilment-view.ts`.
  - Stale "the rail" comments across the console.
  - A double-negative error guard, now named.
  - The `offer`/`openCount` naming.
  - The Proof test's name.
- **Declined, as judgement calls:**
  - The mobile stays in mono, because C7 says so.
  - `railFields`/`data-cc-rail-field` keep their names, because the ticket says to reuse `rail-view` and the drives address the handle.
  - `barFields` stays a re-seat of `railFields`, which keeps 135's order and tests intact.
  - `requests` sits beside `request`, because the ticket names `requests.openShort`.
  - "Raised at store" is a label with the code as its value (HITL).

**Outstanding (not AFK):**

- The owner's **S6 sign-off**, including the unprototyped linked-request detail and the bar's field order (HITL).
- The **call center operator lead's acceptance (R2)** of the phone box moving to the top of the centre, with 407.
- A human eye on real Arabic rendering.
- A live SIS.Api run.
