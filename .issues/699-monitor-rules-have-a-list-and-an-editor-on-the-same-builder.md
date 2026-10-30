---
status: open
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 693
---

# 699 — Monitor rules have a list and an editor on the same builder

## What to build

Stories 38, 41, 42; A1, A2, A7, A9; doors 3290, 3292. A rule kind `monitor`, listed beside guards and edited on the same
builder, scope `claimResponse` (pre-auth and claim `use`). It can read `$claimResponse.reissue.reason` and
`$previous.claimResponse.<key>`. Its only effect is a review item, so the editor shows severity **info / action** and EN
and AR text, and offers none of the guard's till effects: no REFUSE / OVERRIDE / WARN, no acknowledgement, no suggestion
to the pharmacist. The page says plainly that a monitor never touches a sale.

**Decision (overrulable):** monitors live in the existing `guards` feature as a kind on the same list and editor, so
"same builder" needs no new feature and no move into core.

## Spine reach

model/api (kind, scope, effect) · store/logic (what the editor offers per kind, `$previous` keys) · component (list,
editor) · i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] per kind: a monitor offers no guard effect and a guard offers no monitor severity — pure
- [ ] `$previous` keys are offered on a monitor and never on a guard — pure
- [ ] create a "reissue cut the approved quantity" monitor, save, reopen, read it; every existing guard drive stays
      green — flow

## Boundaries

No new door beyond the kind and scope. Approval, shadow and back-test are 700; other scopes are 701. Doors stubbed; 711
reconciles.

## Done when

An author writes a monitor on the builder they know, and cannot give it an effect on a sale.

## Blocked by

693.

## Comments
