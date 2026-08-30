---
status: open
spec: 301
blocked-by: 303
---

# 306 — removingAnEmailRequiresACaseReference

## What to build

The first **contact removal** — and the removal ceremony 307 then reuses.

A customer telephones and asks to stop being emailed. The analyst removes the email address, and the
trail records that **a person asked**.

- **The email removal is its own command**, not a blanked field on the profile form. It records
  under the contact-removal name so an auditor can tell a customer's request from an analyst's typo.
- 🚩 **It records intent, not exclusivity, and the spec says so out loud.** An `may edit` holder can
  also blank the Email field through the profile form, which records as an ordinary profile update.
  That is why removal counts **undercount** — anything counting removal requests reads this
  command's own trail and must accept it is a floor, not a total. Do not try to close the bypass:
  301 → ADR 0001 rules that gating it higher would be an authority that looks enforced and is not.
- **A confirmation is required, carrying a mandatory case reference.** The Remove control stays
  **disabled** until a non-empty (after trimming) reference is entered. An unaccountable removal must
  be *impossible*, not merely discouraged.
- **No retyped loyalty id here.** This is an edit an analyst can simply redo; the friction would buy
  nothing. That guard belongs to 307, where there is no undo.

**What the removal leaves behind** — ADR 0002 is normative:

- 🚩 **The removed address is recorded nowhere new.** The Actions tab renders free-form command data
  verbatim to anyone holding the read grant, so writing the old address there would republish the
  very thing the customer asked to have taken away.
- **The case reference goes in the trail slot the Actions tab draws.** It is meant to be read. Do
  **not** hide it in the slot the tab does not draw — hiding data in an undrawn column is exactly
  the kind of promise ADR 0002 rejects.
- The reference is validated non-empty and length-capped, and given **no format rule**: a pattern
  that is wrong for a phone call with no ticket buys nothing except analysts typing a hyphen.
- It is labelled **case reference**, never *notes*. 🚩 An analyst can still type a phone number into
  it and it will render on the Actions tab. No code can prevent that; the label is the only lever
  the screen has.

**Removing an email costs the customer nothing else** — they keep their account, their login, their
points and their history. The confirmation must not imply otherwise.

## Spine reach

model/api (the removal call) · store/logic (**new** removal module: which fields a removal names,
the confirm preconditions) · component (removal control + confirmation) · i18n · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] `aRemovalCannotBeConstructedWithoutACaseReference` — blank, whitespace-only and over-length
      references are all refused by the pure precondition; prior art is `actions-request.ts`, whose
      whole job is making a dangerous call unrepresentable · pure
- [ ] `anEmailRemovalNamesTheEmailAndNothingElse` — the request names the email field only, carries
      no old value, and does not block the member · pure
- [ ] `theRemoveControlStaysDeadUntilAReferenceIsTyped` — drive the dialog: disabled with nothing,
      disabled with whitespace, live with a reference; and the resulting Actions row shows the
      reference and **not** the removed address · flow

## Boundaries

- **Endpoint dependency:** a **new** removal route, gated on *may edit* (**not** the removal grant —
  ADR 0001). 🚩 Unbuilt — stub the envelopes. **Nothing here meets a live SIS.Api.**
- **Envelope `success:false` codes to handle by name:** member does not exist. Plus the grant
  refusal.
- **i18n:** new `loy` keys — the confirmation copy, the reference label, the disabled-reason hint.
  The copy must never use *erasure*, *deletion* or *anonymisation*: `CONTEXT.md` lists all three
  against **contact removal** precisely because each claims more than the command does.
- Grows `tools/loy-member-admin-drive.mjs`. Copies 303's idiom.

## Done when

An analyst can remove an email only after naming a case reference; the Actions tab shows the
reference and never the address; the member keeps their login and points. `typecheck`, `lint`,
vitest green.

## Blocked by

[303](303-blocking-a-member-names-a-reason-and-unblocking-clears-it.md) — for the write idiom.

## Open questions

None.
