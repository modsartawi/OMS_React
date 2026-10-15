---
status: done
spec: BackOffice 2680
blocked-by: — (live: BackOffice 2682)
---

# 494 — A loaded coupon template's redemption limits can be changed, with a warning when lowered below what is redeemed

**Source:** BackOffice spec 2680 (grilled 2026-10-15), slice 3. Server side: BackOffice 2682.

## What to build

In the coupons admin Templates workspace, a loaded template's **Max redemptions per code** and **Max
redemptions total** are editable (today both are disabled once loaded). Template ID and Code prefix stay
disabled.

- The update request carries both limits.
- A "0 = unlimited" hint sits by both fields.
- When a new total limit is non-zero and below the template's *Redeemed so far*, Save asks for
  confirmation, naming that number ("70 already redeemed — this limit stops all further use"), before
  sending. Zero never warns.
- The save hint says only the template ID and code prefix are fixed (EN + AR).

## Spine reach

UI → models → existing PUT door.

## Proof (→ `tdd` red-green cycles)

- [x] `needsLowerLimitConfirm` — true only when the new total is non-zero and below redeemed · `coupons/helpers.test.ts`
- [x] Run the app (**stubbed** — `tools/coupon-template-limits-drive.mjs` 22/22, LTR + RTL; the live walk on a host carrying BackOffice 2682 is still owed): load a template, change both limits, save, reload — values persist; lowering below
      redeemed shows the confirmation.

## Boundaries

oms-react only. Needs BackOffice 2682 deployed (an older API ignores the new fields).

## Done when

Both limits save from the loaded-template form, and the lowered-limit confirmation appears as described.

## Blocked by

BackOffice [2682](../../../Work/DMSCO/BackOffice/.issues/2682-a-coupon-templates-redemption-limits-change-through-the-web-service-and-are-audited.md) live.

## Comments

**Done 2026-10-15.** `UpdateTemplateRequest` gains both nullable limits; the loaded form always sends
both (`0` = unlimited, empty reads as `0`). The two inputs are enabled once loaded, each with a
`0 = unlimited` hint; Template ID and Code prefix stay locked. Save calls `needsLowerLimitConfirm`
and, when true, asks through the shell's `confirmAction` ("{{redeemed}} already redeemed — this limit
stops all further use.", the count isolated whole with `fsi`); No sends nothing.

- **Judgement call (overrulable):** the helper also needs the total to have *changed* from the loaded
  one, so a template whose limit already sits below its redemptions does not re-ask on every save of
  its description. A raise that is still below redeemed (50 → 60 with 70 redeemed) does ask.
- `createHint` ("Template ID, redemption limits and code prefix are fixed once created") was untrue
  after this change and now names only the two fixed fields, like `saveHint`.
- AR: `coupons.json` had no `templates` block; added one carrying the four new/changed keys only
  (the rest fall back to EN, and Arabic is not switched on yet).
- Proof: `helpers.test.ts` 4 new (red first), full suite 5152/5152; drive 22/22 stubbed;
  `coupon-import-delete-drive` 65/65 unchanged; typecheck, lint (4 gates), build green.
- Review: self-reviewed (correctness + rules) on this ticket's diff only — the working tree carried
  another session's uncommitted 493 work, which a tool-driven review would have swept in.
- Live: needs BackOffice 2682 deployed — an older API ignores the two fields, so a save would appear
  to succeed and the reload would show the old values.
