---
status: open
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

- [ ] Existing `rail-view.test.ts`, `signup-view.test.ts` and `linked-request.test.ts` stay green; add `bar shows the same six railFields in order, and the requests chip uses the plural short form` · pure
- [ ] `tools/callcenter-callerbar-drive.mjs`: light, dark and RTL at 1280; the caret is on `cc-phone` at open and after ✕; the centre is 904px and its width is unchanged across attach; sign-up and the linked-request detail open in the flow under the bar; Unlink opens 195's confirm; an Arabic name mirrors with ✕ at the inline end · flow (Playwright)
- [ ] The existing `tools/callcenter-drive.mjs`, `linked-request-drive.mjs` and `coupon-159-drive.mjs` are updated for the bar and pass · flow (Playwright)

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
