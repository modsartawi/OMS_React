# HITL — ticket 422 (New coupon material on a Buy line)

## Q: What is Generate's wire shape?
**Decision taken:** Built against the spec's reading: `POST BbyMaintainWeb/CouponMaterial/Generate { description }` → `{ status: 'saved' | 'refused', material, refusals? }`. The shape is kept in one place: `BbyCouponMaterialRequest` / `BbyCouponMaterialResult` in `src/core/models/bonus-buy-maintenance.ts` and `bbyMaintainApi.generateCouponMaterial`. `refusals` is optional. Only a `saved` answer that names a non-blank material fills the line.
**Why:** BackOffice 2404 is open; the wave ruling says to stub exactly that shape.
**Revisit if:** 2404 ships a different status set (for example `refused` with no reason field, or a `message`), or nests `material`. Change the two types, `readGenerateOutcome`, and the drive stub (step 42 asserts the body keys).

## Q: A bare `refused` with no refusals: what does the user see?
**Decision taken:** Only the title "No coupon material was created:". The spec names no reason field.
**Why:** We do not invent a reason.
**Revisit if:** 2404 refuses with a reason. Ask BackOffice 2404 to send `refusals` (EN + AR, `BbyRefusal`) like every other BbyMaintainWeb write.

## Q: Where does the action sit, and how?
**Decision taken:** A small icon button (`TicketPlus`, aria-label/title "New coupon material") beside the identifier on each Buy line whose Line Item Type is Material. It is shown only while the editor is not read-only: a Planned OMS bonus buy, or a new one before its first Save. The prompt is a one-field dialog, "Item description", that defaults to the bonus buy's text.
**Why:** This is the narrowest reading of "an action on a Buy line". An icon keeps the table's column widths.
**Revisit if:** The owner wants a labelled text button, or the action on Get lines too. The spec says Buy line only.

## Q: Does the description box carry a maxLength?
**Decision taken:** No. The text is trimmed and sent; the server clamps it to the item master's width, and fills a blank one with "Coupon" (BackOffice 2404).
**Why:** The item master's width is not named on the client, and the server owns the clamp.
**Revisit if:** The owner wants the width shown.

## Q: What if the line is removed or made a grouping while Generate is out?
**Decision taken:** The number is not placed anywhere. The report says it was created but not placed, and asks the user to type it on a Buy line. The material still exists on the server.
**Why:** This was a /code-review finding: the success message must not claim a placement that did not happen.
**Revisit if:** The owner prefers to lock the Buy grid while a Generate is out.

## Q: The coupon template's pick list ("also offers coupon materials to pick from")
**Decision taken:** NOT built (wave ruling). `CouponsAdminWeb` has no list of coupon materials and spec 2396 names none. Coupons does not import the bonus-buy feature's Generate. The typed box is unchanged (ADR 0051). The ticket records it as outstanding.
**Why:** There is no door, and we do not invent endpoints.
**Revisit if:** BackOffice adds a coupon-material list read (for example `GET CouponsAdminWeb/CouponMaterials`). This needs to be filed with BackOffice; it is not yet asked. A follow-up oms ticket would then add the pick list to `src/features/pricing/coupons/TemplatesWorkspace.tsx`.

## Q (419 scope, raised by /code-review): MarkTested sends no `version`
**Decision taken:** Not changed. 419's body is the spec's `{ number, note }`.
**Why:** A /code-review pass found that Mark Tested could attest a version saved by the author after the tester opened the page. The client blocks only its OWN unsaved edits, and the body carries no version to refuse a stale one.
**Revisit if:** BackOffice 2397 agrees. It could take `version` on MarkTested (refused as `BBY-STALE-VERSION`, as Save is), or refuse when the header changed after the tester's read. This is a question for BackOffice 2397.

## Note: drive step 28 (419's block) was made to wait
It failed 2 of 3 runs during this slice (HITL-420 noted it at 1 in 4). It now waits for the toolbar to re-render before reading `isEnabled()`. The assertion is the same. After the change the drive was 176/176 on four runs.

## Outstanding (not AFK-able)
- Owner walk: generate a coupon material on a new bonus buy, save, pick (or type) it on a coupon template, and redeem it on a simulated basket. This needs a dev SIS.Api carrying BackOffice 2404 (open).
- The coupon-template pick list (no door).
